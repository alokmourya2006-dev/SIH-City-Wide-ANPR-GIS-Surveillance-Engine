import React from 'react';
import { useOutletContext } from 'react-router-dom';
import LiveCameraFeed from '../components/LiveCameraFeed';
import CameraRegisterPanel from '../components/CameraRegisterPanel';
import LiveFeedViewport from '../components/LiveFeedViewport';
import CameraStatusBar from '../components/CameraStatusBar';

const DEFAULT_CAM_ID = 'CAM-01';

export default function Cameras() {
  const { token, refreshTrigger, setRefreshTrigger } = useOutletContext();
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 'bold', margin: '0 0 4px' }}>Camera Network</h2>
      <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px' }}>Live edge nodes, registration &amp; stream health</p>
      <CameraStatusBar token={token} refreshTrigger={refreshTrigger} />
      <div className="grid grid-cols-12 gap-5 mt-5 items-stretch" style={{ minHeight: '480px' }}>
        <div className="col-span-12 xl:col-span-8 flex">
          <LiveFeedViewport defaultCameraId={DEFAULT_CAM_ID} />
        </div>
        <div className="col-span-12 xl:col-span-4 flex" style={{ display: 'flex' }}>
          <div style={{ flex: 1 }}>
            <CameraRegisterPanel token={token} onRegistered={() => setRefreshTrigger((t) => t + 1)} />
          </div>
        </div>
      </div>
      <div style={{ marginTop: 20 }}>
        <LiveCameraFeed token={token} refreshTrigger={refreshTrigger} />
      </div>
    </div>
  );
}
