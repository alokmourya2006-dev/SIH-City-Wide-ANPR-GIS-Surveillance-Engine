import React, { useState, useEffect } from 'react';
import { Video, VideoOff, Radio } from 'lucide-react';

const API_BASE = 'https://sih-city-wide-anpr-gis-surveillance.onrender.com';

export default function LiveCameraFeed({ token, refreshTrigger }) {
  const [cameras, setCameras] = useState([]);
  const [error, setError] = useState('');

  const fetchCameras = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/cameras/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to fetch cameras');
      setCameras(data.cameras || []);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchCameras();
    const interval = setInterval(fetchCameras, 10000);
    return () => clearInterval(interval);
  }, [token, refreshTrigger]);

  const liveCams = cameras.filter(c => c.stream_available || c.status === 'ONLINE');
  const otherCams = cameras.filter(c => !(c.stream_available || c.status === 'ONLINE'));
  const overlayStyle = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '6px 10px',
    background: 'linear-gradient(transparent, rgba(2, 6, 23, 0.9))',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  return (
    <div className="glass-frame" style={{ padding: '16px', borderRadius: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Radio size={16} color="#ef4444" />
        <span style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>
          Live Camera Feeds
        </span>
        <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold', marginLeft: 'auto' }}>
          {liveCams.length} LIVE / {cameras.length} TOTAL
        </span>
      </div>
      {error && <div style={{ color: '#fca5a5', fontSize: '11px', marginBottom: '8px' }}>{error}</div>}
      {cameras.length === 0 && !error && (
        <div style={{ color: '#94a3b8', fontSize: '12px' }}>Loading camera feeds...</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
        {liveCams.map((cam) => (
          <div
            key={cam.camera_id}
            style={{
              position: 'relative',
              backgroundColor: '#0f172a',
              borderRadius: '6px',
              overflow: 'hidden',
              border: '1px solid #334155'
            }}
          >
            <img
              src={`${API_BASE}/api/v1/cameras/${encodeURIComponent(cam.camera_id)}/stream?token=${encodeURIComponent(token)}`}
              alt={`${cam.name} live feed`}
              style={{
                width: '100%',
                display: 'block',
                aspectRatio: '4 / 3',
                objectFit: 'cover',
                backgroundColor: '#000'
              }}
            />
            <div style={overlayStyle}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#e2e8f0' }}>{cam.name}</div>
                <div style={{ fontSize: '9px', color: '#94a3b8', fontFamily: 'monospace' }}>{cam.camera_id}</div>
              </div>
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '9px',
                fontWeight: 'bold',
                color: '#fff',
                backgroundColor: '#dc2626',
                padding: '2px 7px',
                borderRadius: '4px',
                letterSpacing: '0.05em'
              }}>
                ● LIVE
              </span>
            </div>
          </div>
        ))}
        {otherCams.map((cam) => (
          <div
            key={cam.camera_id}
            style={{
              position: 'relative',
              backgroundColor: '#0f172a',
              borderRadius: '6px',
              overflow: 'hidden',
              border: '1px dashed #334155',
              aspectRatio: '4 / 3',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <VideoOff size={22} color="#475569" />
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', padding: '0 10px', textAlign: 'center' }}>
              {cam.name}
            </div>
            <div style={{ fontSize: '9px', color: '#475569', fontFamily: 'monospace' }}>{cam.camera_id}</div>
            <span style={{
              fontSize: '9px',
              fontWeight: 'bold',
              color: cam.status === 'OFFLINE' ? '#fca5a5' : '#94a3b8',
              border: `1px solid ${cam.status === 'OFFLINE' ? '#7f1d1d' : '#334155'}`,
              padding: '1px 8px',
              borderRadius: '4px',
              letterSpacing: '0.05em'
            }}>
              {cam.status}
            </span>
          </div>
        ))}
      </div>
      {cameras.length > 0 && liveCams.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '12px', padding: '8px 0' }}>
          <Video size={14} color="#64748b" />
          No camera streaming yet — run <code style={{ color: '#22d3ee' }}>python edge_pipeline.py</code> in the backend folder to go live.
        </div>
      )}
    </div>
  );
}