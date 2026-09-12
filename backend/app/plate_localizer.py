"""Classical-CV plate candidate finder (fallback when no plate-trained YOLO weights).

Given a vehicle crop (BGR), find plate-like rectangles:
  grayscale -> bilateral filter -> Sobel-X edges -> Otsu threshold
  -> close morphology -> findContours -> filter by aspect ratio,
  area, solidity. Returns boxes in vehicle-crop coordinates [x1,y1,x2,y2].
"""
import cv2
import numpy as np
from typing import List


class PlateLocalizer:
    def __init__(self, min_area: int = 150, min_ar: float = 1.5, max_ar: float = 7.0):
        self.min_area = min_area
        self.min_ar = min_ar
        self.max_ar = max_ar

    def locate(self, vehicle_crop: np.ndarray) -> List[List[int]]:
        """Multi-cue plate candidates inside a vehicle crop.

        Combines: (1) Sobel-X edge morphology at 2 kernel sizes,
        (2) white/yellow color mask (Indian plates are white or yellow),
        (3) MSER text-region proposals. Returns up to 6 boxes sorted by
        score, in vehicle-crop coords. A lower-band fallback is appended
        when nothing is found so small plates still reach the OCR gate.
        """
        if vehicle_crop is None or vehicle_crop.size == 0:
            return []
        h, w = vehicle_crop.shape[:2]
        if h < 20 or w < 20:
            return []
        cands = []

        gray = cv2.cvtColor(vehicle_crop, cv2.COLOR_BGR2GRAY)
        gray = cv2.bilateralFilter(gray, 9, 75, 75)

        # --- Cue 1: Sobel-X edge morphology (2 kernel sizes) ---
        try:
            sobelx = cv2.Sobel(gray, cv2.CV_8U, 1, 0, ksize=3)
            _, th = cv2.threshold(sobelx, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            for ksize in ((17, 5), (11, 4)):
                kernel = cv2.getStructuringElement(cv2.MORPH_RECT, ksize)
                closed = cv2.morphologyEx(th, cv2.MORPH_CLOSE, kernel)
                contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                for cnt in contours:
                    box = self._score_contour(cnt, w, h)
                    if box:
                        score, b = box
                        cands.append((score + 2.0, b))  # edge cue weighted highest
        except Exception:
            pass

        # --- Cue 2: white/yellow color mask (plate background) ---
        try:
            hsv = cv2.cvtColor(vehicle_crop, cv2.COLOR_BGR2HSV)
            # white: low saturation, high value
            white = cv2.inRange(hsv, (0, 0, 170), (180, 60, 255))
            # yellow (commercial plates): hue ~20-35
            yellow = cv2.inRange(hsv, (18, 80, 120), (38, 255, 255))
            mask = cv2.bitwise_or(white, yellow)
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE,
                                    cv2.getStructuringElement(cv2.MORPH_RECT, (15, 5)))
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN,
                                    cv2.getStructuringElement(cv2.MORPH_RECT, (5, 3)))
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for cnt in contours:
                box = self._score_contour(cnt, w, h)
                if box:
                    score, b = box
                    cands.append((score + 1.0, b))
        except Exception:
            pass

        # --- Cue 3: MSER text-region proposals ---
        try:
            mser = cv2.MSER_create(_delta=5, _min_area=120, _max_area=int(w * h * 0.4))
            regions, _ = mser.detectRegions(gray)
            for pts in regions[:60]:
                x, y, cw, ch = cv2.boundingRect(pts)
                if ch <= 0:
                    continue
                ar = cw / float(ch)
                if not (self.min_ar <= ar <= self.max_ar):
                    continue
                if x < 0 or y < 0 or x + cw > w or y + ch > h:
                    continue
                area = cw * ch
                if area < self.min_area:
                    continue
                cands.append((float(area) / 1000.0, [int(x), int(y), int(x + cw), int(y + ch)]))
        except Exception:
            pass

        # Deduplicate overlapping boxes (keep best score)
        cands.sort(key=lambda t: t[0], reverse=True)
        kept = []
        for score, b in cands:
            dup = False
            for _, k in kept:
                if self._iou(b, k) > 0.5:
                    dup = True
                    break
            if not dup:
                kept.append((score, b))
            if len(kept) >= 6:
                break
        boxes = [b for _, b in kept]
        if not boxes:
            # Best-effort fallback: lower-middle band where plates live
            # (cars: bumper; bikes: rear). OCR gate rejects non-plates.
            bw = int(w * 0.62)
            bh = int(h * 0.22)
            bx = (w - bw) // 2
            by = int(h * 0.58)
            if bw >= 20 and bh >= 8:
                boxes = [[bx, by, bx + bw, by + bh]]
        return boxes

    @staticmethod
    def _iou(a: List[int], b: List[int]) -> float:
        x1, y1 = max(a[0], b[0]), max(a[1], b[1])
        x2, y2 = min(a[2], b[2]), min(a[3], b[3])
        if x2 <= x1 or y2 <= y1:
            return 0.0
        inter = (x2 - x1) * (y2 - y1)
        union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
        return inter / union if union > 0 else 0.0

    def _score_contour(self, cnt, w: int, h: int):
        """Filter one contour by area/aspect/solidity; return (score, box) or None."""
        area = cv2.contourArea(cnt)
        if area < self.min_area:
            return None
        x, y, cw, ch = cv2.boundingRect(cnt)
        if ch <= 0:
            return None
        ar = cw / float(ch)
        if not (self.min_ar <= ar <= self.max_ar):
            return None
        try:
            hull_area = cv2.contourArea(cv2.convexHull(cnt))
        except Exception:
            return None
        solidity = (area / hull_area) if hull_area > 0 else 0
        if solidity < 0.35:
            return None
        if x < 0 or y < 0 or x + cw > w or y + ch > h:
            return None
        return area * solidity, [int(x), int(y), int(x + cw), int(y + ch)]
