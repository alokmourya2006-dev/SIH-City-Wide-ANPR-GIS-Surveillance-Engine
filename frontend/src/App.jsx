import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { authFetch, isTokenExpired, clearStoredToken } from './api';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Cameras from './pages/Cameras';
import Search from './pages/Search';
import WatchlistModal from './components/WatchlistModal';
import WebcamModal from './components/WebcamModal';
import './index.css';

// Hazratganj sector (CAM-01) loads first by default when LIVE CAM is clicked
const DEFAULT_CAM_ID = 'CAM-01';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('police_token') || '');
  const [badgeIdInput, setBadgeIdInput] = useState('POLICE_7082');
  const [passwordInput, setPasswordInput] = useState('admin123');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [watchlist, setWatchlist] = useState([]);
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);
  const [activeCameraId, setActiveCameraId] = useState(DEFAULT_CAM_ID);
  const [error, setError] = useState('');

  // Graceful 401 handling: any component hitting an expired/invalid token
  // clears storage and fires 'auth:expired' -> we drop back to the login screen.
  useEffect(() => {
    const onAuthExpired = () => {
      setToken('');
      setError('Session expired -- please sign in again.');
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
      setError('Session expired -- please sign in again.');
    }
  }, []);

  const loadWatchlist = useCallback(async (authToken) => {
    if (authToken) {
      try {
        const res = await authFetch('https://sih-city-wide-anpr-gis-surveillance.onrender.com/api/v1/hotlist', { headers: { 'Authorization': `Bearer ${authToken}` } });
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

  // Login gate -- POSTs the Badge ID / Passcode to the backend.
  // Login.jsx owns the form/UI (rotating sphere background + ARGUS assistant);
  // this handler just performs the authenticated POST and stores the JWT.
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const formData = new URLSearchParams();
    formData.append('username', badgeIdInput);
    formData.append('password', passwordInput);

    try {
      const res = await fetch('https://sih-city-wide-anpr-gis-surveillance.onrender.com/api/v1/auth/login', {
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
  };

  // The authenticated command center is routed: dashboard / cameras / search
  // share the live token + watchlist through Layout's <Outlet> context.
  const outletContext = {
    token,
    refreshTrigger,
    setRefreshTrigger,
    watchlist,
    activeCameraId,
    onSessionExpired: handleLogout,
  };

  if (!token) {
    return (
      <Login
        badgeIdInput={badgeIdInput}
        setBadgeIdInput={setBadgeIdInput}
        passwordInput={passwordInput}
        setPasswordInput={setPasswordInput}
        handleLogin={handleLogin}
        error={error}
      />
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <Layout
            watchlistCount={watchlist.length}
            onOpenWatchlist={() => setShowWatchlist(true)}
            onOpenWebcam={(camId = DEFAULT_CAM_ID) => { setActiveCameraId(camId); setShowWebcam(true); }}
            defaultCamId={DEFAULT_CAM_ID}
            onLogout={handleLogout}
            outletContext={outletContext}
          />
        }>
          <Route index element={<Dashboard />} />
          <Route path="cameras" element={<Cameras />} />
          <Route path="search" element={<Search />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>

      {showWatchlist && (
        <WatchlistModal token={token} watchlist={watchlist} onChanged={setWatchlist} onClose={() => setShowWatchlist(false)} />
      )}
      {showWebcam && (
        <WebcamModal token={token} blacklist={watchlist.map((w) => w.plate_number)} onClose={() => setShowWebcam(false)} />
      )}
    </BrowserRouter>
  );
}
