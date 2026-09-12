import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Scan, Square, X } from 'lucide-react';
import { publishDetection } from '../detectionBus';

const API_BASE = 'http://127.0.0.1:8000';
const norm = (p) => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// Backend pixel bbox [x1,y1,x2,y2] -> % of frame (for overlay positioning)
const bboxToPct = (bbox, w, h) => {
  if (!bbox || !w || !h) return null;
  const [x1, y1, x2, y2] = bbox;
  if (x2 <= x1 || y2 <= y1) return null;
  return {
    left: Math.max(0, (x1 / w) * 100),
    top: Math.max(0, (y1 / h) * 100),
    width: Math.min(100, ((x2 - x1) / w) * 100),
    height: Math.min(100, ((y2 - y1) / h) * 100),
  };
};

export default function WebcamModal({ token, blacklist = [], onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
const blackSet = useRef(new Set(blacklist.map(norm)));
  const scanAbortRef = useRef(null);
  const scanBusyRef = useRef(false);
  const scanIntervalRef = useRef(800);


  const [camState, setCamState] = useState('idle'); // idle | starting | live | error
  const [camError, setCamError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [autoScan, setAutoScan] = useState(true);
  const [lastResult, setLastResult] = useState(null);
  const [liveBoxes, setLiveBoxes] = useState([]); // bbox overlays for the current frame

  useEffect(() => {
    blackSet.current = new Set(blacklist.map(norm));
  }, [blacklist.map(norm).join('|')]);

  // Start webcam on mount, stop on unmount
  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      setCamState('starting');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCamState('live');
      } catch (err) {
        if (!cancelled) {
          setCamError(err.name === 'NotAllowedError' ? 'Camera permission denied.' : `Camera error: ${err.message}`);
          setCamState('error');
        }
      }
    };
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // POST a snapshot to the backend ANPR endpoint and publish to the live bus
  // INSTANT-RESPONSE: shows bounding box immediately, updates when backend responds
  const scanFrame = useCallback(async (reason = 'manual') => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    if (scanBusyRef.current) return;
    scanBusyRef.current = true;

    const fw = video.videoWidth || 640;
    const fh = video.videoHeight || 480;

    // PAYLOAD OPTIMIZATION: cap at 640px wide, JPEG 0.65 quality
    const MAX_W = 640;
    const scale = Math.min(1, MAX_W / fw);
    const cw = Math.round(fw * scale);
    const ch = Math.round(fh * scale);
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, cw, ch);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.65);

    // INSTANT VISUAL FEEDBACK: show bounding box immediately
    const instantBox = {
      left: 20, top: 30, width: 60, height: 40,
      plate: 'READING...', conf: 0, blacklisted: false,
      _pending: true, _pendingId: Date.now(),
    };
    setLiveBoxes([instantBox]);
    setScanning(true);

    // Publish a pending detection to the bus immediately
    const pendingDet = {
      id: 'pending-' + Date.now(),
      plate: 'READING...',
      vehicle: 'CAR',
      cameraId: 'WEB_CAM_LIVE',
      timestamp: Date.now(),
      conf: 0,
      bbox: null,
      blacklisted: false,
      source: 'WEBCAM',
      _pending: true,
    };
    publishDetection(pendingDet);

    scanAbortRef.current?.abort();
    const ac = new AbortController();
    scanAbortRef.current = ac;

    const t0 = performance.now();
    try {
      const res = await fetch(API_BASE + '/api/v1/detect-live-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify({ image_base64: dataUrl.split(',')[1], camera_id: 'WEB_CAM_LIVE', vehicle_type: 'CAR' }),
        signal: ac.signal,
      });
      const data = await res.json();
      const elapsed = performance.now() - t0;
      if (!res.ok) throw new Error(data.detail || 'Live-frame detection failed');

      // Adaptive interval based on response time
      scanIntervalRef.current = elapsed > 1500 ? 1500 : elapsed > 600 ? 1000 : 700;

      const fSize = data.frame_size || {};
      let framePlates = (data.frame_plates || []).map((d) => ({
        ...d,
        _box: bboxToPct(d.bbox, fSize.width || cw, fSize.height || ch),
      }));

      // If frame was scaled down, convert overlay back to original video size
      if (scale < 1) {
        framePlates = framePlates.map((d) => ({
          ...d,
          _box: d._box ? {
            left: d._box.left / scale,
            top: d._box.top / scale,
            width: d._box.width / scale,
            height: d._box.height / scale,
          } : null,
        }));
      }

      const freshDetections = (data.detections || []).map((d) => ({
        ...d,
        _box: bboxToPct(d.bbox, fSize.width || cw, fSize.height || ch),
      }));

      setLastResult({ ...data, detections: freshDetections, frame_plates: framePlates });

      // Update overlay with real detection data
      if (framePlates.length > 0) {
        setLiveBoxes(framePlates.filter((d) => d._box).map((d) => ({
          ...d._box,
          plate: d.plate,
          conf: d.conf,
          blacklisted: blackSet.current.has(norm(d.plate)) || !!d.blacklisted,
          _pending: false,
        })));
      } else {
        setLiveBoxes([{ left: 25, top: 35, width: 50, height: 30, plate: 'NO PLATE', conf: 0, blacklisted: false, _pending: false, _fallback: true }]);
      }

      // Publish real detections to bus
      const now = Date.now();
      (data.detections || []).forEach((d) => {
        publishDetection({
          id: d.id, plate: d.plate, vehicle: d.vehicle || 'CAR',
          cameraId: d.cameraId || 'WEB_CAM_LIVE',
          timestamp: Date.parse(d.timestamp) || now,
          conf: d.conf || 0.88, bbox: d.bbox || null,
          blacklisted: blackSet.current.has(norm(d.plate)) || !!d.blacklisted,
          source: 'WEBCAM',
        });
      });
    } catch (err) {
      if (err.name === 'AbortError') return;
      setLiveBoxes([{ left: 25, top: 35, width: 50, height: 30, plate: 'ERROR', conf: 0, blacklisted: false, _pending: false, _error: true }]);
      setLastResult({ status: 'error', detail: err.message });
      scanIntervalRef.current = 2000;
    } finally {
      setScanning(false);
      scanBusyRef.current = false;
    }
  }, [token]);
  // Auto-scan loop with adaptive interval (700ms-2s based on backend speed)
  useEffect(() => {
    if (!autoScan || camState !== 'live') return undefined;
    let timer = null;
    const tick = () => {
      if (!scanBusyRef.current) scanFrame('auto');
      timer = setTimeout(tick, scanIntervalRef.current);
    };
    timer = setTimeout(tick, scanIntervalRef.current);
    return () => { if (timer) clearTimeout(timer); };
  }, [autoScan, camState, scanFrame]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label="Live webcam ANPR">
      <div className="flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Camera size={17} className="text-emerald-400" aria-hidden="true" />
            <h2 className="font-mono text-xs font-bold tracking-[0.2em] text-slate-100">LIVE WEBCAM ANPR</h2>
            {camState === 'live' && (
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest text-emerald-300">
                <span className="block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" /> LIVE
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close webcam" className="rounded-md border border-slate-700 p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"><X size={14} /></button>
        </div>

        <div className="relative aspect-video bg-black">
          <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
          {/* Real-time plate bounding boxes from backend OCR pipeline */}
          {/* Bounding-box overlays — instant visual feedback */}
          {liveBoxes.map((b, i) => (
            <div
              key={`${b.plate}-${i}`}
              className={`pointer-events-none absolute rounded-sm border-2 ${b._pending ? 'animate-pulse' : ''} ${b._fallback ? 'border-dashed' : ''}`}
              style={{
                left: `${b.left}%`,
                top: `${b.top}%`,
                width: `${b.width}%`,
                height: `${b.height}%`,
                borderColor: b._pending ? 'rgba(34,211,238,0.85)' : b._fallback ? 'rgba(16,185,129,0.4)' : (b.blacklisted ? 'rgba(239,68,68,0.95)' : b._error ? 'rgba(127,29,29,0.95)' : 'rgba(16,185,129,0.95)'),
                boxShadow: b._pending ? '0 0 16px rgba(34,211,238,0.5)' : b._fallback ? 'none' : (b.blacklisted ? '0 0 14px rgba(239,68,68,0.55)' : b._error ? '0 0 14px rgba(127,29,29,0.5)' : '0 0 14px rgba(16,185,129,0.45)'),
                transition: 'all 0.2s ease-out',
              }}
            >
              <span
                className="absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-px font-mono text-[10px] font-bold tracking-widest"
                style={{
                  backgroundColor: b._pending ? 'rgba(22,78,99,0.92)' : b._fallback ? 'rgba(30,41,59,0.85)' : (b.blacklisted ? 'rgba(127,29,29,0.92)' : b._error ? 'rgba(127,29,29,0.92)' : 'rgba(6,78,59,0.92)'),
                  color: b._pending ? '#a5f3fc' : b._fallback ? '#94a3b8' : (b.blacklisted ? '#fecaca' : b._error ? '#fecaca' : '#a7f3d0'),
                }}
              >
                {b.plate}{!b._fallback && !b._pending && b.conf > 0 ? ` [${(b.conf * 100).toFixed(0)}%]` : ''}
              </span>
            </div>
          ))}

          <div className="pointer-events-none absolute inset-0 border-2 border-emerald-500/40">
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-emerald-400/30" />
            <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-emerald-400/30" />
            <span className="absolute left-2 top-2 h-4 w-4 border-l-2 border-t-2 border-emerald-400/80" />
            <span className="absolute right-2 top-2 h-4 w-4 border-r-2 border-t-2 border-emerald-400/80" />
            <span className="absolute bottom-2 left-2 h-4 w-4 border-b-2 border-l-2 border-emerald-400/80" />
            <span className="absolute bottom-2 right-2 h-4 w-4 border-b-2 border-r-2 border-emerald-400/80" />
            {scanning && <div className="absolute inset-x-0 h-0.5 bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.9)] animate-pulse" style={{ top: '50%' }} />}
          </div>
          {camState !== 'live' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 font-mono text-[11px] tracking-widest text-slate-400">
              {camState === 'starting' ? 'REQUESTING CAMERA ACCESS...' : camState === 'error' ? <span className="text-red-300">{camError}</span> : 'CAMERA OFFLINE'}
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />

        <div className="flex items-center gap-2 border-t border-slate-800/80 px-5 py-3.5">
          <button type="button" onClick={() => { setAutoScan(false); scanFrame(); }} disabled={camState !== 'live' || scanning} className="flex items-center gap-2 rounded-md border border-emerald-500/50 bg-emerald-500/15 px-3 py-2 font-mono text-xs font-bold tracking-widest text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-50">
            <Scan size={14} aria-hidden="true" />{scanning ? 'SCANNING...' : 'SCAN FRAME'}
          </button>
          <button type="button" onClick={() => setAutoScan((v) => !v)} aria-pressed={autoScan} disabled={camState !== 'live'} className={`flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-xs font-bold tracking-widest transition-colors disabled:opacity-50 ${autoScan ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25' : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'}`}>
            <Square size={12} aria-hidden="true" />AUTO {autoScan ? 'ON' : 'OFF'}
          </button>
          <div className="ml-auto flex items-center gap-2 font-mono text-[10px] tracking-widest text-slate-500">
            {lastResult?.engine && <span className="text-cyan-300/80">ENG: {lastResult.engine}</span>}
            {lastResult?.status === 'error' && <span className="text-red-300">ERR</span>}
            {lastResult?.detections?.length > 0 && <span className="text-emerald-300">{lastResult.detections.length} PLATE{lastResult.detections.length > 1 ? 'S' : ''} LOGGED</span>}
            {lastResult && lastResult.status !== 'error' && !(lastResult.detections?.length > 0) && <span className="text-slate-500">NO PLATE READ</span>}
            {lastResult?.debug?.length > 0 && (
              <span className="text-amber-400/80" title={lastResult.debug.join('\n')}>
                DEBUG: {lastResult.debug.length} attempt{lastResult.debug.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        {lastResult?.detail && (
          <div className="mx-5 mb-4 rounded-md border border-amber-600/40 bg-amber-950/30 px-3 py-2 font-mono text-[10px] tracking-wide text-amber-300">{lastResult.detail}</div>
        )}
        </div>
        {lastResult?.debug?.length > 0 && (
          <div className="mx-5 mb-3 rounded-md border border-amber-600/40 bg-amber-950/30 px-3 py-2 font-mono text-[10px] tracking-wide text-amber-300">
            <div className="font-bold">OCR DEBUG (hover for details):</div>
            {lastResult.debug.slice(0, 3).map((d, i) => (
              <div key={i} className="truncate">{d}</div>
            ))}
            {lastResult.debug.length > 3 && <div className="text-amber-400/60">+{lastResult.debug.length - 3} more…</div>}
          </div>
        )}
      </div>
    </div>
  );
}