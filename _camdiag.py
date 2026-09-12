"""Camera diagnostics: webcam indices, resolution, YOLO vehicles, plate OCR. Writes _camdiag.txt"""
import os, sys
ROOT = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
sys.path.insert(0, os.path.join(ROOT, "backend", "app"))
out = []
def log(s):
    print(s, flush=True); out.append(s)
def save():
    open(os.path.join(ROOT, "_camdiag.txt"), "w", encoding="utf-8").write("\n".join(out))
import cv2
log("--- WEBCAM SCAN (default backend, indices 0..3) ---")
opened = []
for idx in range(4):
    cap = cv2.VideoCapture(idx)
    if cap.isOpened():
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        log(f"index {idx}: OPEN {w}x{h}")
        opened.append(idx); cap.release()
    else:
        log(f"index {idx}: unavailable")
        try: cap.release()
        except Exception: pass
if not opened:
    log("NO WEBCAM -> use --source video.mp4 / rtsp-url / image.jpg")
    save(); sys.exit(0)
from plate_detector import PlateDetector
log("--- LOADING MODELS (may take ~60s CPU first run) ---")
det = PlateDetector()
log(f"detector mode={det.mode}")
cap = cv2.VideoCapture(opened[0])
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280); cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
ok, frame = cap.read(); cap.release()
if not ok:
    log("FRAME READ FAILED"); save(); sys.exit(0)
log(f"frame {frame.shape[1]}x{frame.shape[0]}")
raw = det.detect_plates(frame)
log(f"YOLO vehicles/plates: {len(raw)}")
for v in raw[:5]:
    log(f"  box={v['bbox']} conf={v['confidence']:.2f} kind={v.get('kind')}")
reads = det.process_frame(frame)
log(f"VALID PLATE READS: {len(reads)}")
for r in reads:
    log(f"  {r['plate_text']} conf={r['confidence']:.2f}")
if raw and not reads:
    log("DIAGNOSIS: camera sees vehicles but OCR rejects -> hold printed plate 30-50cm, straight, good light")
elif not raw:
    log("DIAGNOSIS: no vehicles detected -> point camera at a car/bike or printed vehicle photo")
else:
    log("DIAGNOSIS: pipeline reading plates OK")
save()
