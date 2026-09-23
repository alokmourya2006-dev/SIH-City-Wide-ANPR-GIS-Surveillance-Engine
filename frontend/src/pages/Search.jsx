import React, { useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { Search as SearchIcon, MapPin, Clock } from 'lucide-react';
import L from 'leaflet';
import { useOutletContext } from 'react-router-dom';
import { authFetch } from '../api';

const cameraIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
  iconSize: [32, 32],
});

const formatCaptureTime = (iso) => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return `${date.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true, timeZone: 'Asia/Kolkata',
  })} IST`;
};

const formatLastCaptureTime = (results) => {
  const t = results?.trajectory;
  return formatCaptureTime(t && t.length > 0 ? t[t.length - 1].timestamp : null);
};

export default function Search() {
  const { token, setRefreshTrigger, onSessionExpired } = useOutletContext();
  const [plateNumber, setPlateNumber] = useState('UP32KT2112');
  const [caseFileId, setCaseFileId] = useState('INCIDENT_9021');
  const [results, setResults] = useState(null);
  const [routedCoordinates, setRoutedCoordinates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchRoadRoute = async (trajectoryPoints) => {
    if (!trajectoryPoints || trajectoryPoints.length < 2) {
      setRoutedCoordinates(trajectoryPoints.map((p) => [p.latitude, p.longitude]));
      return;
    }
    try {
      const cs = trajectoryPoints.map((p) => `${p.longitude},${p.latitude}`).join(';');
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${cs}?overview=full&geometries=geojson`);
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        setRoutedCoordinates(data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]));
      } else {
        setRoutedCoordinates(trajectoryPoints.map((p) => [p.latitude, p.longitude]));
      }
    } catch (err) {
      console.error('Routing error', err);
      setRoutedCoordinates(trajectoryPoints.map((p) => [p.latitude, p.longitude]));
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await authFetch('https://sih-city-wide-anpr-gis-surveillance.onrender.com/api/v1/trajectory/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plate_number: plateNumber, case_file_id: caseFileId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Authorization Failed');
      if (data.trajectory) data.trajectory.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
      setResults(data);
      if (data.trajectory && data.trajectory.length > 0) await fetchRoadRoute(data.trajectory);
      else setRoutedCoordinates([]);
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      setError(err.message);
      if (err.message.includes('expired') || err.message.includes('Invalid')) onSessionExpired();
    } finally {
      setLoading(false);
    }
  };

  const [vehicleType, setVehicleType] = useState('ALL');
  const [zone, setZone] = useState('ALL');
  const [hotlistOnly, setHotlistOnly] = useState(false);
  const [dateFilter, setDateFilter] = useState('');

  const statusOf = (hit, i) =>
    i === 0 ? 'ENTRY' : i === (results?.trajectory?.length || 0) - 1 ? 'LATEST' : 'PASS';

  return (
    <div className="text-slate-200">
      <h2 className="font-mono text-base font-bold tracking-widest text-cyan-400">
        ANPR SEARCH <span className="text-slate-500">//</span> TRAJECTORY INTELLIGENCE
      </h2>
      <p className="text-xs text-slate-500 mt-0.5 mb-4 font-mono tracking-wide">Trace vehicle movement across the city-wide camera mesh</p>
      <form onSubmit={handleSearch} className="rounded-xl border border-cyan-500/20 bg-slate-900/70 backdrop-blur-xl shadow-2xl shadow-cyan-950/40 p-4 mb-5">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <label className="col-span-2 flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-[0.15em] text-slate-500">PLATE NUMBER</span>
            <input type="text" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 font-mono text-sm text-cyan-300 tracking-widest outline-none focus:border-cyan-500"
              style={{ colorScheme: 'dark' }} required />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-[0.15em] text-slate-500">CASE FILE</span>
            <input type="text" value={caseFileId} onChange={(e) => setCaseFileId(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 font-mono text-sm text-slate-200 outline-none focus:border-cyan-500"
              style={{ colorScheme: 'dark' }} required />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-[0.15em] text-slate-500">DATE</span>
            <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950/80 px-2 py-2 font-mono text-xs text-slate-200 outline-none focus:border-cyan-500"
              style={{ colorScheme: 'dark' }} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-[0.15em] text-slate-500">VEHICLE TYPE</span>
            <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950/80 px-2 py-2 font-mono text-xs text-slate-200 outline-none focus:border-cyan-500">
              <option>ALL</option><option>CAR</option><option>BIKE</option><option>TRUCK</option><option>BUS</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-[0.15em] text-slate-500">ZONE</span>
            <select value={zone} onChange={(e) => setZone(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950/80 px-2 py-2 font-mono text-xs text-slate-200 outline-none focus:border-cyan-500">
              <option>ALL</option><option>HAZRATGANJ</option><option>GOMTI NAGAR</option><option>ALAMBAGH</option><option>CHARBAGH</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => setHotlistOnly((v) => !v)}
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-[11px] font-bold tracking-widest transition-colors ${
              hotlistOnly ? 'border-red-500/50 bg-red-500/15 text-red-400' : 'border-slate-700 bg-slate-950/60 text-slate-400 hover:text-slate-200'
            }`}>
            <span className={`h-2 w-2 rounded-full ${hotlistOnly ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}`} />
            HOTLIST MATCHES ONLY
          </button>
          <button type="submit"
            className="flex items-center gap-2 rounded-md border border-cyan-500/40 bg-cyan-500/15 px-5 py-2 font-mono text-xs font-bold tracking-widest text-cyan-300 transition-colors hover:bg-cyan-500/25 shadow-[0_0_18px_rgba(34,211,238,0.15)]">
            <SearchIcon size={15} /> {loading ? 'ROUTING…' : 'PLOT TRAJECTORY'}
          </button>
        </div>
      </form>
      {error && <div className="rounded-md border border-red-500/40 bg-red-950/40 text-red-300 px-4 py-3 text-sm font-mono mb-5">{error}</div>}
      <div className="search-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: '20px', alignItems: 'start', maxWidth: '100%', width: '100%', minWidth: 0, overflow: 'hidden' }}>
        <div className="search-map-box" style={{ backgroundColor: '#94a3b8', borderRadius: '8px', padding: '12px', height: '500px', width: '100%', minWidth: 0, maxWidth: '100%', overflow: 'hidden', position: 'relative', isolation: 'isolate', zIndex: 0 }}>
          <MapContainer center={[26.8467, 80.9462]} zoom={12} scrollWheelZoom={false} style={{ height: '100%', width: '100%', minHeight: '450px', maxWidth: '100%', borderRadius: '6px', overflow: 'hidden', position: 'relative', zIndex: 0 }}>
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {routedCoordinates.length > 0 && <Polyline positions={routedCoordinates} color="#22d3ee" weight={5} opacity={0.8} />}
            {results?.trajectory.map((hit, i) => (
              <Marker key={i} position={[hit.latitude, hit.longitude]} icon={cameraIcon}>
                <Popup><div style={{ color: '#164e63' }}><strong>{hit.location_name}</strong><br />Node: {hit.camera_id}<br />At: {formatCaptureTime(hit.timestamp)}</div></Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          <div className="rounded-xl border border-cyan-500/20 bg-slate-900/70 backdrop-blur-xl p-4 shadow-2xl shadow-cyan-950/30">
            <h3 className="font-mono text-[11px] font-bold tracking-[0.2em] text-cyan-400 m-0">AUDIT VERIFICATION</h3>
            <div className="mt-3 space-y-2 font-mono text-xs">
              <p className="flex justify-between m-0"><span className="text-slate-500">CASE</span><span className="text-slate-200">{results?.search_metadata?.case_file_id || 'N/A'}</span></p>
              <p className="flex justify-between m-0"><span className="text-slate-500">HITS</span><span className="text-cyan-300 font-bold">{results?.total_hits || 0}</span></p>
              <p className="flex justify-between m-0 gap-3"><span className="text-slate-500">LAST</span><span className="text-emerald-400 text-[10px] text-right">{formatLastCaptureTime(results)}</span></p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 backdrop-blur-xl p-4 flex-1 overflow-y-auto" style={{ maxHeight: '400px' }}>
            <h3 className="font-mono text-[11px] font-bold tracking-[0.2em] text-slate-400 m-0 mb-3">SPATIAL NODES</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {results?.trajectory.map((hit, i) => (
                <div key={i} className="rounded-md bg-slate-950/70 px-3 py-2.5" style={{ borderLeft: '2px solid #22d3ee' }}>
                  <div className="font-mono font-bold text-xs text-slate-200 flex items-center gap-1.5">
                    <MapPin size={13} className="text-cyan-400 shrink-0" /> {hit.location_name}
                  </div>
                  <div className="font-mono text-[10px] text-slate-500 mt-1 flex items-center gap-1.5">
                    <Clock size={11} className="text-emerald-400 shrink-0" /> {formatCaptureTime(hit.timestamp)}
                  </div>
                </div>
              )) || <p className="text-xs text-slate-600 font-mono">No data plotted yet.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* ── ANPR capture log table ── */}
      {results?.trajectory?.length > 0 && (
        <div className="mt-5 rounded-xl border border-cyan-500/20 bg-slate-900/70 backdrop-blur-xl shadow-2xl shadow-cyan-950/30 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
            <h3 className="font-mono text-[11px] font-bold tracking-[0.2em] text-cyan-400 m-0">ANPR CAPTURE LOG</h3>
            <span className="font-mono text-[10px] tracking-widest text-slate-500">{results.trajectory.length} RECORDS</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="bg-slate-950/70 text-slate-500 tracking-[0.15em] text-[10px] uppercase">
                  <th className="px-4 py-2.5 font-medium">Node</th>
                  <th className="px-4 py-2.5 font-medium">Plate</th>
                  <th className="px-4 py-2.5 font-medium">Location</th>
                  <th className="px-4 py-2.5 font-medium">Coordinates</th>
                  <th className="px-4 py-2.5 font-medium">Timestamp</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {results.trajectory.map((hit, i) => {
                  const st = statusOf(hit, i);
                  const badge = st === 'LATEST' ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
                    : st === 'ENTRY' ? 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10'
                    : 'text-slate-400 border-slate-600/50 bg-slate-800/50';
                  return (
                    <tr key={i} className="border-t border-slate-800/70 hover:bg-slate-950/50">
                      <td className="px-4 py-2.5 text-slate-300">{hit.camera_id}</td>
                      <td className="px-4 py-2.5">
                        <span className="rounded px-2 py-0.5 tracking-widest font-bold border text-cyan-300 border-cyan-500/30 bg-cyan-500/10">
                          {(hit.plate_number || plateNumber).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-200">{hit.location_name}</td>
                      <td className="px-4 py-2.5 text-slate-500 tabular-nums">{hit.latitude?.toFixed(4)}, {hit.longitude?.toFixed(4)}</td>
                      <td className="px-4 py-2.5 text-slate-400 text-[11px]">{formatCaptureTime(hit.timestamp)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded border px-2 py-0.5 text-[10px] font-bold tracking-widest ${badge}`}>{st}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
