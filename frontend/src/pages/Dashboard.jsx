import React from 'react';
import CameraStatusBar from '../components/CameraStatusBar';
import AlertFeed from '../components/AlertFeed';
import AnalyticsPanel from '../components/AnalyticsPanel';
import LiveFeedViewport from '../components/LiveFeedViewport';
import DetectionSidebar from '../components/DetectionSidebar';
import MacroAnalytics from '../components/MacroAnalytics';
import MetricCards from '../components/MetricCards';
import { useOutletContext } from 'react-router-dom';

const DEFAULT_CAM_ID = 'CAM-01';

export default function Dashboard() {
  const { token, refreshTrigger, watchlist } = useOutletContext();
  return (
    <div>
      <MetricCards token={token} watchlist={watchlist} />
      <div style={{ marginTop: 20 }}>
        <CameraStatusBar token={token} refreshTrigger={refreshTrigger} />
      </div>
      <div className="grid grid-cols-12 gap-5 mt-5 items-stretch" style={{ minHeight: '480px' }}>
        <div className="col-span-12 xl:col-span-7 flex">
          <LiveFeedViewport defaultCameraId={DEFAULT_CAM_ID} />
        </div>
        <div className="col-span-12 xl:col-span-5 flex">
          <DetectionSidebar token={token} refreshTrigger={refreshTrigger} blacklist={watchlist.map((w) => w.plate_number)} />
        </div>
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

