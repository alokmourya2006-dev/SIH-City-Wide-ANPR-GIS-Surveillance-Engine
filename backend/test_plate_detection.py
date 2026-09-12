"""Offline proof: synthesize an Indian plate image, run full PlateDetector, assert read.

Usage: python test_plate_detection.py
Renders UP32KT2112 (black on white, realistic sizes) at 1280x720, runs
PlateDetector.process_frame() with stubbed OCR (no EasyOCR needed), and
asserts is_valid_plate(read) and conf >= 0.35. Also tries a small variant.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "app"))

import cv2
import numpy as np

from plate_detector import PlateDetector
from ocr_cleaner import is_valid_plate


class StubReader:
    """Pretend EasyOCR reader returning the known plate text."""

    def __init__(self, text="UP32KT2112"):
        self.text = text

    def readtext(self, img):
        return [([0, 0, 10, 10], self.text, 0.92)]


class FakePlateModel:
    """Pretend plate-trained YOLO: returns one plate box where we drew it."""

    def __init__(self, box):
        self.box = box
        self.names = {0: "license_plate"}

    def __call__(self, frame, verbose=False):
        class Box:
            def __init__(self, b):
                self._b = b

            @property
            def xyxy(self):
                import torch
                return [torch.tensor(self._b, dtype=torch.float32)]

            @property
            def conf(self):
                import torch
                return [torch.tensor(0.9)]

            @property
            def cls(self):
                import torch
                return [torch.tensor(0.0)]

        class Result:
            def __init__(self, boxes):
                self.boxes = boxes

        class Boxes(list):
            pass

        return [Result(Boxes([Box(self.box)]))]


def render_plate(width=1280, height=720, plate_w=220, plate_h=60):
    img = np.full((height, width, 3), 60, dtype=np.uint8)  # dark road bg
    x, y = (width - plate_w) // 2, (height - plate_h) // 2
    cv2.rectangle(img, (x, y), (x + plate_w, y + plate_h), (255, 255, 255), -1)
    cv2.rectangle(img, (x, y), (x + plate_w, y + plate_h), (0, 0, 0), 2)
    cv2.putText(img, "UP32KT2112", (x + 10, y + plate_h - 12),
                cv2.FONT_HERSHEY_SIMPLEX, 1.1, (0, 0, 0), 2, cv2.LINE_AA)
    return img, [float(x), float(y), float(x + plate_w), float(y + plate_h)]


def run_case(tag, plate_w, plate_h):
    img, box = render_plate(plate_w=plate_w, plate_h=plate_h)
    det = PlateDetector.__new__(PlateDetector)
    from plate_detector import OCR_CONF_FLOOR  # noqa
    det.model = FakePlateModel(box)
    det.mode = "plate"
    det.plate_classes = {0}
    det.reader = StubReader()
    dets = det.process_frame(img)
    ok = bool(dets) and is_valid_plate(dets[0]["plate_text"]) and dets[0]["confidence"] >= 0.35
    print(f"[{tag}] plate {plate_w}x{plate_h} -> {dets} | valid+conf>=0.35: {ok}")
    return ok


def main():
    ok1 = run_case("NORMAL", 220, 60)
    ok2 = run_case("SMALL", 90, 28)
    if ok1 and ok2:
        print("PASS: synthetic plate reads are valid with conf >= 0.35")
    else:
        print("FAIL: synthetic plate read failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
