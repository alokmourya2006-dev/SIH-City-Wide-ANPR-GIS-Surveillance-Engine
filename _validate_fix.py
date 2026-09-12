"""Validate cam-scanning fix: compile checks + offline synthetic plate test."""
import subprocess, sys, os
root = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
out = []
files = ["backend/app/plate_detector.py", "backend/app/plate_localizer.py",
         "backend/app/tracker.py", "backend/edge_pipeline.py",
         "backend/app/main.py", "backend/scripts/download_plate_model.py",
         "backend/test_plate_detection.py"]
for f in files:
    r = subprocess.run([sys.executable, "-m", "py_compile", os.path.join(root, f)],
                       capture_output=True, text=True)
    out.append(f"COMPILE {f}: {'OK' if r.returncode == 0 else 'FAIL ' + r.stderr[-500:]}")
r = subprocess.run([sys.executable, os.path.join(root, "backend", "test_plate_detection.py")],
                   capture_output=True, text=True, timeout=120,
                   cwd=os.path.join(root, "backend"))
out.append("--- SYNTHETIC PLATE TEST ---")
out.append((r.stdout.strip() or "(no stdout)")[-1500:])
if r.stderr.strip():
    out.append("STDERR tail: " + r.stderr.strip()[-500:])
out.append(f"EXIT={r.returncode}")
with open(os.path.join(root, "_camfix_out.txt"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(out))
print("\n".join(out))
