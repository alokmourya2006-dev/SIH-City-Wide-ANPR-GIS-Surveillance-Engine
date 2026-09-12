import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { ShieldAlert, Search, LogOut, Lock, MapPin, Clock } from 'lucide-react';
import L from 'leaflet';
import AlertFeed from './components/AlertFeed';
import AnalyticsPanel from './components/AnalyticsPanel';
import CameraStatusBar from './components/CameraStatusBar';
import LiveCameraFeed from './components/LiveCameraFeed';
import CameraRegisterPanel from './components/CameraRegisterPanel';
import MacroAnalytics from './components/MacroAnalytics';
import WatchlistModal from './components/WatchlistModal';
import { authFetch, isTokenExpired, clearStoredToken } from './api';
import WebcamModal from './components/WebcamModal';
import HeaderBar from './components/HeaderBar';
import LiveFeedViewport from './components/LiveFeedViewport';
import DetectionSidebar from './components/DetectionSidebar';
import './index.css';

// Hazratganj sector (CAM-01) loads first by default when LIVE CAM is clicked
const DEFAULT_CAM_ID = 'CAM-01';

const cameraIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
  iconSize: [32, 32],
});

// Convert raw ISO-8601 UTC timestamp into a readable IST capture time
const formatCaptureTime = (iso) => {
  if (!iso) return 'â€”';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return `${date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  })} IST`;
};

