"""Download plate model from private/gated bucket repo.
Repo: alok20262006/yolov8-license-plate-detection-bucket
Needs: $env:HF_TOKEN = 'hf_...' (a Read token that has access to the repo).
Writes _dl_bucket_report.txt. Tries filenames: best.pt, *.pt via HF API file list.
Usage:
  $env:HF_TOKEN='hf_xxx'
  python _dl_private_bucket.py
"""
import os, json, urllib.request
ROOT = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
RPT = os.path.join(ROOT, "_dl_bucket_report.txt")
REPO = "alok20262006/yolov8-license-plate-detection-bucket"
out = []
def log(s):
    print(s, flush=True); out.append(s)
    open(RPT, "w", encoding="utf-8").write("\n".join(out))
tok = os.environ.get("HF_TOKEN", "").strip()
if not tok or not tok.startswith("hf_"):
    log("NO VALID HF_TOKEN. Set it first (PowerShell):")
    log("  $env:HF_TOKEN='hf_paste_token_here'")
    log("Get one: https://huggingface.co/settings/tokens -> Create (Read).")
    log("Then re-run: python _dl_private_bucket.py")
    raise SystemExit(1)
hdr = {"Authorization": f"Bearer {tok}", "User-Agent": "argus-sih"}
# 1. List repo files via HF API
try:
    log(f"Listing files in {REPO} ...")
    req = urllib.request.Request(f"https://huggingface.co/api/models/{REPO}", headers=hdr)
    with urllib.request.urlopen(req, timeout=30) as r:
        info = json.loads(r.read().decode())
    sibs = [s.get("rfilename") for s in info.get("siblings", [])]
    log(f"files: {sibs}")
except Exception as e:
    log(f"API LIST WARN {type(e).__name__}: {str(e)[:200]}")
    sibs = []
cands = [f for f in sibs if f.endswith(".pt")]
if not cands:
    cands = ["best.pt", "license-plate-finetune-v1n.pt", "license-plate-finetune-v1s.pt"]
    log(f"no .pt in listing (or list blocked) -> trying defaults {cands}")
mdir = os.path.join(ROOT, "backend", "models")
os.makedirs(mdir, exist_ok=True)
done = None
for fname in cands:
    url = f"https://huggingface.co/{REPO}/resolve/main/{fname}"
    dest = os.path.join(mdir, "license-plate-finetune-v1n.pt")
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
        log(f"saved {fname} -> {dest} ({total} bytes)")
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
    log("FAILED. Checklist: token starts hf_, has Read, you accepted repo terms / were granted access.")
