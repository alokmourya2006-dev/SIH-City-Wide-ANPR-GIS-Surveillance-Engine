import sys, os
ROOT = r'c:\Users\Alok maurya\OneDrive\Desktop\SIH 127'
sys.path.insert(0, os.path.join(ROOT, 'backend', 'app'))
os.chdir(os.path.join(ROOT, 'backend', 'app'))
from tracker import TrackletTracker

t = TrackletTracker(iou_threshold=0.3, max_age_frames=3)
# Feed detection for a MOTORCYCLE first, then update with the same plate
r1 = t.update([{"bbox": [10, 10, 60, 60], "plate_text": "UP32KT2112",
                "confidence": 0.9, "vehicle_type": "MOTORCYCLE"}], "2026-01-01T00:00:00")
# Second frame: no detection -> after 4 frames the track closes
for _ in range(4):
    r2 = t.update([], "2026-01-01T00:00:0%d" % _)
closed = [x for x in r1 + [i for sub in r2 for i in (sub if isinstance(sub, list) else [sub])] if isinstance(x, dict)]
# r2 is list of closed tracklets per call
closed = r1
for batch in r2:
    for item in (batch if isinstance(batch, list) else [batch]):
        if isinstance(item, dict):
            closed.append(item)

vt = [c.get("vehicle_type") for c in closed if c.get("plate_text") == "UP32KT2112"]
lines = [
    'CLOSED = %s' % closed,
    'VEHICLE_TYPE_FROM_TRACKLET = %s' % (vt[0] if vt else 'MISSING'),
]
print('\n'.join(lines))
open(r'c:\Users\Alok maurya\OneDrive\Desktop\SIH 127\_tracker_vt.txt', 'w', encoding='utf-8').write('\n'.join(lines))