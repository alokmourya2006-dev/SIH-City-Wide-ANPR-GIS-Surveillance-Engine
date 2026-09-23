import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, CarFront, Bike, ShieldAlert } from 'lucide-react';
import { subscribeDetections } from '../detectionBus';

export default function AnalyticsPanel({ token, refreshTrigger, watchlist = [] }) {
  const [odMatrix, setOdMatrix] = useState(null);
  const [congestion, setCongestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('live');
  const [live, setLive] = useState({ cars: 0, bikes: 0, confSum: 0, confCount: 0, alerts: 0 });

  const fetchAnalytics = useCallback(async (signal) => {
    if (!token) {
      setOdMatrix(null);
      setCongestion(null);
      return;
    }
    setLoading(true);
    setError('');
    const now = new Date().toISOString();
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    try {
      const [odRes, congRes] = await Promise.all([
        fetch('https://sih-city-wide-anpr-gis-surveillance.onrender.com/api/v1/analytics/od-matrix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ start_time: oneHourAgo, end_time: now }),
          signal,
        }),
        fetch('https://sih-city-wide-anpr-gis-surveillance.onrender.com/api/v1/analytics/congestion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ start_time: oneHourAgo, end_time: now }),
          signal,
        })
      ]);
      const odData = await odRes.json();
      const congData = await congRes.json();
      if (odRes.ok) setOdMatrix(odData);
      if (congRes.ok) setCongestion(congData);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || 'Unable to load analytics');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    fetchAnalytics(controller.signal);
    const interval = setInterval(() => fetchAnalytics(controller.signal), 30000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchAnalytics, refreshTrigger]);

  // Subscribe to the live detection stream published by DetectionSidebar
  useEffect(() => subscribeDetections((det) => {
    setLive((prev) => ({
      cars: prev.cars + (det.vehicle === 'BIKE' ? 0 : 1),
      bikes: prev.bikes + (det.vehicle === 'BIKE' ? 1 : 0),
      confSum: prev.confSum + (Number(det.conf) || 0),
      confCount: prev.confCount + 1,
      alerts: prev.alerts + (det.blacklisted ? 1 : 0),
    }));
  }), []);

  const getColor = (ci) => ci > 80 ? '#ef4444' : ci > 60 ? '#f87171' : ci > 40 ? '#b91c1c' : '#10b981';

  const renderLive = () => {
    const total = live.cars + live.bikes;
    const avg = live.confCount > 0 ? (live.confSum / live.confCount) * 100 : 0;
    const carPct = total > 0 ? (live.cars / total) * 100 : 0;
    const card = { padding: '10px 12px', backgroundColor: '#1e293b', borderRadius: '6px' };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#94a3b8' }}>
              <CarFront size={13} color="#22d3ee" /> CARS
            </div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#cffafe' }}>{live.cars}</div>
          </div>
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#94a3b8' }}>
              <Bike size={13} color="#fbbf24" /> BIKES
            </div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#fef3c7' }}>{live.bikes}</div>
          </div>
        </div>
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
            <span>CAR SHARE</span><span style={{ color: '#22d3ee', fontWeight: 'bold' }}>{carPct.toFixed(1)}%</span>
          </div>
          <div style={{ width: '100%', height: '6px', backgroundColor: '#334155', borderRadius: '3px', overflow: 'hidden', marginTop: '6px' }}>
            <div style={{ width: `${carPct}%`, height: '100%', backgroundColor: '#22d3ee', borderRadius: '3px' }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div style={card}>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>AVG CONFIDENCE</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#6ee7b7' }}>{avg.toFixed(1)}%</div>
          </div>
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#94a3b8' }}>
              <ShieldAlert size={13} color="#f87171" /> WATCHLIST
            </div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#fca5a5' }}>{watchlist.length}</div>
          </div>
        </div>
        <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
          {total === 0 ? 'Awaiting live detections…' : `${total} detections this session · ${live.alerts} blacklist hit${live.alerts === 1 ? '' : 's'}`}
        </div>
      </div>
    );
  };

  const renderODMatrix = () => {
    if (!odMatrix) return <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No data</div>;
    const matrix = odMatrix.matrix || {};
    const total = odMatrix.total_transitions || 0;
    return (
      <div>
        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>Total Transitions: <span style={{ color: '#22d3ee', fontWeight: 'bold' }}>{total}</span></div>
        {Object.keys(matrix).length === 0 ? (
          <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No flow data available</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {Object.entries(matrix).map(([src, dsts]) =>
              Object.entries(dsts).map(([dst, count]) => (
                <div key={`${src}-${dst}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', backgroundColor: '#1e293b', borderRadius: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>{src} → {dst}</span>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#22d3ee' }}>{count}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCongestion = () => {
    if (!congestion) return <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No data</div>;
    const segments = congestion.segments || [];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {segments.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No congestion data available</div>
        ) : (
          segments.map((seg) => {
            const color = getColor(seg.congestion_index);
            return (
              <div key={seg.camera_id} style={{ padding: '10px', backgroundColor: '#1e293b', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{seg.location_name}</span>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: color, color: '#0f172a', fontWeight: 'bold' }}>{seg.status}</span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: '#334155', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(seg.congestion_index, 100)}%`, height: '100%', backgroundColor: color, borderRadius: '3px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '10px', color: '#94a3b8' }}>
                  <span>Flow: {seg.observed_flow}/{seg.capacity}</span>
                  <span>CI: {seg.congestion_index}%</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  return (
    <div className="glass-frame" style={{ padding: '16px', borderRadius: '8px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <BarChart3 size={18} color="#22d3ee" />
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>Analytics</h3>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button onClick={() => setActiveTab('live')} style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', backgroundColor: activeTab === 'live' ? '#0891b2' : '#334155', color: '#fff' }}>Live Stats</button>
        <button onClick={() => setActiveTab('od')} style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', backgroundColor: activeTab === 'od' ? '#0891b2' : '#334155', color: '#fff' }}>OD Matrix</button>
        <button onClick={() => setActiveTab('congestion')} style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', backgroundColor: activeTab === 'congestion' ? '#0891b2' : '#334155', color: '#fff' }}>Congestion</button>
      </div>
      {error && <div style={{ backgroundColor: '#450a0a', color: '#fca5a5', padding: '8px', borderRadius: '4px', fontSize: '12px', marginBottom: '8px' }}>{error}</div>}
      {loading && !odMatrix && !congestion ? (
        <div style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', padding: '20px' }}>Loading analytics...</div>
      ) : (
        <div style={{ overflowY: 'auto', flex: 1 }}>{activeTab === 'live' ? renderLive() : activeTab === 'od' ? renderODMatrix() : renderCongestion()}</div>
      )}
    </div>
  );
}
