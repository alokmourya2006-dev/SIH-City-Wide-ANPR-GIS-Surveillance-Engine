import sys, os
ROOT = r'c:\Users\Alok maurya\OneDrive\Desktop\SIH 127'
sys.path.insert(0, os.path.join(ROOT, 'backend', 'app'))
os.chdir(os.path.join(ROOT, 'backend', 'app'))
from plate_detector import PlateDetector, VEHICLE_TYPE_MAP
d = PlateDetector()
lines = [
    'MODE = %s' % d.mode,
    'VEHICLE_MODEL_LOADED = %s' % (d.vehicle_model is not None),
    'TYPE_MAP = %s' % VEHICLE_TYPE_MAP,
]
print('\n'.join(lines))
open(r'c:\Users\Alok maurya\OneDrive\Desktop\SIH 127\_platetype_probe.txt', 'w', encoding='utf-8').write('\n'.join(lines))