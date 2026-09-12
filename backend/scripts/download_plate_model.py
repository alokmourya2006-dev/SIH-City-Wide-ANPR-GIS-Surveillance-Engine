"""Download plate-trained YOLO weights into backend/models/ (stdlib only).

Prefers license-plate-finetune-v1s.pt (~19MB), falls back to v1n (~6MB)
with --small. Skips download if the file already exists, then validates
by loading with YOLO() and printing class names.
"""
import argparse
import os
import sys
import urllib.request

BASE_URLS = [
    "https://huggingface.co/muhammad-arslan-chaudhary/yolo-v8-license-plate-detection/resolve/main",
    "https://huggingface.co/ultralyticsplus/yolov8s-license-plate-detection/resolve/main",
]
FILES = {
    "license-plate-finetune-v1s.pt": "license-plate-finetune-v1s.pt",
    "license-plate-finetune-v1n.pt": "license-plate-finetune-v1n.pt",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--small", action="store_true", help="Download v1n (~6MB) instead of v1s (~19MB)")
    ap.add_argument("--dest", default=os.path.join(os.path.dirname(__file__), "..", "models"))
    args = ap.parse_args()

    fname = FILES["license-plate-finetune-v1n.pt"] if args.small else FILES["license-plate-finetune-v1s.pt"]
    os.makedirs(args.dest, exist_ok=True)
    dest = os.path.join(args.dest, fname)
    if os.path.exists(dest) and os.path.getsize(dest) > 1_000_000:
        print(f"[SKIP] exists: {dest} ({os.path.getsize(dest)} bytes)")
    else:
        last_err = None
        for base in BASE_URLS:
            url = f"{base}/{fname}"
            try:
                print(f"[DOWNLOAD] {url}")
                urllib.request.urlretrieve(url, dest)
                print(f"[OK] saved {dest} ({os.path.getsize(dest)} bytes)")
                last_err = None
                break
            except Exception as e:
                last_err = e
                print(f"[WARN] {e}")
        if last_err is not None:
            print(f"[FAIL] could not download {fname}: {last_err}")
            sys.exit(1)

    # Validate by loading with YOLO
    try:
        from ultralytics import YOLO
        m = YOLO(dest)
        print(f"[VALIDATE] classes: {m.names} | file: {dest}")
    except Exception as e:
        print(f"[VALIDATE WARN] YOLO load failed (torch/ultralytics missing?): {e}")


if __name__ == "__main__":
    main()
