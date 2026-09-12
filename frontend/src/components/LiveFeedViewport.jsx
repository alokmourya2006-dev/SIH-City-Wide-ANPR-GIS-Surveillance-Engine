import React, { useEffect, useRef, useState } from 'react';
import CameraToolbar, { CAMERAS } from './CameraToolbar';
import { Radio } from 'lucide-react';

const W = 960;
const H = 540;

const DETECTION_STYLES = {
  CAR: {
    label: 'CAR',
    stroke: 'rgba(34, 211, 238, 0.95)',
    glow: 'rgba(34, 211, 238, 0.35)',
    tagBg: 'rgba(8, 47, 62, 0.92)',
  },
  BIKE: {
    label: 'BIKE',
    stroke: 'rgba(251, 191, 36, 0.95)',
    glow: 'rgba(251, 191, 36, 0.35)',
    tagBg: 'rgba(69, 46, 3, 0.92)',
  },
};

const CAM_SCENES = {
  'CAM-01': { mode: 'gate', lanes: 3 },
  'CAM-02': { mode: 'highway', lanes: 4 },
  'CAM-03': { mode: 'junction', lanes: 4 },
};

let trackSeq = 0;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function makeVehicle(scene, index) {
  const type = Math.random() < 0.68 ? 'CAR' : 'BIKE';
  const v = {
    id: `trk-${trackSeq++}`,
    type,
    conf: (type === 'CAR' ? 0.84 : 0.74) + Math.random() * 0.1,
    speed: (type === 'CAR' ? 0.1 : 0.14) + Math.random() * 0.045,
    axis: 'v',
    sign: 1,
    lane: 0.5,
    t: Math.random() * 1.1 - 0.05,
  };
  if (scene.mode === 'gate') {
    v.axis = 'v';
    v.sign = 1;
    v.lane = [0.395, 0.5, 0.605][index % 3];
  } else if (scene.mode === 'highway') {
    v.axis = 'h';
    const lanes = [[0.4, 1], [0.5, 1], [0.61, -1], [0.7, -1]];
    const pair = lanes[index % 4];
    v.lane = pair[0];
    v.sign = pair[1];
  } else {
    const slot = index % 4;
    if (slot === 0) { v.axis = 'v'; v.sign = 1; v.lane = 0.445; }
    else if (slot === 1) { v.axis = 'h'; v.sign = 1; v.lane = 0.445; }
    else if (slot === 2) { v.axis = 'v'; v.sign = -1; v.lane = 0.555; }
    else { v.axis = 'h'; v.sign = -1; v.lane = 0.555; }
  }
  return v;
}

