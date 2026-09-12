import React from 'react';

export const CAMERAS = [
  { id: 'CAM-01', name: 'North Gate', sector: 'SEC-12 ENTRY' },
  { id: 'CAM-02', name: 'Highway Checkpoint', sector: 'NH-48 KM-14' },
  { id: 'CAM-03', name: 'City Junction', sector: 'INT-07 CROSS' },
];

export default function CameraToolbar({ activeId, onSelect }) {
  return (
    <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
      <div className="flex items-center gap-1.5 rounded-xl border border-slate-700/70 bg-slate-950/85 px-2 py-2 shadow-2xl shadow-black/60 backdrop-blur-md">
        <span className="hidden md:block px-1.5 font-mono text-[9px] font-semibold tracking-[0.3em] text-slate-500">
          FEED
        </span>
        {CAMERAS.map((cam) => {
          const active = cam.id === activeId;
          return (
            <button
              key={cam.id}
              type="button"
              onClick={() => onSelect(cam.id)}
              aria-pressed={active}
              title={`${cam.name} — ${cam.sector}`}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[11px] font-semibold transition-all duration-200 ${
                active
                  ? 'border-emerald-500/80 bg-emerald-500/10 text-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.28)]'
                  : 'border-transparent bg-slate-900/80 text-slate-400 hover:bg-slate-800/90 hover:text-slate-200'
              }`}
            >
              <span
                className={`block h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}
                aria-hidden="true"
              />
              {cam.id}
              <span
                className={`hidden lg:inline text-[10px] font-normal tracking-wide ${
                  active ? 'text-emerald-400/80' : 'text-slate-500'
                }`}
              >
                ({cam.name})
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
