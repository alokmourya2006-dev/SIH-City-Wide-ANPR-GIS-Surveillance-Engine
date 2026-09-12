"""Auto-fix far-plate reading: env check + plate-YOLO download. Writes _autofix_report.txt"""
import os, sys, shutil, urllib.request
ROOT = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
RPT = os.path.join(ROOT, "_autofix_report.txt")
out = []
def log(s):
    print(s, flush=True); out.append(s)
    open(RPT, "w", encoding="utf-8").write("\n".join(out))
log("=== PLATE-READ AUTOFIX ===")
mdir = os.path.join(ROOT, "backend", "models")
os.makedirs(mdir, exist_ok=True)
log(f"models dir: {mdir} -> {os.listdir(mdir) or '(empty)'}")
try:
    import ultralytics
    log(f"ultralytics {ultralytics.__version__}")
except Exception as e:
    log(f"ultralytics MISSING: {e}")
try:
    import easyocr
    log("easyocr OK")
except Exception as e:
    log(f"easyocr MISSING: {e}")
try:
    import pytesseract
    log("pytesseract (2nd OCR engine) OK")
except Exception:
    log("pytesseract absent (Tesseract fallback will stay dormant)")
log(f"tesseract binary: {shutil.which('tesseract') or 'not on PATH'}")
have = [f for f in os.listdir(mdir) if f.endswith(".pt")]
if have:
    log(f"plate model ALREADY PRESENT: {have} (edge auto-uses it)")
else:
    log("no plate model -> downloading (this takes ~1-2 min)...")
    bases = ["https://huggingface.co/muhammad-arslan-chaudhary/yolo-v8-license-plate-detection/resolve/main"]
    files = ["license-plate-finetune-v1s.pt", "license-plate-finetune-v1n.pt"]
    done = None
    for fname in files:
        for base in bases:
            url = f"{base}/{fname}"
            dest = os.path.join(mdir, fname)
            try:
                log(f"GET {url}")
                req = urllib.request.Request(url, headers={"User-Agent": "argus-sih"})
                with urllib.request.urlopen(req, timeout=60) as r, open(dest, "wb") as fh:
                    while True:
                        chunk = r.read(1 << 20)
                        if not chunk:
                            break
                        fh.write(chunk)
                sz = os.path.getsize(dest)
                log(f"saved {fname} ({sz} bytes)")
                if sz < 1_000_000:
                    log("too small, trying next"); continue
                done = dest
                break
            except Exception as e:
                log(f"WARN {type(e).__name__}: {str(e)[:160]}")
        if done:
            break
    if done:
        try:
            from ultralytics import YOLO
            m = YOLO(done)
            log(f"VALIDATE classes: {m.names}")
        except Exception as e:
            log(f"VALIDATE WARN: {e}")
    else:
        log("DOWNLOAD FAILED (offline?) - code fallbacks (voting+Tesseract) still apply")
log("DONE")
