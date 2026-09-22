import React, { useState } from 'react';
import { Grid, Activity, ArrowRight, BarChart3, Filter, Zap, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';

const card = { background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b' };
const pill = { display: 'flex', alignItems: 'center', background: '#020617', padding: '4px', borderRadius: '8px', border: '1px solid #1e293b', fontFamily: 'monospace', fontSize: '12px' };
const tbtn = (active, clr) => ({ padding: '2px 8px', borderRadius: '4px', background: active ? clr : 'transparent', color: active ? '#fff' : '#94a3b8', border: 'none', cursor: 'pointer', fontWeight: active ? 700 : 400 });
const obsColor = kmh => kmh < 20 ? '#f87171' : kmh < 35 ? '#fbbf24' : '#34d399';
const ciBar = ci => ci >= 0.7 ? '#ef4444' : ci >= 0.3 ? '#fbbf24' : '#10b981';
const sectors = [{ id: 'SEC_01', name: 'Gomti Nagar' }, { id: 'SEC_02', name: 'Hazratganj' }, { id: 'SEC_03', name: 'Charbagh' }, { id: 'SEC_04', name: 'Alambagh' }, { id: 'SEC_05', name: 'Indira Nagar' }];

export default function MacroAnalytics({ odFlow, liveCongestion, timeWindows = ['1H', '3H', '12H', '24H'] }) {
  const [timeHorizon, setTimeHorizon] = useState('1H');
  const [congestionFilter, setCongestionFilter] = useState('ALL');
  const [selectedCell, setSelectedCell] = useState(null);
  const [hoverCell, setHoverCell] = useState(null);
  const odMatrixData = odFlow || {
    SEC_01: { SEC_01: { count: 420, avgMin: 8, avgKm: 3.2 }, SEC_02: { count: 1250, avgMin: 22, avgKm: 8.4 }, SEC_03: { count: 890, avgMin: 34, avgKm: 12.1 }, SEC_04: { count: 310, avgMin: 41, avgKm: 15.8 }, SEC_05: { count: 670, avgMin: 18, avgKm: 6.5 } },
    SEC_02: { SEC_01: { count: 1120, avgMin: 24, avgKm: 8.4 }, SEC_02: { count: 580, avgMin: 6, avgKm: 2.1 }, SEC_03: { count: 1890, avgMin: 16, avgKm: 5.2 }, SEC_04: { count: 740, avgMin: 28, avgKm: 9.6 }, SEC_05: { count: 820, avgMin: 20, avgKm: 7.8 } },
    SEC_03: { SEC_01: { count: 780, avgMin: 36, avgKm: 12.1 }, SEC_02: { count: 1640, avgMin: 18, avgKm: 5.2 }, SEC_03: { count: 610, avgMin: 7, avgKm: 2.8 }, SEC_04: { count: 1420, avgMin: 14, avgKm: 4.9 }, SEC_05: { count: 450, avgMin: 38, avgKm: 14.2 } },
    SEC_04: { SEC_01: { count: 290, avgMin: 44, avgKm: 15.8 }, SEC_02: { count: 680, avgMin: 30, avgKm: 9.6 }, SEC_03: { count: 1380, avgMin: 15, avgKm: 4.9 }, SEC_04: { count: 490, avgMin: 6, avgKm: 2.4 }, SEC_05: { count: 210, avgMin: 48, avgKm: 17.5 } },
    SEC_05: { SEC_01: { count: 610, avgMin: 19, avgKm: 6.5 }, SEC_02: { count: 890, avgMin: 21, avgKm: 7.8 }, SEC_03: { count: 410, avgMin: 39, avgKm: 14.2 }, SEC_04: { count: 190, avgMin: 50, avgKm: 17.5 }, SEC_05: { count: 520, avgMin: 7, avgKm: 2.9 } },
  };
  const segmentData = liveCongestion && liveCongestion.length ? liveCongestion : [
    { id: 'SEG_102_105', originCam: 'CAM_102 (Gomti Nagar Main)', destCam: 'CAM_105 (Samta Mulak Chauraha)', distanceMeters: 2400, freeFlowKmh: 60, observedKmh: 14.2, congestionIndex: 0.76, sampleSize: 48, status: 'RED_BOTTLENECK', trend: '+18m delay' },
    { id: 'SEG_204_210', originCam: 'CAM_204 (Hazratganj Crossing)', destCam: 'CAM_210 (KD Singh Babu Stadium)', distanceMeters: 1800, freeFlowKmh: 50, observedKmh: 22.5, congestionIndex: 0.55, sampleSize: 82, status: 'AMBER_SLOWDOWN', trend: '+6m delay' },
    { id: 'SEG_301_304', originCam: 'CAM_301 (Charbagh Railway Station)', destCam: 'CAM_304 (Naka Hindola)', distanceMeters: 1200, freeFlowKmh: 40, observedKmh: 36.8, congestionIndex: 0.08, sampleSize: 114, status: 'GREEN_FREE_FLOW', trend: 'Normal' },
    { id: 'SEG_402_408', originCam: 'CAM_402 (Alambagh Bus Terminal)', destCam: 'CAM_408 (Singar Nagar)', distanceMeters: 3100, freeFlowKmh: 60, observedKmh: 16.5, congestionIndex: 0.73, sampleSize: 63, status: 'RED_BOTTLENECK', trend: '+22m delay' },
    { id: 'SEG_501_503', originCam: 'CAM_501 (Indira Nagar Lekhraj)', destCam: 'CAM_503 (Polytechnic Chauraha)', distanceMeters: 2700, freeFlowKmh: 50, observedKmh: 32.0, congestionIndex: 0.36, sampleSize: 95, status: 'AMBER_SLOWDOWN', trend: '+3m delay' },
  ];
  const redCount = segmentData.filter((s) => s.status === 'RED_BOTTLENECK').length;
  const amberCount = segmentData.filter((s) => s.status === 'AMBER_SLOWDOWN').length;
  const avgCI = segmentData.length ? segmentData.reduce((a, s) => a + (s.congestionIndex || 0), 0) / segmentData.length : 0;
  const totalTrips = Object.values(odMatrixData).reduce((a, row) => a + Object.values(row).reduce((x, c) => x + (c.count || 0), 0), 0);
  const filteredSegments = segmentData.filter((s) => {
    if (congestionFilter === 'RED') return s.status === 'RED_BOTTLENECK';
    if (congestionFilter === 'AMBER') return s.status === 'AMBER_SLOWDOWN';
    return true;
  });
  function getCellHeatStyle(count) {
    if (count > 1500) return { background: 'rgba(8, 145, 178, 0.80)', color: '#fff', fontWeight: 700, border: '1px solid rgba(34, 211, 238, 0.5)' };
    if (count > 1000) return { background: 'rgba(8, 145, 178, 0.50)', color: '#cffafe', border: '1px solid rgba(34, 211, 238, 0.30)' };
    if (count > 500) return { background: 'rgba(30,58,138,0.40)', color: '#67e8f9', border: '1px solid rgba(30,64,175,0.40)' };
    return { background: 'rgba(15,23,42,0.60)', color: '#94a3b8', border: '1px solid #1e293b' };
  }
  return (
    <div style={{ width: '100%', backgroundColor: '#020617', padding: '16px', fontFamily: 'sans-serif', color: '#f1f5f9', overflowY: 'auto', borderRadius: '12px', border: '1px solid #1e293b' }}>
      <div style={{ ...card, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <BarChart3 size={20} color="#22d3ee" />
            <h2 style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'monospace', margin: 0, color: '#fff' }}>MACRO TRAFFIC ANALYTICS &amp; OD FLOWS</h2>
            <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(34, 211, 238, 0.1)', color: '#22d3ee', border: '1px solid rgba(34, 211, 238, 0.2)' }}>ASYNC CONTINUOUS AGGREGATES</span>
          </div>
          <p style={{ fontSize: '12px', fontFamily: 'monospace', color: '#94a3b8', margin: '4px 0 0' }}>TimescaleDB Continuous Views + Uber H3 Spatial Density Aggregation</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          <div style={pill}>
            {timeWindows.map((h) => (
              <button key={h} onClick={() => setTimeHorizon(h)} style={tbtn(timeHorizon === h, '#0891b2')}>{h}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontFamily: 'monospace', fontSize: '12px', backgroundColor: '#020617', padding: '6px 12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <div><span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>TOTAL TRIPS</span><span style={{ fontWeight: 700 }}>{totalTrips.toLocaleString()}</span></div>
            <div style={{ width: '1px', height: '20px', backgroundColor: '#1e293b' }} />
            <div><span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>AVG CI INDEX</span><span style={{ fontWeight: 700, color: '#fbbf24' }}>{avgCI.toFixed(2)}</span></div>
            <div style={{ width: '1px', height: '20px', backgroundColor: '#1e293b' }} />
            <div><span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>BOTTLENECKS</span><span style={{ fontWeight: 700, color: '#f87171' }}>{redCount} RED</span></div>
          </div>
        </div>
      </div>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Grid size={16} color="#22d3ee" />
            <h3 style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, margin: 0 }}>INTER-SECTOR OD FLOW MATRIX ({timeHorizon} WINDOW)</h3>
          </div>
          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#94a3b8' }}>Values = Vehicle Count (hover for stats, click to pin)</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'center', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={{ padding: '8px', border: '1px solid #1e293b', backgroundColor: '#020617', color: '#64748b', textAlign: 'left', minWidth: '140px', fontWeight: 400 }}>ORIGIN \ DEST</th>
                {sectors.map((s) => (
                  <th key={s.id} style={{ padding: '8px', border: '1px solid #1e293b', backgroundColor: '#020617', color: '#22d3ee', minWidth: '110px' }}>{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sectors.map((orig) => (
                <tr key={orig.id}>
                  <td style={{ padding: '8px', border: '1px solid #1e293b', backgroundColor: '#020617', textAlign: 'left', fontWeight: 700, color: '#22d3ee' }}>{orig.name}</td>
                  {sectors.map((dest) => {
                    const cell = (odMatrixData[orig.id] && odMatrixData[orig.id][dest.id]) || { count: 0, avgMin: 0, avgKm: 0 };
                    const isSelf = orig.id === dest.id;
                    const heat = isSelf ? { background: 'rgba(2,6,23,0.4)', color: '#475569', border: '1px solid #1e293b' } : getCellHeatStyle(cell.count);
                    const hov = hoverCell === orig.id + '-' + dest.id;
                    return (
                      <td key={dest.id} onClick={() => setSelectedCell({ origin: orig.name, dest: dest.name, count: cell.count, avgMin: cell.avgMin, avgKm: cell.avgKm })} onMouseEnter={() => setHoverCell(orig.id + '-' + dest.id)} onMouseLeave={() => setHoverCell(null)} style={{ padding: '12px', cursor: 'pointer', position: 'relative', ...heat }}>
                        <div style={{ fontSize: '14px', fontWeight: 700 }}>{cell.count}</div>
                        <div style={{ fontSize: '10px', opacity: 0.75 }}>{cell.avgMin}m | {cell.avgKm}km</div>
                        {hov && !isSelf && (
                          <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '8px', display: 'flex', flexDirection: 'column', backgroundColor: '#0f172a', border: '1px solid #334155', padding: '8px', borderRadius: '6px', zIndex: 30, fontSize: '10px', whiteSpace: 'nowrap', textAlign: 'left', color: '#e2e8f0' }}>
                            <span style={{ fontWeight: 700, color: '#22d3ee' }}>{orig.name} =&gt; {dest.name}</span>
                            <span>Volume: {cell.count} vehicles</span>
                            <span>Avg Transit: {cell.avgMin} mins</span>
                            <span>Avg Distance: {cell.avgKm} km</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selectedCell && (
          <div style={{ padding: '12px', backgroundColor: '#020617', borderRadius: '8px', border: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '12px', marginTop: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <Zap size={16} color="#fbbf24" />
              <span>Selected Corridor: <strong style={{ color: '#22d3ee' }}>{selectedCell.origin} =&gt; {selectedCell.dest}</strong></span>
              <span style={{ color: '#475569' }}>|</span>
              <span>Volume: <strong style={{ color: '#fff' }}>{selectedCell.count} trips</strong></span>
              <span style={{ color: '#475569' }}>|</span>
              <span>Avg Speed: <strong style={{ color: '#34d399' }}>{selectedCell.avgMin ? (selectedCell.avgKm / (selectedCell.avgMin / 60)).toFixed(1) : '--'} km/h</strong></span>
            </div>
            <button onClick={() => setSelectedCell(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '10px', textDecoration: 'underline' }}>CLEAR</button>
          </div>
        )}
      </div>
      <div style={{ ...card, marginBottom: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} color="#34d399" />
            <h3 style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, margin: 0 }}>SEGMENT SPEED RATIO &amp; BOTTLENECK ENGINE (CI &gt;= 0.70 ALERT)</h3>
          </div>
          <div style={{ ...pill, alignItems: 'center', gap: '4px' }}>
            <Filter size={14} color="#64748b" style={{ marginLeft: '4px' }} />
            <button onClick={() => setCongestionFilter('ALL')} style={tbtn(congestionFilter === 'ALL', '#0891b2')}>ALL ({segmentData.length})</button>
            <button onClick={() => setCongestionFilter('RED')} style={tbtn(congestionFilter === 'RED', '#dc2626')}>RED ({redCount})</button>
            <button onClick={() => setCongestionFilter('AMBER')} style={tbtn(congestionFilter === 'AMBER', '#d97706')}>AMBER ({amberCount})</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b', backgroundColor: '#020617', color: '#94a3b8' }}>
                <th style={{ padding: '12px' }}>CAMERA SEGMENT PAIR</th>
                <th style={{ padding: '12px' }}>DISTANCE</th>
                <th style={{ padding: '12px' }}>FREE FLOW</th>
                <th style={{ padding: '12px' }}>OBSERVED</th>
                <th style={{ padding: '12px' }}>CI</th>
                <th style={{ padding: '12px' }}>SAMPLE</th>
                <th style={{ padding: '12px' }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filteredSegments.map((seg) => (
                <tr key={seg.id} style={{ borderBottom: '1px solid rgba(30,41,59,0.6)' }}>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: '#f1f5f9' }}>{seg.originCam} <ArrowRight size={14} color="#64748b" /> {seg.destCam}</div>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>{seg.id} · {seg.trend}</span>
                  </td>
                  <td style={{ padding: '12px', color: '#cbd5e1' }}>{(seg.distanceMeters / 1000).toFixed(1)} km</td>
                  <td style={{ padding: '12px', color: '#94a3b8' }}>{seg.freeFlowKmh} km/h</td>
                  <td style={{ padding: '12px', fontWeight: 700, color: obsColor(seg.observedKmh) }}>{seg.observedKmh} km/h</td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '96px', backgroundColor: '#1e293b', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', backgroundColor: ciBar(seg.congestionIndex), width: Math.round(seg.congestionIndex * 100) + '%' }} />
                      </div>
                      <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{seg.congestionIndex.toFixed(2)}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px', color: '#94a3b8' }}>{seg.sampleSize} veh</td>
                  <td style={{ padding: '12px' }}>
                    {seg.status === 'RED_BOTTLENECK' ? (
                      <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, backgroundColor: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> RED BOTTLENECK</span>
                    ) : seg.status === 'AMBER_SLOWDOWN' ? (
                      <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, backgroundColor: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.4)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={12} /> SLOWDOWN</span>
                    ) : (
                      <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, backgroundColor: 'rgba(16,185,129,0.2)', color: '#34d399', border: '1px solid rgba(16,185,129,0.4)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12} /> FREE FLOW</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