function vehicleBox(v) {
  const across = v.type === 'CAR' ? 0.052 : 0.028;
  const along = v.type === 'CAR' ? 0.135 : 0.072;
  const pos = v.sign > 0 ? v.t : 1 - v.t;
  const pad = 0.006;
  if (v.axis === 'v') {
    return { x: v.lane - across / 2 - pad, y: pos - along / 2 - pad, w: across + pad * 2, h: along + pad * 2 };
  }
  return { x: pos - along / 2 - pad, y: v.lane - across / 2 - pad, w: along + pad * 2, h: across + pad * 2 };
}
function drawRoadScene(ctx, mode) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#04070b');
  bg.addColorStop(1, '#02040a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  if (mode === 'gate') {
    ctx.fillStyle = '#0a0f15';
    ctx.fillRect(W * 0.24, 0, W * 0.52, H);
    const road = ctx.createLinearGradient(W * 0.3, 0, W * 0.7, 0);
    road.addColorStop(0, '#121a23');
    road.addColorStop(0.5, '#1b2530');
    road.addColorStop(1, '#121a23');
    ctx.fillStyle = road;
    ctx.fillRect(W * 0.3, 0, W * 0.4, H);
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W * 0.315, 0); ctx.lineTo(W * 0.315, H);
    ctx.moveTo(W * 0.685, 0); ctx.lineTo(W * 0.685, H);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
    ctx.lineWidth = 4;
    ctx.setLineDash([26, 22]);
    ctx.beginPath();
    ctx.moveTo(W * 0.435, 0); ctx.lineTo(W * 0.435, H);
    ctx.moveTo(W * 0.565, 0); ctx.lineTo(W * 0.565, H);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#dc2626' : '#e2e8f0';
      ctx.fillRect(W * (0.32 + i * 0.0305), H * 0.05, W * 0.028, 10);
    }
    ctx.fillStyle = 'rgba(226, 232, 240, 0.7)';
    ctx.fillRect(W * 0.315, H * 0.885, W * 0.37, 7);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = 'rgba(226, 232, 240, 0.45)';
      ctx.fillRect(W * (0.325 + i * 0.0445), H * 0.915, 12, H * 0.055);
    }
    ctx.fillStyle = 'rgba(16, 185, 129, 0.045)';
    ctx.fillRect(W * 0.3, 0, W * 0.4, H);
  } else if (mode === 'highway') {
    ctx.fillStyle = '#0a1210';
    ctx.fillRect(0, 0, W, H * 0.3);
    ctx.fillRect(0, H * 0.78, W, H * 0.22);
    const road = ctx.createLinearGradient(0, H * 0.3, 0, H * 0.78);
    road.addColorStop(0, '#151d27');
    road.addColorStop(0.5, '#202b38');
    road.addColorStop(1, '#151d27');
    ctx.fillStyle = road;
    ctx.fillRect(0, H * 0.3, W, H * 0.48);
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.315); ctx.lineTo(W, H * 0.315);
    ctx.moveTo(0, H * 0.775); ctx.lineTo(W, H * 0.775);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
    ctx.lineWidth = 4;
    ctx.setLineDash([30, 24]);
    ctx.beginPath();
    ctx.moveTo(0, H * 0.55); ctx.lineTo(W, H * 0.55);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.32)';
    for (let x = 8; x < W; x += 64) {
      ctx.fillRect(x, H * 0.275, 4, 13);
      ctx.fillRect(x, H * 0.788, 4, 13);
    }
    ctx.fillStyle = 'rgba(16, 185, 129, 0.035)';
    ctx.fillRect(0, H * 0.3, W, H * 0.48);
  } else {
    const hRoad = ctx.createLinearGradient(0, H * 0.36, 0, H * 0.64);
    hRoad.addColorStop(0, '#141c26');
    hRoad.addColorStop(0.5, '#1e2936');
    hRoad.addColorStop(1, '#141c26');
    ctx.fillStyle = hRoad;
    ctx.fillRect(0, H * 0.36, W, H * 0.28);
    const vRoad = ctx.createLinearGradient(W * 0.36, 0, W * 0.64, 0);
    vRoad.addColorStop(0, '#141c26');
    vRoad.addColorStop(0.5, '#1e2936');
    vRoad.addColorStop(1, '#141c26');
    ctx.fillStyle = vRoad;
    ctx.fillRect(W * 0.36, 0, W * 0.28, H);
    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.fillRect(W * 0.36, H * 0.36, W * 0.28, H * 0.28);
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.375); ctx.lineTo(W, H * 0.375);
    ctx.moveTo(0, H * 0.625); ctx.lineTo(W, H * 0.625);
    ctx.moveTo(W * 0.375, 0); ctx.lineTo(W * 0.375, H);
    ctx.moveTo(W * 0.625, 0); ctx.lineTo(W * 0.625, H);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
    ctx.lineWidth = 4;
    ctx.setLineDash([24, 20]);
    ctx.beginPath();
    ctx.moveTo(0, H * 0.5); ctx.lineTo(W * 0.36, H * 0.5);
    ctx.moveTo(W * 0.64, H * 0.5); ctx.lineTo(W, H * 0.5);
    ctx.moveTo(W * 0.5, 0); ctx.lineTo(W * 0.5, H * 0.36);
    ctx.moveTo(W * 0.5, H * 0.64); ctx.lineTo(W * 0.5, H);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(226, 232, 240, 0.65)';
    ctx.fillRect(W * 0.375, H * 0.33, W * 0.24, 6);
    ctx.fillRect(W * 0.33, H * 0.375, 6, H * 0.24);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
    const cornerPairs = [[0.345, 0.345], [0.63, 0.345], [0.345, 0.63], [0.63, 0.63]];
    cornerPairs.forEach(function (pair) {
      ctx.fillRect(W * pair[0], H * pair[1], 18, 18);
    });
    ctx.fillStyle = 'rgba(16, 185, 129, 0.035)';
    ctx.fillRect(W * 0.36, H * 0.36, W * 0.28, H * 0.28);
  }
}

