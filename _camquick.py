"""Fast webcam check (no YOLO/OCR) - writes _camquick.txt immediately."""
import os, sys
ROOT = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
out = []
def log(s):
    print(s, flush=True); out.append(s)
    open(os.path.join(ROOT, "_camquick.txt"), "w", encoding="utf-8").write("\n".join(out))
import cv2
log("--- FAST WEBCAM CHECK ---")
for idx in range(4):
    cap = cv2.VideoCapture(idx)
    if cap.isOpened():
        ok, frame = cap.read()
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        if ok and frame is not None:
            log(f"index {idx}: OPEN {w}x{h} frame={frame.shape[1]}x{frame.shape[0]} mean={frame.mean():.1f}")
        else:
            log(f"index {idx}: OPEN but FRAME READ FAILED (camera busy?)")
        cap.release()
    else:
        log(f"index {idx}: unavailable")
        try: cap.release()
        except Exception: pass
log("DONE. If index 0 OPEN with frame -> camera hardware OK, issue is detection/OCR tuning (fixed below).")
