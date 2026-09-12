// Tiny pub/sub bus shared by the live detection stream and the analytics panel.
// DetectionSidebar publishes every new detection; AnalyticsPanel "live" tab subscribes.
const listeners = new Set();

export function publishDetection(det) {
  listeners.forEach((fn) => {
    try { fn(det); } catch { /* ignore subscriber errors */ }
  });
}

export function subscribeDetections(fn) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
