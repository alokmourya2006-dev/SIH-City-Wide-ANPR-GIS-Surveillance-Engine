import React, { useEffect, useState } from 'react';

const pad = (n) => String(n).padStart(2, '0');

const formatClock = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
  `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ` +
  `${d.getHours() < 12 ? 'AM' : 'PM'} IST`;

export default function HeaderBar({ activeCameras = 3, watchlistCount = 0, onOpenWatchlist, onOpenWebcam, defaultCamId = 'CAM-01' }) {
  const [clock, setClock] = useState(() => formatClock(new Date()));
  const [audioOn, setAudioOn] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setClock(formatClock(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-6 flex items-center justify-between">
      {/* ── Left: branding + live status pill ── */}
      <div className="flex items-center gap-4 min-w-0">
        <h1 className="text-sm font-mono font-semibold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-300 to-slate-200 whitespace-nowrap">
          CINEMA JUNCTION // COMMAND CENTER
        </h1>

        <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-3 py-1">
          <span
            className="block h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.9)]"
            aria-hidden="true"
          />
          <span className="text-[11px] font-mono font-semibold text-emerald-400 tracking-wide">
            SYS: ONLINE / SECURE
          </span>
        </div>
      </div>

      {/* ── Center: real-time clock + active camera counter ── */}
      <div className="hidden md:flex items-center gap-6">
        <time className="font-mono text-xs tracking-widest text-emerald-300 tabular-nums">
          {clock}
        </time>

        <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900/70 px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          <span className="font-mono text-xs font-semibold text-sky-300">
            CAM-ACTIVE: {String(activeCameras).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* ── Right: watchlist + audio toggle + status indicators + attribution ── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (onOpenWebcam) onOpenWebcam(defaultCamId);
          }}
          aria-label="Start live camera ANPR"
          title={`Start Live Camera (Hazratganj — ${defaultCamId})`}
          className="flex items-center gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 font-mono text-[11px] font-bold tracking-widest text-cyan-300 transition-colors hover:bg-cyan-500/20"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M23 7l-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          <span className="hidden sm:inline">LIVE CAM</span>
        </button>

        <button
          type="button"
          onClick={onOpenWatchlist}
          aria-label="Open watchlist management"
          title="Watchlist management"
          className="flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 font-mono text-[11px] font-bold tracking-widest text-red-300 transition-colors hover:bg-red-500/20"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="hidden sm:inline">WATCHLIST</span>
          <span className="rounded-full bg-red-600 px-1.5 py-px text-[10px] leading-none text-white">
            {String(watchlistCount).padStart(2, '0')}
          </span>
        </button>

        {/* System status indicators */}
        <div className="hidden lg:flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            GIS
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            ANPR
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden="true" />
            FEED
          </span>
        </div>

        {/* Audio alert toggle */}
        <button
          type="button"
          onClick={() => setAudioOn((v) => !v)}
          aria-pressed={audioOn}
          aria-label={audioOn ? 'Mute audio alerts' : 'Enable audio alerts'}
          title={audioOn ? 'Audio alerts: ON' : 'Audio alerts: OFF'}
          className={`rounded-md border p-1.5 transition-colors ${
            audioOn
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
              : 'border-slate-700 bg-slate-900 text-slate-500 hover:text-slate-300'
          }`}
        >
          {audioOn ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18.5 5.5a9 9 0 0 1 0 13" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="22" y1="9" x2="16" y2="15" />
              <line x1="16" y1="9" x2="22" y2="15" />
            </svg>
          )}
        </button>

        {/* Operator attribution */}
        <div className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/70 px-2.5 py-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">BY</span>
          <span className="font-mono text-xs font-semibold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
            ALOK MAURYA
          </span>
        </div>
      </div>
    </header>
  );
}
