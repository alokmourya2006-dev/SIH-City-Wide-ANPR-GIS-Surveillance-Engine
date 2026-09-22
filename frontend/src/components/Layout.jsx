import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Camera, Search, ShieldAlert } from 'lucide-react';
import HeaderBar from './HeaderBar';

export default function Layout({ watchlistCount = 0, onOpenWatchlist, onOpenWebcam, defaultCamId = 'CAM-01', onLogout, outletContext }) {
  return (
    <div style={{ backgroundColor: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <HeaderBar
        watchlistCount={watchlistCount}
        onOpenWatchlist={onOpenWatchlist}
        onOpenWebcam={onOpenWebcam}
        defaultCamId={defaultCamId}
      />
      <div style={{ display: 'flex' }}>
        {/* Sidebar */}
        <nav style={{
          width: 220, minHeight: 'calc(100vh - 56px)', backgroundColor: '#1e293b',
          borderRight: '1px solid rgba(34, 211, 238, 0.25)', padding: '16px 0', position: 'sticky', top: 56, flexShrink: 0,
        }}>
          <div style={{ padding: '0 16px 16px', borderBottom: '1px solid rgba(34,211,238,0.18)', marginBottom: 8 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#22d3ee', letterSpacing: '0.15em' }}>COMMAND CENTER</span>
          </div>
          <NavLink to="/" end style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', fontSize: 14, fontWeight: 600,
            color: isActive ? '#22d3ee' : '#94a3b8', backgroundColor: isActive ? 'rgba(34, 211, 238, 0.15)' : 'transparent',
            borderLeft: isActive ? '3px solid #06b6d4' : '3px solid transparent', transition: 'all 0.2s',
          })}>
            <LayoutDashboard size={18} /> Dashboard
          </NavLink>
          <NavLink to="/cameras" style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', fontSize: 14, fontWeight: 600,
            color: isActive ? '#22d3ee' : '#94a3b8', backgroundColor: isActive ? 'rgba(34, 211, 238, 0.15)' : 'transparent',
            borderLeft: isActive ? '3px solid #06b6d4' : '3px solid transparent', transition: 'all 0.2s',
          })}>
            <Camera size={18} /> Cameras
          </NavLink>
          <NavLink to="/search" style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', fontSize: 14, fontWeight: 600,
            color: isActive ? '#22d3ee' : '#94a3b8', backgroundColor: isActive ? 'rgba(34, 211, 238, 0.15)' : 'transparent',
            borderLeft: isActive ? '3px solid #06b6d4' : '3px solid transparent', transition: 'all 0.2s',
          })}>
            <Search size={18} /> Plate Search
          </NavLink>
          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(34,211,238,0.18)', marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={14} color="#22d3ee" />
              <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', letterSpacing: '0.1em' }}>SECURE SESSION</span>
            </div>
            {onLogout && (
              <button onClick={onLogout} style={{ marginTop: 12, width: '100%', backgroundColor: 'rgba(220,38,38,0.12)', color: '#fca5a5', border: '1px solid #7f1d1d', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
                Session Logout
              </button>
            )}
          </div>
        </nav>
        {/* Main content */}
        <main style={{ flex: 1, padding: '20px', minWidth: 0 }}>
          <Outlet context={outletContext} />
        </main>
      </div>
    </div>
  );
}
