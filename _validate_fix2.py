"""Quick re-validate cam-scan fix (compile only, fast). Writes _camfix2.txt"""
import subprocess, sys, os
root = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
out = []
for f in ["backend/app/plate_detector.py", "backend/app/plate_localizer.py",
          "backend/app/tracker.py", "backend/edge_pipeline.py", "backend/app/main.py"]:
    r = subprocess.run([sys.executable, "-m", "py_compile", os.path.join(root, f)],
                       capture_output=True, text=True)
    out.append(f"COMPILE {f}: {'OK' if r.returncode == 0 else 'FAIL ' + r.stderr[-400:]}")
open(os.path.join(root, "_camfix2.txt"), "w", encoding="utf-8").write("\n".join(out))
print("\n".join(out))
