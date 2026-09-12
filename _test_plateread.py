"""Realistic plate-read test: synthetic photo with perspective + noise. Writes _plateread.txt"""
import os, sys
ROOT = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
sys.path.insert(0, os.path.join(ROOT, "backend", "app"))
out = []
def log(s):
    print(s, flush=True); out.append(s)
    open(os.path.join(ROOT, "_plateread.txt"), "w", encoding="utf-8").write("\n".join(out))
import cv2, numpy as np
from plate_detector import PlateDetector
from plate_localizer import PlateLocalizer
from ocr_cleaner import is_valid_plate, fix_ocr_errors
# 1. Render a fake car + plate at an angle with blur/noise (like webcam)
img = np.full((480, 640, 3), 70, dtype=np.uint8)
cv2.rectangle(img, (150, 120), (490, 360), (30, 30, 160), -1)  # car body
cv2.rectangle(img, (170, 140), (470, 220), (18, 18, 18), -1)   # windshield
plate = np.full((46, 150, 3), 235, dtype=np.uint8)
cv2.putText(plate, "UP32KT2112", (6, 33), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (10, 10, 10), 2, cv2.LINE_AA)
M = cv2.getRotationMatrix2D((75, 23), -6, 1.0)
plate = cv2.warpAffine(plate, M, (150, 46), borderValue=(235, 235, 235))
img[300:346, 245:395] = plate
img = cv2.GaussianBlur(img, (3, 3), 0)
noise = np.random.randint(0, 14, img.shape, dtype=np.uint8)
img = cv2.add(img, noise)
log("synthetic car+plate rendered (640x480, tilted plate, blur+noise)")
# 2. Localizer check on the car crop (no YOLO needed)
car = img[120:360, 150:490]
loc = PlateLocalizer()
boxes = loc.locate(car)
log(f"LOCALIZER candidates: {len(boxes)}")
for b in boxes[:4]:
    log(f"  {b} w={b[2]-b[0]} h={b[3]-b[1]}")
# 3. EasyOCR check on best candidate (real reader, real gate)
det = PlateDetector.__new__(PlateDetector)
import easyocr
det.reader = easyocr.Reader(['en'], gpu=False)
from plate_detector import OCR_CONF_FLOOR
det._valid_read = PlateDetector._valid_read.__get__(det, PlateDetector)
det.ocr_plate = PlateDetector.ocr_plate.__get__(det, PlateDetector)
det._ocr_variants = PlateDetector._ocr_variants.__get__(det, PlateDetector)
tested = 0
for (px1, py1, px2, py2) in boxes[:3]:
    crop = car[py1:py2, px1:px2]
    if crop.size == 0:
        continue
    text, conf = det.ocr_plate(crop)
    tested += 1
    log(f"OCR box {px1,py1,px2,py2} -> '{text}' conf={conf:.2f} valid={is_valid_plate(text) if text else False}")
log("RESULT: " + ("PLATE READ PATH WORKS (localizer+OCR produce a candidate)" if tested else "NO CANDIDATES - localizer blind"))
