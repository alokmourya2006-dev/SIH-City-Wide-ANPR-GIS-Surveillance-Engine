"""
YOLOv8-based license plate detection + OCR module.
Detects plates first, then runs OCR only on the cropped plate region.
"""
import cv2
import numpy as np
import re
from ultralytics import YOLO

from ocr_cleaner import fix_ocr_errors, is_valid_plate

try:
    from plate_localizer import PlateLocalizer
except ImportError:
    PlateLocalizer = None
import os

PLATE_MODEL_PATH = "license-plate-finetune-v1n.pt"
# COCO vehicle class -> readable vehicle type
VEHICLE_TYPE_MAP = {2: "CAR", 3: "MOTORCYCLE", 5: "BUS", 7: "TRUCK"}
OCR_CONF_FLOOR = 0.15
OCR_MIN_LEN_VALID = 8
OCR_MAX_ATTEMPTS = 7
# DEBUG gate: anything EasyOCR reads at >= this conf is surfaced on the
# overlay/pushed as a candidate even if it fails the strict plate regex,
# so the operator SEES what OCR produces instead of silence.
OCR_DEBUG_FLOOR = 0.08
# Voting gate: same text from >=2 variants -> promote to valid even at low
# conf (far plates read weakly but consistently).
OCR_VOTE_MIN = 2
# Grey-zone queue: valid-format reads at 0.08-0.15 need N repeats before
# ingest (avoids phantom alerts while catching far plates over frames).
GREY_MIN_OBS = 3
# Webcam reality: plates are small/far. Vehicle gate must be lenient,
# plate gate stays strict (w>=20px) so only real plate regions reach OCR.
MIN_VEHICLE_W = 40
MIN_VEHICLE_H = 40
MIN_VEHICLE_CONF = 0.25
MIN_PLATE_W = 16
MIN_PLATE_H = 8