function drawStaticNoise(ctx) {
  ctx.fillStyle = '#030507';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 240; i++) {
    ctx.fillStyle = 'rgba(148, 163, 184, ' + (Math.random() * 0.16).toFixed(3) + ')';
    ctx.fillRect(Math.random() * W, Math.random() * H, Math.random() * 80 + 12, Math.random() * 3 + 1);
  }
}
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawVehicle(ctx, v) {
  const across = v.type === 'CAR' ? 0.052 : 0.028;
  const along = v.type === 'CAR' ? 0.135 : 0.072;
  const pos = v.sign > 0 ? v.t : 1 - v.t;
  let x; let y; let wpx; let lpx; let rot;
  if (v.axis === 'v') {
    x = v.lane * W; y = pos * H;
    wpx = across * W; lpx = along * H;
    rot = v.sign > 0 ? 0 : Math.PI;
  } else {
    x = pos * W; y = v.lane * H;
    wpx = along * W; lpx = across * H;
    rot = v.sign > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  const w2 = wpx / 2;
  const l2 = lpx / 2;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);

  const glow = ctx.createRadialGradient(0, l2, 2, 0, l2, wpx * 1.5);
  glow.addColorStop(0, 'rgba(254, 243, 199, 0.28)');
  glow.addColorStop(1, 'rgba(254, 243, 199, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-wpx * 1.5, l2 - 2, wpx * 3, lpx * 1.3);

  ctx.fillStyle = v.type === 'CAR' ? '#1f2b3a' : '#2a2418';
  roundRectPath(ctx, -w2, -l2, wpx, lpx, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (v.type === 'CAR') {
    ctx.fillStyle = 'rgba(125, 211, 252, 0.3)';
    roundRectPath(ctx, -w2 + 4, -l2 + lpx * 0.3, wpx - 8, lpx * 0.32, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(125, 211, 252, 0.15)';
    roundRectPath(ctx, -w2 + 5, -l2 + lpx * 0.72, wpx - 10, lpx * 0.16, 2);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(253, 224, 71, 0.55)';
    ctx.beginPath();
    ctx.arc(0, -lpx * 0.04, Math.min(wpx, lpx) * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(254, 252, 232, 0.95)';
  ctx.fillRect(-w2 + 2, l2 - 3, 6, 3);
  ctx.fillRect(w2 - 8, l2 - 3, 6, 3);
  ctx.fillStyle = 'rgba(248, 113, 113, 0.95)';
  ctx.fillRect(-w2 + 2, -l2, 5, 3);
  ctx.fillRect(w2 - 7, -l2, 5, 3);

  ctx.restore();
}
const formatClock = (d) => d.toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' }) + ' IST';

export default function LiveFeedViewport({ defaultCameraId = 'CAM-01' }) {
  const canvasRef = useRef(null);
  const switchingRef = useRef(false);
  const switchTimerRef = useRef(null);
  const [activeCamId, setActiveCamId] = useState(defaultCameraId);
  const [switching, setSwitching] = useState(false);
  const [boxes, setBoxes] = useState([]);
  const [fps, setFps] = useState(0);
  const [clock, setClock] = useState(() => formatClock(new Date()));

  const activeCam = CAMERAS.find((c) => c.id === activeCamId);

  useEffect(() => {
    const id = setInterval(() => setClock(formatClock(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const scene = CAM_SCENES[activeCamId];
    const vehicles = Array.from({ length: scene.lanes + 2 }, (_, i) => makeVehicle(scene, i));
    let raf;
    let last = performance.now();
    let fpsCount = 0;
    let fpsWindow = last;

    const tick = (now) => {
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      if (switchingRef.current) {
        drawStaticNoise(ctx);
        setBoxes([]);
      } else {
        vehicles.forEach((v) => {
          v.t += v.speed * dt;
          v.conf = clamp(v.conf + (Math.random() - 0.5) * 0.014, 0.55, 0.98);
          if (v.t > 1.12) {
            const fresh = makeVehicle(scene, Math.floor(Math.random() * 4));
            Object.assign(v, fresh, { t: -0.12 });
          }
        });
        drawRoadScene(ctx, scene.mode);
        vehicles.forEach((v) => drawVehicle(ctx, v));
        setBoxes(vehicles.map((v) => {
          const b = vehicleBox(v);
          return { id: v.id, type: v.type, conf: v.conf, x: b.x, y: b.y, w: b.w, h: b.h };
        }));
      }
      fpsCount += 1;
      if (now - fpsWindow >= 1000) {
        setFps(fpsCount);
        fpsCount = 0;
        fpsWindow = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (switchTimerRef.current) window.clearTimeout(switchTimerRef.current);
    };
  }, [activeCamId]);

  const handleSelectCamera = (camId) => {
    if (camId === activeCamId) return;
    switchingRef.current = true;
    setSwitching(true);
    setActiveCamId(camId);
    if (switchTimerRef.current) window.clearTimeout(switchTimerRef.current);
    switchTimerRef.current = window.setTimeout(() => {
      switchingRef.current = false;
      setSwitching(false);
    }, 450);
  };

  return (
    <div className="relative bg-zinc-950 border border-slate-800/80 rounded-xl overflow-hidden flex-1 shadow-2xl flex flex-col min-h-[460px]">
      <div className="flex items-center justify-between border-b border-slate-800/60 bg-slate-950/80 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-emerald-400" aria-hidden="true" />
          <span className="font-mono text-[11px] font-semibold tracking-[0.2em] text-slate-300">
            LIVE FEED VIEWPORT
          </span>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px]">
          <span className="text-sky-300">TRACKS: {String(boxes.length).padStart(2, '0')}</span>
          <span className="text-slate-500">DET-OVERLAY: ANPR / YOLO</span>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <canvas ref={canvasRef} width={W} height={H} className="absolute inset-0 h-full w-full select-none" />

        {boxes.map((b) => {
          const s = DETECTION_STYLES[b.type];
          return (
            <div
              key={b.id}
              className="absolute pointer-events-none rounded-[2px]"
              style={{
                left: (b.x * 100) + '%',
                top: (b.y * 100) + '%',
                width: (b.w * 100) + '%',
                height: (b.h * 100) + '%',
                border: '1.5px solid ' + s.stroke,
                boxShadow: '0 0 12px ' + s.glow,
              }}
            >
              <span
                className={'absolute left-0 whitespace-nowrap rounded-sm px-1 py-[1px] font-mono text-[10px] font-semibold tracking-wide ' + (b.y < 0.07 ? 'top-full mt-1' : '-top-[18px]')}
                style={{ backgroundColor: s.tagBg, color: s.stroke }}
              >
                {s.label} [{b.conf.toFixed(2)}]
              </span>
            </div>
          );
        })}

        <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0 1px, transparent 1px 3px)' }} aria-hidden="true" />
        <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 130px rgba(0,0,0,0.85)' }} aria-hidden="true" />

        <div className="absolute left-3 top-3 h-6 w-6 border-l-2 border-t-2 border-emerald-400/50 pointer-events-none" aria-hidden="true" />
        <div className="absolute right-3 top-3 h-6 w-6 border-r-2 border-t-2 border-emerald-400/50 pointer-events-none" aria-hidden="true" />
        <div className="absolute left-3 bottom-3 h-6 w-6 border-l-2 border-b-2 border-emerald-400/50 pointer-events-none" aria-hidden="true" />
        <div className="absolute right-3 bottom-3 h-6 w-6 border-r-2 border-b-2 border-emerald-400/50 pointer-events-none" aria-hidden="true" />

        <div className="absolute left-6 top-6 flex items-center gap-3 pointer-events-none">
          <span className="flex items-center gap-1.5 rounded-sm bg-red-600/90 px-1.5 py-[2px] font-mono text-[10px] font-bold tracking-widest text-white">
            <span className="block h-1.5 w-1.5 rounded-full bg-white animate-pulse" aria-hidden="true" />
            REC
          </span>
          <span className="font-mono text-xs font-semibold tracking-widest text-slate-100">
            {activeCam.id}
          </span>
          <span className="hidden sm:inline font-mono text-[10px] tracking-widest text-emerald-300/90">
            {activeCam.name.toUpperCase()} - {activeCam.sector}
          </span>
        </div>

        <div className="absolute right-6 top-6 flex items-center gap-3 font-mono text-[10px] tracking-widest text-slate-300 pointer-events-none">
          <time className="tabular-nums text-emerald-300">{clock}</time>
          <span>{String(fps).padStart(2, '0')} FPS</span>
          <span className="hidden md:inline text-slate-500">1920x1080 - H.264</span>
        </div>

        <div className="absolute left-6 bottom-6 font-mono text-[10px] tracking-[0.25em] text-slate-400 pointer-events-none">
          OVERLAY: DET-BOXES [ON]
        </div>

        {switching && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/40">
            <span className="font-mono text-xs tracking-[0.35em] text-slate-200 animate-pulse">
              REACQUIRING SIGNAL...
            </span>
          </div>
        )}

        <CameraToolbar activeId={activeCamId} onSelect={handleSelectCamera} />
      </div>
    </div>
  );
}
