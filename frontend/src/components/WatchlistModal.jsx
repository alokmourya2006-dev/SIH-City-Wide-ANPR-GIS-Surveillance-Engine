import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Plus, ShieldAlert, Trash2, X } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const SEV_STYLES = {
  CRITICAL: 'border-red-500/60 bg-red-500/10 text-red-300',
  HIGH: 'border-red-400/60 bg-red-400/10 text-red-300',
  MEDIUM: 'border-red-700/60 bg-red-700/10 text-red-300',
  LOW: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300',
};

const norm = (p) => String(p || '').toUpperCase().replace(/[\s-]/g, '');

export default function WatchlistModal({ token, watchlist = [], onChanged, onClose }) {
  const [plate, setPlate] = useState('');
  const [reason, setReason] = useState('');
  const [severity, setSeverity] = useState('HIGH');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState('');

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const refresh = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/v1/hotlist`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to load watchlist');
    onChanged(data.hotlist || []);
  }, [token, onChanged]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const cleanPlate = norm(plate);
    if (!cleanPlate) { setError('Enter a license plate number.'); return; }
    if (!reason.trim()) { setError('Enter a severity reason.'); return; }
    setBusy(true);
    setError('');
    try {
      if (token) {
        const res = await fetch(`${API_BASE}/api/v1/hotlist/add`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ plate_number: cleanPlate, reason: reason.trim(), severity }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to add plate');
        await refresh();
      } else {
        // Offline fallback: local-only state update
        onChanged([...watchlist, {
          id: `local-${Date.now()}`,
          plate_number: cleanPlate,
          reason: reason.trim(),
          severity,
          added_at: new Date().toISOString(),
        }]);
      }
      setPlate('');
      setReason('');
      setSeverity('HIGH');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (plateNumber) => {
    const cleanPlate = norm(plateNumber);
    setDeleting(cleanPlate);
    setError('');
    try {
      if (token) {
        const res = await fetch(`${API_BASE}/api/v1/hotlist/${encodeURIComponent(cleanPlate)}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok && res.status !== 404) throw new Error(data.detail || 'Failed to delete plate');
        await refresh();
      } else {
        onChanged(watchlist.filter((w) => norm(w.plate_number) !== cleanPlate));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting('');
    }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label="Watchlist management">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <ShieldAlert size={17} className="text-red-400" aria-hidden="true" />
            <h2 className="font-mono text-xs font-bold tracking-[0.2em] text-slate-100">WATCHLIST MANAGEMENT</h2>
            <span className="rounded-full bg-red-600/20 border border-red-500/40 px-2 py-0.5 font-mono text-[10px] font-bold text-red-300">{String(watchlist.length).padStart(2, '0')}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close watchlist" className="rounded-md border border-slate-700 p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"><X size={14} /></button>
        </div>
        <form onSubmit={handleAdd} className="border-b border-slate-800/80 px-5 py-4">
          <div className="grid grid-cols-2 gap-2.5">
            <label className="col-span-1 block">
              <span className="mb-1 block font-mono text-[10px] tracking-widest text-slate-500">PLATE NO.</span>
              <input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="UP32KT2112" maxLength={14} className="w-full rounded-md border border-slate-700 bg-black px-2.5 py-1.5 font-mono text-sm font-bold tracking-widest text-emerald-300 placeholder:text-slate-600 focus:border-emerald-500/60 focus:outline-none" />
            </label>
            <label className="col-span-1 block">
              <span className="mb-1 block font-mono text-[10px] tracking-widest text-slate-500">SEVERITY</span>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full rounded-md border border-slate-700 bg-black px-2.5 py-1.5 font-mono text-sm font-semibold text-slate-200 focus:border-emerald-500/60 focus:outline-none">
                {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <label className="mt-2.5 block">
            <span className="mb-1 block font-mono text-[10px] tracking-widest text-slate-500">REASON</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Stolen vehicle - fixA" maxLength={120} className="w-full rounded-md border border-slate-700 bg-black px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/60 focus:outline-none" />
          </label>
          {error && (<div className="mt-2.5 rounded-md border border-red-600/50 bg-red-950/40 px-2.5 py-1.5 font-mono text-[11px] tracking-wide text-red-300">{error}</div>)}
          <button type="submit" disabled={busy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-emerald-500/50 bg-emerald-500/15 px-3 py-2 font-mono text-xs font-bold tracking-widest text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-50">
            <Plus size={14} aria-hidden="true" />{busy ? 'ADDING...' : 'ADD TO WATCHLIST'}
          </button>
        </form>
        <div className="flex-1 overflow-y-auto space-y-2 px-5 py-4">
          {watchlist.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-700 px-3 py-8 text-center font-mono text-[11px] tracking-widest text-slate-500">WATCHLIST EMPTY</div>
          ) : (
            watchlist.map((entry) => {
              const key = entry.id ?? entry.plate_number;
              const isDeleting = deleting === norm(entry.plate_number);
              return (
                <div key={key} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded border border-red-500/40 bg-black px-2 py-0.5 font-mono text-sm font-bold tracking-widest text-red-300">{entry.plate_number}</span>
                      <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-widest ${SEV_STYLES[entry.severity] || SEV_STYLES.HIGH}`}>{entry.severity}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-slate-400">
                      <AlertTriangle size={11} className="shrink-0 text-amber-400" aria-hidden="true" />
                      <span className="truncate">{entry.reason || 'No reason recorded'}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => handleDelete(entry.plate_number)} disabled={isDeleting} aria-label="Remove from watchlist" title="Remove from watchlist" className="shrink-0 rounded-md border border-slate-700 p-1.5 text-slate-500 transition-colors hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"><Trash2 size={13} /></button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
