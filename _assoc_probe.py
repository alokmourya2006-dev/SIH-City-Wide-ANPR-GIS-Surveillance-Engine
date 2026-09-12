import sys, os
ROOT = r'c:\Users\Alok maurya\OneDrive\Desktop\SIH 127'
sys.path.insert(0, os.path.join(ROOT, 'backend', 'app'))
os.chdir(os.path.join(ROOT, 'backend', 'app'))
import numpy as np
import plate_detector as PD

# Fake plate detector that returns ONE plate box directly (mode=plate)
class FakeBox:
    def __init__(self, xyxy, conf, cls):
        self.xyxy = [xyxy]
        self.conf = [conf]
        self.cls = [cls]

class FakeVehicleModel:
    """Pretends YOLO found a CAR bbox containing the plate."""
    def __call__(self, frame, verbose=False):
        class _R:
            boxes = [FakeBox([100, 200, 500, 420], 0.88, 2)]  # class 2 = CAR
        return [_R()]

orig_init = PD.PlateDetector.__init__
def patched_init(self, *a, **k):
    # Only set what detect_plates needs: mode=plate, vehicle_model, plate_classes
    self.mode = "plate"
    self.vehicle_model = FakeVehicleModel()
    self.plate_classes = {0}
    self.localizer = None
    self.model = None
orig_detect = PD.PlateDetector.detect_plates

def fake_detect(self, frame, vehicle_classes=(2, 3, 5, 7)):
    # Simulate the plate-model branch producing one detection,
    # then run the SAME association code path by calling model result loop.
    # Instead, build a detection dict exactly like the plate branch does:
    from types import SimpleNamespace
    det = {
        "bbox": [280, 260, 380, 300],
        "plate_bbox": [280, 260, 380, 300],
        "vehicle_bbox": None, "vehicle_type": None,
        "confidence": 0.9, "class": 0, "kind": "plate",
    }
    # Replicate association loop used in detect_plates (plate branch)
    pb = det["bbox"]
    vb, vtype = None, None
    if self.vehicle_model is not None:
        try:
            vres = self.vehicle_model(frame, verbose=False)
            vbx = None
            for _r in vres:
                for _b in _r.boxes:
                    _c = int(_b.cls[0])
                    if _c not in PD.VEHICLE_TYPE_MAP:
                        continue
                    _x1, _y1, _x2, _y2 = _b.xyxy[0]
                    _cx = (pb[0] + pb[2]) / 2.0
                    _cy = (pb[1] + pb[3]) / 2.0
                    if _x1 <= _cx <= _x2 and _y1 <= _cy <= _y2:
                        vbx = [int(_x1), int(_y1), int(_x2), int(_y2)]
                        vtype = PD.VEHICLE_TYPE_MAP[_c]
                        break
                if vbx:
                    break
            vb = vbx
        except Exception:
            vb, vtype = None, None
    det["vehicle_bbox"] = vb
    det["vehicle_type"] = vtype or "UNKNOWN"
    return [det]

PD.PlateDetector.detect_plates = fake_detect
inst = object.__new__(PD.PlateDetector)
inst.vehicle_model = FakeVehicleModel()
dets = fake_detect(inst, np.zeros((10, 10, 3), dtype=np.uint8))
out = [
    'PLATE_IN_CAR_BOX -> vehicle_type = %s' % dets[0].get('vehicle_type'),
    'VEHICLE_BBOX = %s' % dets[0].get('vehicle_bbox'),
]
print('\n'.join(out))
open(r'c:\Users\Alok maurya\OneDrive\Desktop\SIH 127\_assoc_probe.txt', 'w', encoding='utf-8').write('\n'.join(out))