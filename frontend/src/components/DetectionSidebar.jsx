import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bike, CarFront, Radio } from 'lucide-react';
import { CAMERAS } from './CameraToolbar';
import { publishDetection } from '../detectionBus';

const PLATE_POOL = [
  'UP32KT2112', 'MH12DE1432', 'DL8CAF5010', 'GJ01RT8845',
  'KA05MN2310', 'RJ14CB9921', 'HR26DQ4420', 'UP16CT7788',
  'TN09AX1102', 'WB06J6034', 'MH02EQ5566', 'DL1CAB1234',
];

const DEFAULT_BLACKLIST = ['UP32KT2112', 'DL8CAF5010', 'MH12DE1432'];

const REGIONS = ['UP32', 'MH12', 'DL8C', 'GJ01', 'KA05', 'RJ14', 'HR26', 'UP16'];
const LETTERS = 'ABCDEFGHJKLMNPRSTUWXYZ';

const rand = (n) => Math.floor(Math.random() * n);

function randomPlate() {
  const region = REGIONS[rand(REGIONS.length)];
  const suffix = LETTERS[rand(LETTERS.length)] + LETTERS[rand(LETTERS.length)] + String(1000 + rand(9000));
  return region + suffix;
}

function formatDetTime(ts) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' });
}

function ConfidenceBar({ value, alert }) {
  const pct = Math.round(value * 100);
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between font-mono text-[10px] tracking-widest">
        <span className={alert ? 'text-red-400' : 'text-slate-500'}>CONFIDENCE</span>
        <span className={alert ? 'text-red-300' : 'text-emerald-300'}>{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className={'h-full rounded-full transition-all duration-500 ' + (alert ? 'bg-red-500' : 'bg-emerald-500')}
          style={{ width: pct + '%' }}
        />
      </div>
    </div>
  );
}

