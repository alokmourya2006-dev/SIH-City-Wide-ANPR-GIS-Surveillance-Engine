"""Compile check for plate-read fix. Writes _compile_plate.txt"""
import py_compile, os
ROOT = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
out = []
for f in ["backend/app/plate_detector.py", "backend/app/plate_localizer.py",
          "backend/app/ocr_cleaner.py", "backend/edge_pipeline.py",
          "backend/scripts/download_plate_model.py"]:
    try:
        py_compile.compile(os.path.join(ROOT, f), doraise=True)
        out.append(f"COMPILE {f}: OK")
    except Exception as e:
        out.append(f"COMPILE {f}: FAIL {e}")
open(os.path.join(ROOT, "_compile_plate.txt"), "w", encoding="utf-8").write("\n".join(out))
print("\n".join(out))
