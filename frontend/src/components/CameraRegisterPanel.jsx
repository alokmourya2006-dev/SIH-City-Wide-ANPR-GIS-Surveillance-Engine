import React, { useState } from 'react';
import { PlusCircle, Video, Loader2 } from 'lucide-react';

const API_BASE = 'https://sih-city-wide-anpr-gis-surveillance.onrender.com';
const SECTORS = ['SECTOR_A', 'SECTOR_B', 'SECTOR_C', 'SECTOR_D'];
const SOURCE_TYPES = ['WEBCAM', 'RTSP', 'FILE'];

const inputStyle = {
  width: '100%',
  padding: '7px 9px',
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '5px',
  color: '#e2e8f0',
  fontSize: '12px',
  boxSizing: 'border-box',
  marginBottom: '8px'
};

const labelStyle = {
  display: 'block',
  fontSize: '10px',
  fontWeight: 'bold',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#94a3b8',
  marginBottom: '3px'
};

export default function CameraRegisterPanel({ token, onRegistered }) {
  const [form, setForm] = useState({
    camera_id: '',
    name: '',
    latitude: '26.8467',
    longitude: '80.9462',
    sector: 'SECTOR_A',
    source_type: 'WEBCAM',
    rtsp_url: ''
  });
  const [result, setResult] = useState({ msg: '', ok: false });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.camera_id.trim()) {
      setResult({ msg: 'Camera ID is required (e.g. CAM_LKO_MYCAM_05)', ok: false });
      return;
    }
    setSubmitting(true);
    setResult({ msg: '', ok: false });
    try {
      const res = await fetch(`${API_BASE}/api/v1/cameras/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          camera_id: form.camera_id.trim(),
          name: form.name.trim() || form.camera_id.trim(),
          latitude: parseFloat(form.latitude) || 26.8467,
          longitude: parseFloat(form.longitude) || 80.9462,
          sector: form.sector,
          source_type: form.source_type,
          rtsp_url: form.rtsp_url.trim() || null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Registration failed');
      setResult({
        msg: `✅ ${data.camera_id} registered. Run "python edge_pipeline.py --camera-id ${data.camera_id}" to go live.`,
        ok: true
      });
      setForm({ ...form, camera_id: '', name: '', rtsp_url: '' });
      if (onRegistered) onRegistered();
    } catch (err) {
      setResult({ msg: err.message, ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-frame" style={{ padding: '16px', borderRadius: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Video size={16} color="#22d3ee" />
        <span style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>
          Connect Camera
        </span>
      </div>
      <form onSubmit={handleSubmit}>
        <label style={labelStyle}>Camera ID *</label>
        <input
          style={inputStyle}
          name="camera_id"
          value={form.camera_id}
          onChange={handleChange}
          placeholder="CAM_LKO_MYCAM_05"
        />
        <label style={labelStyle}>Display Name</label>
        <input
          style={inputStyle}
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="My Junction Camera"
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={labelStyle}>Latitude</label>
            <input style={inputStyle} name="latitude" value={form.latitude} onChange={handleChange} />
          </div>
          <div>
            <label style={labelStyle}>Longitude</label>
            <input style={inputStyle} name="longitude" value={form.longitude} onChange={handleChange} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={labelStyle}>Sector</label>
            <select style={inputStyle} name="sector" value={form.sector} onChange={handleChange}>
              {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Source</label>
            <select style={inputStyle} name="source_type" value={form.source_type} onChange={handleChange}>
              {SOURCE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {form.source_type === 'RTSP' && (
          <div>
            <label style={labelStyle}>RTSP URL</label>
            <input
              style={inputStyle}
              name="rtsp_url"
              value={form.rtsp_url}
              onChange={handleChange}
              placeholder="rtsp://user:pass@192.168.1.100:554/stream1"
            />
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%',
            padding: '9px',
            backgroundColor: submitting ? '#155e75' : '#0e7490',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
            fontWeight: 'bold',
            fontSize: '12px',
            cursor: submitting ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            marginTop: '4px'
          }}
        >
          {submitting ? <Loader2 size={14} /> : <PlusCircle size={14} />}
          {submitting ? 'Registering...' : 'Register Camera'}
        </button>
      </form>
      {result.msg && (
        <div style={{
          marginTop: '10px',
          padding: '8px 10px',
          borderRadius: '5px',
          fontSize: '11px',
          backgroundColor: result.ok ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          color: result.ok ? '#10b981' : '#fca5a5',
          border: `1px solid ${result.ok ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`
        }}>
          {result.msg}
        </div>
      )}
    </div>
  );
}