function DetectionCard({ det }) {
  const alert = det.blacklisted;
  const VehicleIcon = det.vehicle === 'BIKE' ? Bike : CarFront;
  return (
    <div
      className={alert
        ? 'rounded-lg bg-red-950/30 border border-red-600/80 animate-pulse p-3 det-in'
        : 'rounded-lg border border-slate-800 bg-slate-950/60 p-3 det-in'}
    >
      {alert && (
        <div className="mb-2 rounded bg-red-600/90 px-2 py-1 font-mono text-[10px] font-bold tracking-widest text-white">
          {'\u26A0\uFE0F BLACKLISTED VEHICLE DETECTED'}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span
          className={alert
            ? 'rounded border border-red-500/50 bg-black px-2.5 py-1 font-mono text-sm font-bold tracking-widest text-red-400'
            : 'rounded border border-emerald-500/40 bg-black px-2.5 py-1 font-mono text-sm font-bold tracking-widest text-emerald-400'}
        >
          {det.plate}
        </span>
        <span className="flex items-center gap-1.5 rounded-md border border-slate-700/70 bg-slate-900/70 px-2 py-1 font-mono text-[10px] font-semibold tracking-widest text-slate-300">
          <VehicleIcon size={13} className={det.vehicle === 'BIKE' ? 'text-amber-400' : 'text-cyan-400'} aria-hidden="true" />
          {det.vehicle}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-[10px] tracking-widest">
        <span className="text-cyan-300">{det.cameraId}</span>
        <span className="tabular-nums text-slate-500">{formatDetTime(det.timestamp)}</span>
      </div>
      <ConfidenceBar value={det.conf} alert={alert} />
    </div>
  );
}

export default function DetectionSidebar({ token, refreshTrigger, blacklist, maxItems, intervalMs }) {
  const activeBlacklist = blacklist && blacklist.length > 0 ? blacklist : DEFAULT_BLACKLIST;
  const cap = maxItems || 20;
  const cadence = intervalMs || 2600;
  const [detections, setDetections] = useState([]);
  const [edgeError, setEdgeError] = useState('');
  const idSeq = useRef(0);
  const seenEdge = useRef(new Set());
  const norm = (p) => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const blackSet = useRef(new Set(activeBlacklist.map(norm)));

  useEffect(() => {
    blackSet.current = new Set(activeBlacklist.map(norm));
  }, [activeBlacklist.join('|')]);

  const pushDet = useCallback((det) => {
    setDetections((prev) => [det, ...prev].slice(0, cap));
    publishDetection(det);
  }, [cap]);

  useEffect(() => {
    const tick = () => {
      const cam = CAMERAS[rand(CAMERAS.length)];
      const plate = Math.random() < 0.6 ? PLATE_POOL[rand(PLATE_POOL.length)] : randomPlate();
      const vehicle = Math.random() < 0.72 ? 'CAR' : 'BIKE';
      const conf = vehicle === 'CAR' ? 0.81 + Math.random() * 0.17 : 0.72 + Math.random() * 0.22;
      idSeq.current += 1;
      pushDet({
        id: 'sim-' + Date.now() + '-' + idSeq.current,
        plate,
        vehicle,
        cameraId: cam.id,
        timestamp: Date.now(),
        conf: Math.min(0.99, conf),
        blacklisted: blackSet.current.has(norm(plate)),
        source: 'SIM',
      });
    };
    tick();
    const id = setInterval(tick, cadence);
    return () => clearInterval(id);
  }, [cadence, pushDet, refreshTrigger]);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    const pollEdge = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/v1/cameras/status', {
          headers: { Authorization: 'Bearer ' + token },
        });
        const data = await res.json();
        if (cancelled || !res.ok) return;
        (data.cameras || []).forEach((cam) => {
          if (!cam.last_plate) return;
          const key = norm(cam.last_plate) + '|' + cam.camera_id;
          if (seenEdge.current.has(key)) return;
          seenEdge.current.add(key);
          idSeq.current += 1;
          pushDet({
            id: 'edge-' + Date.now() + '-' + idSeq.current,
            plate: String(cam.last_plate).toUpperCase(),
            vehicle: 'CAR',
            cameraId: cam.camera_id,
            timestamp: cam.last_seen ? Date.parse(cam.last_seen) : Date.now(),
            conf: 0.9,
            blacklisted: blackSet.current.has(norm(cam.last_plate)),
            source: 'EDGE',
          });
        });
        setEdgeError('');
      } catch (err) {
        if (!cancelled) setEdgeError('edge feed unreachable');
      }
    };
    pollEdge();
    const id = setInterval(pollEdge, 12000);
    return () => { cancelled = true; clearInterval(id); };
  }, [token, pushDet]);

  const alertCount = detections.filter((d) => d.blacklisted).length;

  return (
    <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl flex flex-col h-full overflow-hidden p-4">
      <style>{'.det-in{animation:detIn .35s ease-out}@keyframes detIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}'}</style>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-emerald-400" aria-hidden="true" />
          <h3 className="font-mono text-[11px] font-semibold tracking-[0.2em] text-slate-200">
            LIVE DETECTION STREAM
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          {alertCount > 0 && (
            <span className="rounded-full bg-red-600 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
              {String(alertCount).padStart(2, '0')}
            </span>
          )}
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-widest text-emerald-300">
            <span className="block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
            LIVE {String(detections.length).padStart(2, '0')}
          </span>
        </div>
      </div>

      <div className="mt-3 flex-1 min-h-0 max-h-[450px] overflow-y-auto space-y-3 pr-1">
        {edgeError && (
          <div className="rounded-md border border-amber-600/40 bg-amber-950/30 px-2.5 py-1.5 font-mono text-[10px] tracking-widest text-amber-300">
            EDGE LINK: {edgeError.toUpperCase()} - SIM LINK ACTIVE
          </div>
        )}
        {detections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 px-3 py-8 text-center font-mono text-[11px] tracking-widest text-slate-500">
            AWAITING FIRST DETECTION...
          </div>
        ) : (
          detections.map((det) => <DetectionCard key={det.id} det={det} />)
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-800/70 pt-2.5 font-mono text-[10px] tracking-widest text-slate-500">
        <span>SRC: ANPR-EDGE + SIM</span>
        <span className="text-slate-400">WATCH: {String(activeBlacklist.length).padStart(2, '0')}</span>
      </div>
    </div>
  );
}

