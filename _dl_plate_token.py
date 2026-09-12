"""Plate-model download (Option A, working repo). Tries public mirrors in order.
Writes _dl_token_report.txt. No token needed for public repos.
Usage: python _dl_plate_token.py
"""
import os, urllib.request
ROOT = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
RPT = os.path.join(ROOT, "_dl_token_report.txt")
out = []
def log(s):
    print(s, flush=True); out.append(s)
    open(RPT, "w", encoding="utf-8").write("\n".join(out))
mdir = os.path.join(ROOT, "backend", "models")
os.makedirs(mdir, exist_ok=True)
targets = [
    # Koushim mirror (public, YOLOv8n plate model, file best.pt)
    ("https://huggingface.co/Koushim/yolov8-license-plate-detection/resolve/main/best.pt",
     "license-plate-finetune-v1n.pt"),
    ("https://huggingface.co/ml-debi/yolov8-license-plate-detection/resolve/main/best.pt",
     "license-plate-finetune-v1n.pt"),
]
tok = os.environ.get("HF_TOKEN", "").strip()
hdr = {"User-Agent": "argus-sih"}
if tok:
    hdr["Authorization"] = f"Bearer {tok}"
    log("HF_TOKEN present, will send Authorization header")
else:
    log("no HF_TOKEN (public repos don't need one)")
done = None
for url, fname in targets:
    dest = os.path.join(mdir, fname)
    if os.path.exists(dest) and os.path.getsize(dest) > 1_000_000:
        log(f"[SKIP] exists {fname} ({os.path.getsize(dest)} bytes)")
        done = dest; break
    try:
        log(f"GET {url}")
        req = urllib.request.Request(url, headers=hdr)
        with urllib.request.urlopen(req, timeout=180) as r, open(dest, "wb") as fh:
            total = 0
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                fh.write(chunk); total += len(chunk)
        log(f"saved {fname} ({total} bytes)")
        if total < 1_000_000:
            log("too small, trying next"); continue
        done = dest; break
    except Exception as e:
        log(f"WARN {type(e).__name__}: {str(e)[:200]}")
if done:
    try:
        from ultralytics import YOLO
        m = YOLO(done)
        log(f"VALIDATE classes: {m.names}")
        log("SUCCESS: restart edge -> expect '[INFO] Detector mode: plate'")
    except Exception as e:
        log(f"VALIDATE WARN: {e}")
else:
    log("FAILED: all mirrors blocked. Use browser fallback (see chat).")