// Most recent capture time across a trajectory result set
const formatLastCaptureTime = (results) => {
  const t = results?.trajectory;
  return formatCaptureTime(t && t.length > 0 ? t[t.length - 1].timestamp : null);
};

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('police_token') || '');
  const [badgeIdInput, setBadgeIdInput] = useState('POLICE_7082');
  const [passwordInput, setPasswordInput] = useState('admin123');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const [plateNumber, setPlateNumber] = useState('UP32KT2112');
  const [caseFileId, setCaseFileId] = useState('INCIDENT_9021');
  const [results, setResults] = useState(null);
  const [routedCoordinates, setRoutedCoordinates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [watchlist, setWatchlist] = useState([]);
  const [showWatchlist, setShowWatchlist] = useState(false);

  // Graceful 401 handling: any component hitting an expired/invalid token
  // clears storage and fires 'auth:expired' → we drop back to the login screen.
  useEffect(() => {
    const onAuthExpired = () => {
      setToken('');
      setError('Session expired — please sign in again.');
    };
    window.addEventListener('auth:expired', onAuthExpired);
    return () => window.removeEventListener('auth:expired', onAuthExpired);
  }, []);

    // Validate the persisted token on first load; drop stale ones before any
  // API call can 401-loop.
  useEffect(() => {
    if (token && isTokenExpired(token)) {
      clearStoredToken();
      setToken('');
      setError('Session expired — please sign in again.');
    }
  }, []);
  const [showWebcam, setShowWebcam] = useState(false);
  const [activeCameraId, setActiveCameraId] = useState(DEFAULT_CAM_ID);


  const loadWatchlist = useCallback(async (authToken) => {
    if (authToken) {
      try {
        const res = await authFetch('http://127.0.0.1:8000/api/v1/hotlist', { headers: { 'Authorization': `Bearer ${authToken}` } });
        const data = await res.json();
        if (res.ok) { setWatchlist(data.hotlist || []); return; }
      } catch { /* fall through to fallback */ }
    }
    setWatchlist((prev) => prev.length > 0 ? prev : [
      { id: 'seed-1', plate_number: 'UP32KT2112', reason: 'Stolen vehicle', severity: 'CRITICAL', added_at: null },
      { id: 'seed-2', plate_number: 'DL8CAF5010', reason: 'Hit-and-run suspect', severity: 'HIGH', added_at: null },
      { id: 'seed-3', plate_number: 'MH12DE1432', reason: 'Unpaid challans', severity: 'MEDIUM', added_at: null },
    ]);
  }, []);

  useEffect(() => { loadWatchlist(token); }, [token, loadWatchlist]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const formData = new URLSearchParams();
    formData.append('username', badgeIdInput);
    formData.append('password', passwordInput);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Authentication failed');
      
      localStorage.setItem('police_token', data.access_token);
      setToken(data.access_token);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('police_token');
    setToken('');
    setResults(null);
    setRoutedCoordinates([]);
  };

  const fetchRoadRoute = async (trajectoryPoints) => {
    if (!trajectoryPoints || trajectoryPoints.length < 2) {
      setRoutedCoordinates(trajectoryPoints.map(p => [p.latitude, p.longitude]));
      return;
    }

    try {
      const coordsString = trajectoryPoints.map(p => `${p.longitude},${p.latitude}`).join(';');
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`);
      const data = await res.json();

      if (data.routes && data.routes.length > 0) {
        const formattedCoords = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
        setRoutedCoordinates(formattedCoords);
      } else {
        setRoutedCoordinates(trajectoryPoints.map(p => [p.latitude, p.longitude]));
      }
    } catch (err) {
      console.error("Routing error, falling back to straight coordinates", err);
      setRoutedCoordinates(trajectoryPoints.map(p => [p.latitude, p.longitude]));
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await authFetch('http://127.0.0.1:8000/api/v1/trajectory/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plate_number: plateNumber, case_file_id: caseFileId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Authorization Failed');
      
      // Sort hits chronologically so the route draws in capture order
      if (data.trajectory) {
        data.trajectory.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
      }
      setResults(data);
      if (data.trajectory && data.trajectory.length > 0) {
        await fetchRoadRoute(data.trajectory);
      } else {
        setRoutedCoordinates([]);
      }
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      setError(err.message);
      if (err.message.includes('expired') || err.message.includes('Invalid')) handleLogout();
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'sans-serif', color: '#fff' }}>
        <form onSubmit={handleLogin} style={{ backgroundColor: '#1e293b', padding: '32px', borderRadius: '12px', border: '1px solid #334155', width: '360px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <ShieldAlert color="#38bdf8" size={36} />
            <div>
              <h2 style={{ margin: 0, fontSize: '18px' }}>Police Surveillance Gateway</h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Law Enforcement Access Only</p>
            </div>
          </div>

          {error && <div style={{ backgroundColor: '#450a0a', color: '#fca5a5', padding: '8px', borderRadius: '4px', fontSize: '12px', marginBottom: '16px' }}>{error}</div>}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: '#94a3b8' }}>Badge ID</label>
            <input type="text" value={badgeIdInput} onChange={e => setBadgeIdInput(e.target.value)} style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#fff', padding: '10px', borderRadius: '6px', marginTop: '4px' }} required />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontSize: '12px', color: '#94a3b8' }}>Passcode</label>
            <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#fff', padding: '10px', borderRadius: '6px', marginTop: '4px' }} required />
          </div>

          <button type="submit" style={{ width: '100%', backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            <Lock size={16} /> Authenticate Session
          </button>
        </form>
      </div>
    );
  }

    return (
    <div style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <HeaderBar
        watchlistCount={watchlist.length}
        onOpenWatchlist={() => setShowWatchlist(true)}
        onOpenWebcam={(camId = DEFAULT_CAM_ID) => { setActiveCameraId(camId); setShowWebcam(true); }}
        defaultCamId={DEFAULT_CAM_ID}
      />
      {showWatchlist && (
        <WatchlistModal token={token} watchlist={watchlist} onChanged={setWatchlist} onClose={() => setShowWatchlist(false)} />
      )}
      {showWebcam && (
        <WebcamModal token={token} blacklist={watchlist.map((w) => w.plate_number)} onClose={() => setShowWebcam(false)} />
      )}

      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldAlert color="#38bdf8" size={32} />
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>City-Wide ANPR GIS Surveillance Engine</h1>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Real-time Node Telemetry & Spatial Reconstruction</p>
          </div>
        </div>
        <button onClick={handleLogout} style={{ backgroundColor: '#334155', color: '#f8fafc', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <LogOut size={16} /> Session Logout
        </button>
      </header>

      <form onSubmit={handleSearch} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
        <input type="text" placeholder="Target Plate (e.g. UP32KT2112)" value={plateNumber} onChange={e => setPlateNumber(e.target.value)} style={{ backgroundColor: '#0f172a', border: '1px solid #475569', color: '#fff', padding: '10px', borderRadius: '6px' }} required />
        <input type="text" placeholder="Incident / Case File ID" value={caseFileId} onChange={e => setCaseFileId(e.target.value)} style={{ backgroundColor: '#0f172a', border: '1px solid #475569', color: '#fff', padding: '10px', borderRadius: '6px' }} required />
        <button type="submit" style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={16} /> {loading ? 'Routing Path...' : 'Plot Trajectory'}
        </button>
      </form>

      {error && <div style={{ backgroundColor: '#450a0a', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px', borderRadius: '6px', marginBottom: '20px' }}>ðŸš¨ {error}</div>}

      <CameraStatusBar token={token} refreshTrigger={refreshTrigger} />

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginTop: '20px' }}>
        <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '12px', height: '500px', width: '100%' }}>
          <MapContainer center={[26.8467, 80.9462]} zoom={12} scrollWheelZoom={true} style={{ height: '100%', width: '100%', minHeight: '450px' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {routedCoordinates.length > 0 && <Polyline positions={routedCoordinates} color="#38bdf8" weight={5} opacity={0.8} />}

            {results?.trajectory.map((hit, index) => (
              <Marker key={index} position={[hit.latitude, hit.longitude]} icon={cameraIcon}>
                <Popup>
                  <div style={{ color: '#0f172a' }}>
                    <strong>{hit.location_name}</strong><br />
                    Node ID: {hit.camera_id}<br />
                    Vehicle: {hit.vehicle_type || 'CAR'}<br />
                    <span style={{ color: '#10b981' }}>ðŸ“· Captured At: {formatCaptureTime(hit.timestamp)}</span><br />
                    Confidence: {(hit.confidence * 100).toFixed(0)}%
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid #334155', paddingBottom: '8px', fontSize: '16px' }}>Audit Verification</h3>
            <p style={{ fontSize: '13px', margin: '4px 0' }}><strong>Case File:</strong> {results?.search_metadata?.case_file_id || 'N/A'}</p>
            <p style={{ fontSize: '13px', margin: '4px 0' }}><strong>Active Hits:</strong> <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{results?.total_hits || 0}</span></p>
            <p style={{ fontSize: '13px', margin: '4px 0' }}><strong>Last Captured:</strong> <span style={{ color: '#10b981', fontWeight: 'bold' }}>{formatLastCaptureTime(results)}</span></p>
          </div>

          <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', flex: 1, overflowY: 'auto', maxHeight: '400px' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid #334155', paddingBottom: '8px', fontSize: '16px' }}>Detected Spatial Nodes</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {results?.trajectory.map((hit, index) => (
                <div key={index} style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '6px', borderLeft: '3px solid #38bdf8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={14} color="#38bdf8" /> {hit.location_name}
                    </div>
                    <span style={{ fontSize: '10px', backgroundColor: '#0369a1', color: '#e0f2fe', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                      {hit.vehicle_type || 'CAR'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                    <Clock size={12} color="#10b981" /> Captured At: <span style={{ color: '#10b981', fontWeight: 'bold' }}>{formatCaptureTime(hit.timestamp)}</span>
                  </div>
                </div>
              )) || <p style={{ fontSize: '12px', color: '#64748b' }}>No active spatial data plotted on map.</p>}
            </div>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-12 gap-5 mt-5 items-stretch' style={{ minHeight: '480px' }}>
        <div className='col-span-12 xl:col-span-8 flex'>
          <LiveFeedViewport defaultCameraId={DEFAULT_CAM_ID} />
        </div>
        <div className='col-span-12 xl:col-span-4 flex'>
          <DetectionSidebar token={token} refreshTrigger={refreshTrigger} blacklist={watchlist.map((w) => w.plate_number)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginTop: '20px' }}>
        <LiveCameraFeed token={token} refreshTrigger={refreshTrigger} />
        <CameraRegisterPanel token={token} onRegistered={() => setRefreshTrigger((t) => t + 1)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
        <AlertFeed token={token} refreshTrigger={refreshTrigger} />
        <AnalyticsPanel token={token} refreshTrigger={refreshTrigger} watchlist={watchlist} />
      </div>

      <div style={{ marginTop: '20px' }}>
        <MacroAnalytics />
      </div>
    </div>
  );
}

