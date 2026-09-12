import React, { useState, useEffect } from 'react';
import { Camera, Wifi, WifiOff, Clock } from 'lucide-react';

// Convert raw ISO-8601 UTC timestamp into a readable IST capture time
const formatCaptureTime = (iso) => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return `${date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  })} IST`;
};

export default function CameraStatusBar({ token, refreshTrigger }) {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/cameras/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to fetch camera status');
      setCameras(data.cameras || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [token, refreshTrigger]);

  return (
    <div className="glass-frame" style={{ padding: '12px 16px', borderRadius: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <Camera size={16} color="#38bdf8" />
        <span style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>
          Camera Network Status
        </span>
      </div>
      {error && <div style={{ color: '#fca5a5', fontSize: '11px', marginBottom: '8px' }}>{error}</div>}
      {loading && cameras.length === 0 ? (
        <div style={{ color: '#94a3b8', fontSize: '11px' }}>Loading camera status...</div>
      ) : (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
          {cameras.map((cam) => {
            const statusColor =
              cam.status === 'ONLINE' ? '#10b981' :
              cam.status === 'OFFLINE' ? '#ef4444' : '#64748b';
            const isLive = cam.status === 'ONLINE';
            return (
            <div
              key={cam.camera_id}
              style={{
                minWidth: '140px',
                padding: '8px 10px',
                backgroundColor: '#1e293b',
                borderRadius: '6px',
                borderLeft: `3px solid ${statusColor}`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                {isLive ? <Wifi size={12} color={statusColor} /> : <WifiOff size={12} color={statusColor} />}
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: statusColor }}>
                  {cam.status}
                </span>
                {cam.stream_available && (
                  <span style={{
                    fontSize: '8px',
                    fontWeight: 'bold',
                    color: '#fff',
                    backgroundColor: '#dc2626',
                    padding: '1px 5px',
                    borderRadius: '3px',
                    letterSpacing: '0.05em'
                  }}>
                    ● LIVE
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '2px' }}>{cam.name}</div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>{cam.sector}</div>
              {cam.last_plate && (
                <div style={{ fontSize: '10px', color: '#38bdf8', fontFamily: 'monospace', marginTop: '4px' }}>
                  {cam.last_plate}
                </div>
              )}
              <div style={{ fontSize: '10px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                <Clock size={11} color="#10b981" /> Captured: {formatCaptureTime(cam.last_seen)}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
