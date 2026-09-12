import sys, os
ROOT = r'c:\Users\Alok maurya\OneDrive\Desktop\SIH 127'
sys.path.insert(0, os.path.join(ROOT, 'backend', 'app'))
os.chdir(os.path.join(ROOT, 'backend', 'app'))
import cv2, numpy as np
from plate_detector import PlateDetector

d = PlateDetector()
frame = np.zeros((480, 640, 3), dtype=np.uint8)
frame[:] = (120, 120, 120)
# Paint a crude white "car" region so vehicle model has something
cv2.rectangle(frame, (150, 200), (500, 420), (200, 200, 200), -1)
cv2.rectangle(frame, (280, 260), (420, 300), (255, 255, 255), -1)  # plate-ish area

dets = d.detect_plates(frame)
out = [
    'MODE = %s' % d.mode,
    'DETECT_RAN = True',
    'NUM_DETS = %d' % len(dets),
    'KEYS = %s' % (sorted(dets[0].keys()) if dets else 'n/a'),
    'VEHICLE_TYPE_FIELD = %s' % (dets[0].get('vehicle_type') if dets else 'n/a'),
]
print('\n'.join(out))
open(r'c:\Users\Alok maurya\OneDrive\Desktop\SIH 127\_endtoend_probe.txt', 'w', encoding='utf-8').write('\n'.join(out))