class PlateDetector:
    def __init__(self, model_path: str = None, ocr_reader=None, plate_model_path: str = None):
        """
        Initialize YOLOv8 detector and OCR reader.
        Loads a plate-trained model when available (mode='plate'),
        else falls back to vehicle detection + classical plate localizer.
        """
        plate_model_path = plate_model_path or os.getenv("PLATE_MODEL_PATH", None) or PLATE_MODEL_PATH
        candidates = []
        if model_path:
            candidates.append(model_path)
        # Prefer the actual plate weights present on disk (v1n or v1s, any dir).
        for _name in ("license-plate-finetune-v1n.pt", "license-plate-finetune-v1s.pt",
                      "best.pt"):
            for _base in (plate_model_path, _name,
                          os.path.join("models", _name),
                          os.path.join(os.path.dirname(__file__), "..", "models", _name)):
                if _base and os.path.exists(_base) and _base not in candidates:
                    candidates.append(_base)
        candidates += ["yolov8n.pt"]
        self.model = None
        self.vehicle_model = None  # COCO model used to tag plate -> bike/car
        self.mode = "vehicle+localizer"
        self.plate_classes = set()
        for cand in candidates:
            try:
                if cand and os.path.exists(cand):
                    m = YOLO(cand)
                    names = getattr(m, "names", {}) or {}
                    name_str = " ".join(str(v).lower() for v in names.values())
                    if any(k in name_str for k in ("plate", "licence", "license", "number")):
                        self.model = m
                        self.mode = "plate"
                        self.plate_classes = set(names.keys())
                        model_path = cand
                        break
                    # keep first loadable model as vehicle fallback
                    if self.model is None:
                        self.model = m
                        model_path = cand
            except Exception:
                continue
        if self.model is None:
            self.model = YOLO("yolov8n.pt")
        # Vehicle classifier: in plate mode also load COCO yolov8n once so the
        # matching vehicle type (bike/car) can be tagged onto each plate box.
        try:
            _vpaths = ["yolov8n.pt",
                       os.path.join("..", "yolov8n.pt"),
                       os.path.join(os.path.dirname(__file__), "..", "yolov8n.pt"),
                       os.path.join(os.path.dirname(__file__), "..", "..", "yolov8n.pt")]
            _vp = next((p for p in _vpaths if p and os.path.exists(p)), None)
            if _vp:
                self.vehicle_model = YOLO(_vp)
        except Exception:
            self.vehicle_model = None
        self.localizer = PlateLocalizer() if PlateLocalizer is not None else None
        
        if ocr_reader is None:
            import easyocr
            self.reader = easyocr.Reader(['en'], gpu=False)
        else:
            self.reader = ocr_reader

    def detect_plates(self, frame, vehicle_classes=(2, 3, 5, 7)) -> list:
        """
        Plate-model path: detect plates directly.
        Fallback: detect vehicles then find plate candidates inside each
        vehicle crop with PlateLocalizer. Boxes < 24px wide are skipped.
        Returns list of dicts: {bbox, plate_bbox, vehicle_bbox, confidence, class, kind}
        """
        results = self.model(frame, verbose=False)
        detections = []

        if self.mode == "plate":
            for result in results:
                boxes = result.boxes
                if boxes is None:
                    continue
                for box in boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    conf = float(box.conf[0])
                    cls = int(box.cls[0])
                    if self.plate_classes and cls not in self.plate_classes:
                        # plate model with single class: class 0
                        if len(self.plate_classes) > 1:
                            continue
                    if conf < 0.30:
                        continue
                    w = x2 - x1
                    if w < 24:
                        continue
                    pb = [int(x1), int(y1), int(x2), int(y2)]
                    vb, vtype = None, None
                    if self.vehicle_model is not None:
                        try:
                            vres = self.vehicle_model(frame, verbose=False)
                            vbx = None
                            for _r in vres:
                                if getattr(getattr(_r, "boxes", None), "xyxy", None) is None:
                                    continue
                                for _b in _r.boxes:
                                    _c = int(getattr(_b, "cls", [0])[0])
                                    if _c not in VEHICLE_TYPE_MAP:
                                        continue
                                    _x1, _y1, _x2, _y2 = _b.xyxy[0].tolist()
                                    # plate center must fall inside the vehicle box
                                    _cx = (pb[0] + pb[2]) / 2.0
                                    _cy = (pb[1] + pb[3]) / 2.0
                                    if _x1 <= _cx <= _x2 and _y1 <= _cy <= _y2:
                                        vbx = [int(_x1), int(_y1), int(_x2), int(_y2)]
                                        vtype = VEHICLE_TYPE_MAP[_c]
                                        break
                                if vbx:
                                    break
                            vb = vbx
                        except Exception:
                            vb, vtype = None, None
                    detections.append({
                        "bbox": pb,
                        "plate_bbox": pb,
                        "vehicle_bbox": vb,
                        "vehicle_type": vtype or "UNKNOWN",
                        "confidence": conf,
                        "class": cls,
                        "kind": "plate",
                    })
            return detections

        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue
                
            for box in boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                cls = int(box.cls[0])
                
                # Focus on vehicle classes only (skip person, stop sign, etc.)
                if cls not in vehicle_classes:
                    continue
                if conf < MIN_VEHICLE_CONF:
                    continue
                # Ignore tiny boxes (noise) - plate can't be read.
                # NOTE: 40px (not 60) so bikes / distant cars still pass;
                # plate-localizer + OCR gate below decide readability.
                w, h = x2 - x1, y2 - y1
                if w < MIN_VEHICLE_W or h < MIN_VEHICLE_H:
                    continue
                vx1, vy1, vx2, vy2 = int(x1), int(y1), int(x2), int(y2)
                vehicle_crop = frame[max(0, vy1):vy2, max(0, vx1):vx2]
                if vehicle_crop.size == 0:
                    continue
                # Find plate candidates inside the vehicle
                cands = self.localizer.locate(vehicle_crop) if self.localizer else []
                if not cands:
                    # Whole-vehicle OCR fallback is DISABLED: it reads random
                    # text (faces, signs) as plates -> phantom alerts.
                    continue
                for (px1, py1, px2, py2) in cands:
                    gx1, gy1, gx2, gy2 = vx1 + px1, vy1 + py1, vx1 + px2, vy1 + py2
                    if gx2 - gx1 < MIN_PLATE_W or gy2 - gy1 < MIN_PLATE_H:
                        continue
                    detections.append({
                        "bbox": [gx1, gy1, gx2, gy2],
                        "plate_bbox": [gx1, gy1, gx2, gy2],
                        "vehicle_bbox": [vx1, vy1, vx2, vy2],
                        "vehicle_type": VEHICLE_TYPE_MAP.get(cls, "UNKNOWN"),
                        "confidence": conf,
                        "class": cls,
                        "kind": "vehicle",
                    })
        
        return detections

    def crop_plate(self, frame, bbox) -> np.ndarray:
        """
        Crop the plate region from the frame with proportional padding
        + white border. EasyOCR fails on tight dark crops; padding + border
        fixes most 'vehicle found, no text' cases.
        """
        x1, y1, x2, y2 = bbox
        h, w = frame.shape[:2]
        bw, bh = max(1, x2 - x1), max(1, y2 - y1)
        # Proportional padding: 25% sides, 60% top/bottom (captures full glyphs)
        padx = int(bw * 0.25)
        pady = int(bh * 0.60)
        x1 = max(0, x1 - padx)
        y1 = max(0, y1 - pady)
        x2 = min(w, x2 + padx)
        y2 = min(h, y2 + pady)
        crop = frame[y1:y2, x1:x2]
        if crop.size == 0:
            return crop
        # White border helps EasyOCR's text detector lock on
        crop = cv2.copyMakeBorder(crop, 8, 8, 8, 8,
                                  cv2.BORDER_CONSTANT, value=(255, 255, 255))
        return crop

    def ocr_plate(self, crop) -> tuple:
        """
        Run OCR on cropped plate region using multiple preprocessing
        variants; return (plate_text, confidence, is_valid, is_candidate).
        allowlist A-Z0-9 keeps EasyOCR from hallucinating punctuation.
        Validity: conf >= OCR_CONF_FLOOR AND
          (is_valid_plate(cleaned) OR (len>=6 AND conf>=0.5)).
        Candidate (debug): any read at conf >= OCR_DEBUG_FLOOR, surfaced on
        the overlay so the operator sees OCR output instead of silence.
        """
        if crop is None or crop.size == 0:
            return "", 0.0, False, False
        variants = self._ocr_variants(crop)
        best_text, best_conf = "", 0.0
        votes = {}  # text -> [count, best_conf]
        tess_text, tess_conf = "", 0.0
        # EasyOCR knobs: alphabets only + low detection thresholds so
        # small plates are attempted instead of skipped. NOTE: extra kwargs
        # must stay compatible with the installed easyocr version, so probe
        # once and fall back to plain readtext on TypeError.
        extra = {"allowlist": "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"}
        _extra_ok = True
        attempts = 0
        for variant in variants:
            if attempts >= OCR_MAX_ATTEMPTS:
                break
            attempts += 1
            if _extra_ok:
                try:
                    results = self.reader.readtext(variant, detail=1, **extra)
                except TypeError:
                    _extra_ok = False
                    try:
                        results = self.reader.readtext(variant)
                    except Exception:
                        continue
                except Exception:
                    continue
            else:
                try:
                    results = self.reader.readtext(variant)
                except Exception:
                    continue
            if not results:
                continue
            for _bbox, text, prob in results:
                cleaned = re.sub(r'[^A-Z0-9]', '', (text or "").upper().strip())
                if not cleaned:
                    continue
                corrected = fix_ocr_errors(cleaned)
                if float(prob) > best_conf:
                    # Track the single best raw read regardless of gate...
                    best_text, best_conf = corrected, float(prob)
                # Vote counting for cross-variant consistency promotion
                try:
                    _v = votes.get(corrected, [0, 0.0])
                    _v[0] += 1
                    _v[1] = max(_v[1], float(prob))
                    votes[corrected] = _v
                except Exception:
                    pass
            # Concat fallback: EasyOCR often splits "UP32 KT 2112" into
            # fragments ("UP32", "KT", "2112") that each fail the gate but
            # join into a valid plate. Try that before giving up.
            try:
                frags = [re.sub(r'[^A-Z0-9]', '', (t or "").upper().strip())
                         for _, t, _ in results]
                frags = [f for f in frags if f]
                if len(frags) >= 2:
                    joined = fix_ocr_errors("".join(frags))
                    jconf = float(sum(float(p) for _, _, p in results) / max(len(results), 1))
                    if jconf > best_conf:
                        best_text, best_conf = joined, jconf
            except Exception:
                pass
        # --- Tesseract second-opinion (only if binary present) ---
        try:
            import shutil
            if shutil.which("tesseract"):
                import pytesseract
                for _tv in variants[:3]:
                    try:
                        _td = pytesseract.image_to_data(
                            _tv, output_type=pytesseract.Output.DICT,
                            config="--psm 8 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
                        for _t, _c in zip(_td.get("text", []), _td.get("conf", [])):
                            _tc = re.sub(r'[^A-Z0-9]', '', str(_t).upper().strip())
                            if len(_tc) < 4:
                                continue
                            try:
                                _cf = float(_c) / 100.0
                            except Exception:
                                continue
                            _tx = fix_ocr_errors(_tc)
                            _v = votes.get(_tx, [0, 0.0])
                            _v[0] += 1
                            _v[1] = max(_v[1], _cf)
                            votes[_tx] = _v
                            if _cf > tess_conf:
                                tess_text, tess_conf = _tx, _cf
                    except Exception:
                        continue
        except Exception:
            pass
        # Gate AFTER all variants: return best raw read + validity flag.
        # Caller decides: valid -> ingest; debug-floor -> show as candidate.
        # Voting promotion: same text from >=2 variants counts as valid even
        # at low conf (far plates read weakly but consistently).
        _vn, _vc = votes.get(best_text, [0, best_conf])
        _voted = _vn >= OCR_VOTE_MIN and is_valid_plate(best_text) and best_conf >= OCR_DEBUG_FLOOR
        if tess_text and tess_text == best_text and tess_conf >= OCR_DEBUG_FLOOR:
            _voted = True  # both engines agree
            best_conf = max(best_conf, tess_conf)
        valid = self._valid_read(best_text, best_conf) or _voted
        raw_ok = bool(best_text) and best_conf >= OCR_DEBUG_FLOOR
        return best_text, best_conf, valid, raw_ok

    def _valid_read(self, text: str, conf: float) -> bool:
        if not text or conf < OCR_CONF_FLOOR:
            return False
        if is_valid_plate(text):
            return True
        # Near-miss fallback: long high-confidence alphanumeric strings
        # (e.g. BHARAT plates, new formats) still surface as candidates.
        return len(text) >= 6 and conf >= 0.5

    def _ocr_variants(self, crop) -> list:
        """Upscale + denoise + sharpen + CLAHE + threshold variants.

        Small crops get 4x, medium 3x, large 2x so characters always land
        in EasyOCR's readable size band. Sharpen + 7 variants (was 5).
        """
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape[:2]
        scale = 4.0 if max(h, w) < 80 else 3.0 if max(h, w) < 160 else 2.0
        up = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        up = cv2.fastNlMeansDenoising(up, None, 7, 7, 21)
        # Unsharp mask: far-plate glyph edges are mush without this
        try:
            blur = cv2.GaussianBlur(up, (0, 0), 2.0)
            up = cv2.addWeighted(up, 1.6, blur, -0.6, 0)
        except Exception:
            pass
        out = [up]
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        out.append(clahe.apply(up))
        _, otsu = cv2.threshold(up, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        out.append(otsu)
        # inverted (dark-on-light vs light-on-dark plates) + adaptive
        out.append(cv2.bitwise_not(otsu))
        out.append(cv2.adaptiveThreshold(up, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                         cv2.THRESH_BINARY, 31, 9))
        # bilateral + tophat (headlight washout / shadowed plates)
        try:
            out.append(cv2.bilateralFilter(up, 7, 80, 80))
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 5))
            out.append(cv2.morphologyEx(up, cv2.MORPH_TOPHAT, kernel))
        except Exception:
            pass
        return out

    def process_frame(self, frame, include_candidates: bool = False) -> list:
        """
        Full pipeline: detect plates -> crop -> OCR.
        Returns list of dicts: {bbox, plate_bbox, vehicle_bbox, kind,
        plate_text, confidence, detection_conf, valid}.
        Valid reads always returned. Raw candidates (OCR text below the
        strict gate) are included when include_candidates=True so the
        operator sees numbers on the overlay instead of bare vehicle boxes.
        """
        detections = self.detect_plates(frame)
        results = []

        for det in detections:
            crop = self.crop_plate(frame, det["bbox"])
            plate_text, ocr_conf, valid, raw_ok = self.ocr_plate(crop)
            if valid:
                results.append({
                    "bbox": det["bbox"],
                    "plate_bbox": det.get("plate_bbox", det["bbox"]),
                    "vehicle_bbox": det.get("vehicle_bbox"),
                    "vehicle_type": det.get("vehicle_type", "UNKNOWN"),
                    "kind": det.get("kind", "vehicle"),
                    "plate_text": plate_text,
                    "confidence": ocr_conf,
                    "detection_conf": det["confidence"],
                    "valid": True,
                })
            elif include_candidates and raw_ok and plate_text:
                results.append({
                    "bbox": det["bbox"],
                    "plate_bbox": det.get("plate_bbox", det["bbox"]),
                    "vehicle_bbox": det.get("vehicle_bbox"),
                    "vehicle_type": det.get("vehicle_type", "UNKNOWN"),
                    "kind": det.get("kind", "vehicle"),
                    "plate_text": plate_text,
                    "confidence": ocr_conf,
                    "detection_conf": det["confidence"],
                    "valid": False,
                })

        return results