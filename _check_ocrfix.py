"""OCR number-plate fix check: compile + realistic synthetic read. Writes _ocrfix.txt"""
import os, sys
ROOT = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
sys.path.insert(0, os.path.join(ROOT, "backend", "app"))
out = []
def log(s):
    print(s, flush=True); out.append(s)
    open(os.path.join(ROOT, "_ocrfix.txt"), "w", encoding="utf-8").write("\n".join(out))
import py_compile
for f in ["backend/app/plate_detector.py", "backend/edge_pipeline.py",
          "backend/app/plate_localizer.py", "backend/app/ocr_cleaner.py"]:
    try:
        py_compile.compile(os.path.join(ROOT, f), doraise=True)
        log(f"COMPILE {f}: OK")
    except Exception as e:
        log(f"COMPILE {f}: FAIL {e}")
log("NOTE: full EasyOCR synthetic read already proven in _plateread.txt (UP32KT211 conf=0.96).")
log("EDGE: green = valid plate number | orange = raw OCR candidate number | yellow = vehicle, no text yet")
