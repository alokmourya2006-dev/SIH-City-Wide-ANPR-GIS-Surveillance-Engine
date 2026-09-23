import React, { useEffect, useState } from 'react';
import { ScanLine, Siren, Camera, Cpu } from 'lucide-react';

const CARD_BASE = 'rounded-xl border bg-slate-900/70 backdrop-blur-xl p-4 shadow-2xl shadow-cyan-950/30 flex items-center gap-3.5 min-w-0';

export default function MetricCards({ token, watchlist = [] }) {
  const [camStats, setCamStats] = useState({ total: 0, online: 0 });
  const [scans, setScans] = useState(0);
  const [load, setLoad] = useState(38);

  useEffect(() => {
    let alive = true;
    const fetchCameras = async () => {
      try {
        const res = await fetch('https://sih-city-wide-anpr-gis-surveillance.onrender.com/api/v1/cameras/status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!alive) return;
        const cams = data.cameras || [];
        setCamStats({ total: cams.length, online: cams.filter((c) => c.status === 'ONLINE').length });
      } catch { /* keep zeros */ }
    };
    const t = setInterval(() => {
      if (alive) { setScans((s) => s + Math.floor(Math.random() * 4)); setLoad(30 + Math.floor(Math.random() * 45)); }
    }, 3000);
    setScans(1284 + Math.floor(Math.random() * 300));
    fetchCameras();
    return () => { alive = false; clearInterval(t); };
  }, [token]);

  const cards = [
    { icon: ScanLine, label: 'TOTAL SCANS TODAY', value: scans.toLocaleString('en-IN'), accent: 'text-cyan-400', ring: 'border-cyan-500/20' },
    { icon: Siren, label: 'HOTLIST ALERTS', value: String(watchlist.length).padStart(2, '0'), accent: 'text-red-500', ring: 'border-red-500/30' },
    { icon: Camera, label: 'ACTIVE GRID CAMERAS', value: `${camStats.online}/${camStats.total || '—'}`, accent: 'text-emerald-400', ring: 'border-emerald-500/25' },
    { icon: Cpu, label: 'SYSTEM / GPU LOAD', value: `${load}%`, accent: load > 70 ? 'text-red-400' : 'text-cyan-400', ring: 'border-cyan-500/20' },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map(({ icon: Icon, label, value, accent, ring }) => (
        <div key={label} className={`${CARD_BASE} ${ring}`}>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700/70 bg-slate-950/70 ${accent}`}>
            <Icon size={18} />
          </div>
          <div className="min-w-0">
            <div className="truncate font-mono text-[10px] tracking-[0.15em] text-slate-500">{label}</div>
            <div className={`font-mono text-xl font-bold tabular-nums ${accent}`}>{value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}