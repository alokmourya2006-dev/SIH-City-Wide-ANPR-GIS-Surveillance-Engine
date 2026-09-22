import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';

const SEVERITY_STYLES = {
  CRITICAL: { bg: '#7f1d1d', border: '#ef4444', text: '#fca5a5', icon: '🔴' },
  HIGH: { bg: '#7f1d1d', border: '#f87171', text: '#fecaca', icon: '🟥' },
  MEDIUM: { bg: '#450a0a', border: '#b91c1c', text: '#fca5a5', icon: '🟥' },
  LOW: { bg: '#143d2c', border: '#10b981', text: '#bbf7d0', icon: '🟢' },
};

// Human-readable alert type labels
const ALERT_TYPE_LABELS = {
  HOTLIST_MATCH: 'Hotlisted Vehicle Sighted',
  ANOMALY: 'Anomaly Detected',
  CONGESTION: 'Traffic Congestion',
};

// Full readable IST time so stale demo entries are visibly old
const formatAlertTime = (iso) => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-IN', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true, timeZone: 'Asia/Kolkata'
  }) + ' IST';
};

export default function AlertFeed({ token, refreshTrigger }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchAlerts = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/alerts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to fetch alerts');
      setAlerts(data.alerts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5000);
    return () => clearInterval(interval);
  }, [token, refreshTrigger]);

  const getStyle = (severity) => SEVERITY_STYLES[severity] || SEVERITY_STYLES.LOW;

  return (
    <div className="glass-frame" style={{ padding: '16px', borderRadius: '8px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Bell size={18} color="#22d3ee" />
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>Active Alerts</h3>
        {alerts.length > 0 && (
          <span style={{ fontSize: '10px', backgroundColor: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: '10px' }}>
            {alerts.length}
          </span>
        )}
      </div>

      {error && (
        <div style={{ backgroundColor: '#450a0a', color: '#fca5a5', padding: '8px', borderRadius: '4px', fontSize: '12px', marginBottom: '8px' }}>
          {error}
        </div>
      )}

      {loading && alerts.length === 0 ? (
        <div style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
          Loading alerts...
        </div>
      ) : alerts.length === 0 ? (
        <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
          No active alerts
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1 }}>
          {alerts.map((alert) => {
            const style = getStyle(alert.severity);
            return (
              <div
                key={alert.id}
                style={{
                  backgroundColor: style.bg,
                  border: `1px solid ${style.border}`,
                  borderRadius: '6px',
                  padding: '10px',
                  borderLeft: `3px solid ${style.border}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px' }}>{style.icon}</span>
                      <span style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: style.text }}>
                        {ALERT_TYPE_LABELS[alert.alert_type] || alert.alert_type}
                      </span>
                      <span style={{ fontSize: '10px', backgroundColor: style.border, color: '#0f172a', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                        {alert.severity}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: style.text, marginBottom: '4px' }}>
                      {alert.message}
                    </div>
                    {alert.plate_number && (
                      <div style={{ fontSize: '11px', color: style.text, fontFamily: 'monospace', marginBottom: '2px' }}>
                        Plate: {alert.plate_number}
                        {alert.camera_id && (
                          <span style={{ color: '#94a3b8', fontFamily: 'sans-serif' }}> · {alert.camera_id}</span>
                        )}
                      </div>
                    )}
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                      Raised: {formatAlertTime(alert.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
