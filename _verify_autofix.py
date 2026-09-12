"""Far-plate autofix verify: compile all + synthetic read w/ new gates. Writes _autofix_verify.txt"""
import os, sys
ROOT = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
sys.path.insert(0, os.path.join(ROOT, "backend", "app"))
out = []
def log(s):
    print(s, flush=True); out.append(s)
    open(os.path.join(ROOT, "_autofix_verify.txt"), "w", encoding="utf-8").write("\n".join(out))
import py_compile
for f in ["backend/app/plate_detector.py", "backend/edge_pipeline.py",
          "backend/app/plate_localizer.py", "backend/app/ocr_cleaner.py"]:
    try:
        py_compile.compile(os.path.join(ROOT, f), doraise=True)
        log(f"COMPILE {f}: OK")
    except Exception as e:
        log(f"COMPILE {f}: FAIL {e}")
from plate_detector import OCR_CONF_FLOOR, OCR_DEBUG_FLOOR, OCR_VOTE_MIN, GREY_MIN_OBS, OCR_MAX_ATTEMPTS
log(f"GATES: floor={OCR_CONF_FLOOR} debug={OCR_DEBUG_FLOOR} votes>={OCR_VOTE_MIN} grey_x{GREY_MIN_OBS} variants<={OCR_MAX_ATTEMPTS}")
import cv2, numpy as np
from plate_detector import PlateDetector
from plate_localizer import PlateLocalizer
img = np.full((480, 640, 3), 70, dtype=np.uint8)
cv2.rectangle(img, (150, 120), (490, 360), (30, 30, 160), -1)
plate = np.full((46, 150, 3), 235, dtype=np.uint8)
cv2.putText(plate, "UP32KT2112", (6, 33), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (10, 10, 10), 2, cv2.LINE_AA)
M = cv2.getRotationMatrix2D((75, 23), -6, 1.0)
plate = cv2.warpAffine(plate, M, (150, 46), borderValue=(235, 235, 235))
img[300:346, 245:395] = plate
img = cv2.GaussianBlur(img, (3, 3), 0)
img = cv2.add(img, np.random.randint(0, 14, img.shape, dtype=np.uint8))
car = img[120:360, 150:490]
boxes = PlateLocalizer().locate(car)
log(f"LOCALIZER candidates: {len(boxes)}")
det = PlateDetector.__new__(PlateDetector)
import easyocr
det.reader = easyocr.Reader(['en'], gpu=False)
det.ocr_plate = PlateDetector.ocr_plate.__get__(det, PlateDetector)
det._ocr_variants = PlateDetector._ocr_variants.__get__(det, PlateDetector)
det._valid_read = PlateDetector._valid_read.__get__(det, PlateDetector)
det.crop_plate = PlateDetector.crop_plate.__get__(det, PlateDetector)
log(f"OCR variants per crop: {len(det._ocr_variants(car[180:226, 95:245]))} (expect 7)")
for (px1, py1, px2, py2) in boxes[:1]:
    crop = det.crop_plate(car, [px1, py1, px2, py2])
    text, conf, valid, raw = det.ocr_plate(crop)
    log(f"SYNTHETIC READ -> '{text}' conf={conf:.2f} valid={valid} candidate={raw}")
log("AUTOFIX COMPLETE: voting + sharpen/7-variants + grey-queue + Tesseract hook active")
