"""
ARGUS Edge Perception Pipeline
- YOLOv8 vehicle/plate detection
- EasyOCR on cropped plate regions
- IoU-based tracklet tracking
- Debounced telemetry ingestion to backend API

Camera source can be:
  1. Webcam (default: index 0)
  2. IP / CCTV camera (RTSP or HTTP URL)
  3. Video file (.mp4, .avi, ...)

Usage:
  python edge_pipeline.py                          # webcam 0
  python edge_pipeline.py --source 1               # webcam index 1
  python edge_pipeline.py --source rtsp://user:pass@192.168.1.64:554/stream  # IP camera
  python edge_pipeline.py --source video.mp4       # video file
  python edge_pipeline.py --camera-id CAM_LKO_HAZRATGANJ_01
  python edge_pipeline.py --no-show                # headless (no video window)

Environment overrides: CAMERA_SOURCE, CAMERA_ID, API_INGEST_URL
"""
import argparse
import cv2
import requests
import sys
import os
from datetime import datetime

# Add app directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from plate_detector import PlateDetector
from tracker import TrackletTracker
from debouncer import DetectionDebouncer

DEFAULT_API_URL = "http://127.0.0.1:8000/api/v1/telemetry/ingest"


def register_camera(api_url, camera_id, name, lat, lon, sector, source_type, session):
    """One-time registration of this edge node with the backend."""
    try:
        resp = session.post(
            f"{api_url}/cameras/register",
            json={
                "camera_id": camera_id,
                "name": name,
                "latitude": lat,
                "longitude": lon,
                "sector": sector,
                "source_type": source_type,
            },
            timeout=2,
        )
        print(f"[REGISTER] {camera_id} -> {resp.status_code} {resp.json().get('status')}")
    except Exception as e:
        print(f"[REGISTER WARN] Could not reach backend: {e}")


def send_heartbeat(api_url, camera_id, session):
    """Periodic liveness ping so the dashboard shows this camera ONLINE."""
    try:
        session.post(f"{api_url}/cameras/heartbeat", json={"camera_id": camera_id}, timeout=2)
    except Exception:
        pass


def push_frame(api_url, camera_id, frame, session, last_send, min_interval=0.2):
    """
    Push annotated JPEG frame to backend at most every min_interval seconds.
    Returns updated last_send timestamp (time.monotonic).
    """
    import time
    now = time.monotonic()
    if last_send is not None and (now - last_send) < min_interval:
        return last_send
    ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
    if not ok:
        return last_send
    try:
        session.post(
            f"{api_url}/cameras/{camera_id}/frame",
            data=buf.tobytes(),
            headers={"Content-Type": "image/jpeg"},
            timeout=1.5,
        )
    except Exception:
        pass
    return now


def open_camera(source):
    """Open webcam index, RTSP/HTTP URL, or video file path.

    Webcam fallback: if the requested index fails, scan indices 0..3.
    Returns (cap, actual_source) so logs show which index was used.
    """
    # Integer / numeric string -> webcam index (with fallback scan)
    if isinstance(source, int) or (isinstance(source, str) and source.isdigit()):
        requested = int(source)
        tried = [requested] + [i for i in range(4) if i != requested]
        for idx in tried:
            cap = cv2.VideoCapture(idx)
            if cap.isOpened():
                if idx != requested:
                    print(f"[CAM] index {requested} unavailable, using fallback index {idx}")
                return cap, idx
            try:
                cap.release()
            except Exception:
                pass
        print(f"[ERROR] No webcam found (tried indices {tried}). "
              f"Close apps using the camera (Teams/Zoom/browser) and retry, "
              f"or use --source <video.mp4|rtsp-url|image.jpg>.")
        try:
            return cv2.VideoCapture(requested), requested
        except Exception:
            return cv2.VideoCapture(requested), requested

    # URL or file path
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        print(f"[ERROR] Cannot open source: {source}")
    return cap, source


def main():
    parser = argparse.ArgumentParser(description="ARGUS Edge Perception Pipeline")
    parser.add_argument("--source", default=os.getenv("CAMERA_SOURCE", "0"),
                        help="Webcam index (0) | RTSP/HTTP URL | video file path")
    parser.add_argument("--camera-id", default=os.getenv("CAMERA_ID", "CAM_LKO_HAZRATGANJ_01"),
                        help="Logical ID of this camera in the command center")
    parser.add_argument("--interval", type=float, default=5.0,
                        help="Minimum seconds between duplicate plate reports")
    parser.add_argument("--no-show", action="store_true",
                        help="Run headless (no live video window)")
    parser.add_argument("--api-url", default=os.getenv("API_INGEST_URL", DEFAULT_API_URL),
                        help="Backend telemetry ingest URL")
    parser.add_argument("--camera-name", default=os.getenv("CAMERA_NAME", ""),
                        help="Display name for this camera")
    parser.add_argument("--latitude", type=float, default=float(os.getenv("CAMERA_LAT", "0")),
                        help="Camera latitude for GIS map marker")
    parser.add_argument("--longitude", type=float, default=float(os.getenv("CAMERA_LON", "0")),
                        help="Camera longitude for GIS map marker")
    parser.add_argument("--sector", default=os.getenv("CAMERA_SECTOR", "SECTOR_A"),
                        help="Sector label for this camera")
    parser.add_argument("--plate-model", default=os.getenv("PLATE_MODEL_PATH", ""),
                        help="Path to plate-trained YOLO weights (license-plate-finetune-v1s.pt)")
    parser.add_argument("--ocr-throttle", type=float, default=4.0,
                        help="Max OCR runs per second (multi-variant OCR is heavier)")
    parser.add_argument("--width", type=int, default=1280, help="Capture width")
    parser.add_argument("--height", type=int, default=720, help="Capture height")
    args = parser.parse_args()

    API_INGEST_URL = args.api_url
    CAMERA_ID = args.camera_id
    CAMERA_NAME = args.camera_name or CAMERA_ID
    CAMERA_LAT = args.latitude if args.latitude != 0 else 26.8467
    CAMERA_LON = args.longitude if args.longitude != 0 else 80.9462

    # Single-shot image mode: --source photo.jpg/.png -> detect once, print, exit
    if str(args.source).lower().endswith((".jpg", ".jpeg", ".png", ".bmp", ".webp")):
        print("[INFO] Loading ARGUS Edge Perception Pipeline (single-shot)...")
        detector = PlateDetector(plate_model_path=args.plate_model or None)
        import cv2 as _cv2
        img = _cv2.imread(str(args.source))
        if img is None:
            print(f"[ERROR] Cannot read image: {args.source}")
            sys.exit(1)
        from datetime import datetime as _dt
        dets = detector.process_frame(img, include_candidates=True)
        print(f"[SINGLE-SHOT] {args.source} -> {len(dets)} valid plate read(s)")
        for d in dets:
            tag = "VALID" if d.get("valid", True) else "candidate"
            vtype = d.get("vehicle_type", "UNKNOWN")
            print(f"  [{tag}] {vtype} Plate: {d['plate_text']} | Conf: {d['confidence']:.2f} | Box: {d['bbox']}")
        if not dets:
            print("  (no valid plate found - try a closer / sharper image)")
        sys.exit(0)

    print("[INFO] Loading ARGUS Edge Perception Pipeline...")
    detector = PlateDetector(plate_model_path=args.plate_model or None)
    print(f"[INFO] Detector mode: {detector.mode}")
    tracker = TrackletTracker(iou_threshold=0.3, max_age_frames=10)
    debouncer = DetectionDebouncer(interval_seconds=args.interval)

    # Reusable HTTP session for telemetry + heartbeat + frames
    session = requests.Session()

    # Determine source type for registration
    src = str(args.source)
    source_type = "WEBCAM" if src.isdigit() else ("RTSP" if src.startswith(("rtsp", "http")) else "FILE")

    cap, actual_source = open_camera(args.source)
    if not cap.isOpened():
        print("[ERROR] Camera source unavailable. Exiting.")
        sys.exit(1)

    # Request HD but ACCEPT what the camera actually gives (do not force-pad).
    # Forcing 1280x720 on a 640x480 webcam used to stretch coords and break OCR.
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)
    actual_w = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
    actual_h = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
    print(f"[CAM] requested {args.width}x{args.height} -> actual {int(actual_w)}x{int(actual_h)}")

    print(f"[INFO] ARGUS Edge Node Active -> camera_id={CAMERA_ID}")
    print(f"[INFO] Source: {actual_source} | Debounce: {args.interval}s | Backend: {API_INGEST_URL}")

    # Derive API base (e.g. http://127.0.0.1:8000/api/v1) for register/heartbeat/frame endpoints
    API_BASE = API_INGEST_URL.split("/telemetry/ingest")[0]
    # Auto-register this camera with the backend command center
    register_camera(API_BASE, CAMERA_ID, CAMERA_NAME, CAMERA_LAT, CAMERA_LON,
                    args.sector, source_type, session)

    last_send = None
    last_heartbeat = 0.0
    last_ocr = 0.0
    ocr_cache = []  # throttled OCR reads (valid only)
    ocr_candidates = []  # raw OCR text below strict gate (overlay only)
    ocr_vehicles = []  # raw vehicle regions from the last OCR tick

    if not args.no_show:
        print("[INFO] Listen for video window. Show a license plate to camera. Press 'q' to quit.")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[WARN] Frame read failed (camera disconnected?) - retrying...")
            # Short pause and retry in case of transient RTSP glitches
            cv2.waitKey(500)
            continue

        # Step 0: Heartbeat every ~5s (also throttled by frame pushes)
        if last_heartbeat == 0.0 or (__import__("time").time() - last_heartbeat) >= 5:
            send_heartbeat(API_BASE, CAMERA_ID, session)
            last_heartbeat = __import__("time").time()

        # Step 1: Detect vehicles and read their plates. OCR is throttled
        # (multi-variant EasyOCR is heavy); between OCR ticks reuse cache.
        # ALSO report raw vehicle sightings so the operator always sees
        # "camera sees something" even when the plate text is unreadable.
        now_m = __import__("time").monotonic()
        if now_m - last_ocr >= 1.0 / max(args.ocr_throttle, 0.5):
            raw_vehicles = detector.detect_plates(frame)
            detections = []   # valid reads -> tracker + ingest
            candidates = []   # raw OCR text -> overlay only (numbers visible)
            for _v in raw_vehicles:
                _crop = detector.crop_plate(frame, _v["bbox"])
                _text, _conf, _valid, _raw = detector.ocr_plate(_crop)
                if _valid and _text:
                    detections.append({**_v, "plate_text": _text, "confidence": _conf,
                                       "detection_conf": _v["confidence"], "valid": True})
                elif _raw and _text:
                    candidates.append({**_v, "plate_text": _text, "confidence": _conf,
                                       "detection_conf": _v["confidence"], "valid": False})
            ocr_cache = detections
            ocr_candidates = candidates
            ocr_vehicles = raw_vehicles
            last_ocr = now_m
        else:
            detections = ocr_cache
            candidates = ocr_candidates
            # keep last tick's vehicle boxes so overlay stays up between OCR runs
            ocr_vehicles = ocr_vehicles

        # Throttled scan log: only on change or every ~5s
        _scan_sig = (len(ocr_vehicles), len(detections), len(candidates), detector.mode)
        if _scan_sig != globals().get("_last_scan_sig") or (now_m - globals().get("_last_scan_t", 0)) > 5:
            globals()["_last_scan_sig"] = _scan_sig
            globals()["_last_scan_t"] = now_m
            if ocr_vehicles:
                print(f"[SCAN] {len(ocr_vehicles)} vehicle region(s), "
                      f"{len(detections)} valid plate(s), "
                      f"{len(candidates)} candidate(s) (mode={detector.mode})")
                for _c in candidates[:3]:
                    print(f"   candidate '{_c.get('plate_text')}' conf={_c.get('confidence',0):.2f} "
                          f"(below strict gate - move closer / improve light)")
            else:
                print("[SCAN] no vehicle in frame - point camera at a car/bike/plate")

        # Step 2: Update tracker with VALID detections only
        from datetime import datetime, timezone as _tz
        timestamp = datetime.now(_tz.utc).isoformat()
        closed_tracklets = tracker.update(detections, timestamp)

        # Grey-zone queue: weak-but-plausible reads (conf 0.08-0.15, valid
        # format) are NOT ingested immediately. They need GREY_MIN_OBS
        # repeats within the debounce window, then go as [PLATE GREY].
        # This catches far plates over frames without phantom alerts.
        try:
            _grey = globals().setdefault("_grey_counts", {})
            try:
                from plate_detector import OCR_DEBUG_FLOOR as _DF, OCR_CONF_FLOOR as _CF, GREY_MIN_OBS as _GM
            except Exception:
                _DF, _CF, _GM = 0.08, 0.15, 3
            for _cd in candidates:
                _ct, _cc = (_cd.get("plate_text") or "").strip(), _cd.get("confidence", 0)
                if not _ct or _cc < _DF or _cc >= _CF:
                    continue
                try:
                    from ocr_cleaner import is_valid_plate as _ivp
                except Exception:
                    _ivp = lambda x: len(x) >= 6
                if not _ivp(_ct):
                    continue
                _k = f"{CAMERA_ID}:{_ct}"
                _n = _grey.get(_k, 0) + 1
                _grey[_k] = _n
                if _n >= _GM and debouncer.should_process(CAMERA_ID, _ct):
                    _grey[_k] = 0
                    try:
                        _resp = session.post(API_INGEST_URL, json={
                            "camera_id": CAMERA_ID, "plate_number": _ct,
                            "vehicle_type": _cd.get("vehicle_type", "UNKNOWN"),
                            "confidence": _cc,
                            "timestamp": timestamp}, timeout=0.8)
                        if _resp.status_code == 200:
                            print(f"[PLATE GREY x{_n}] {_ct} | Conf: {_cc:.2f} | "
                                  f"Hotlist: {_resp.json().get('hotlist_match', 'N/A')}")
                    except Exception as _e:
                        print(f"[NETWORK ERROR] Backend Unreachable: {_e}")
        except Exception:
            pass

        # Step 2b: INSTANT ingest - send every valid plate read immediately
        # (tracklet close is only a backup; waiting for it caused 10-30s delays)
        for det in detections:
            plate = (det.get("plate_text") or "").strip()
            if not plate or not detector._valid_read(plate, det.get("confidence", 0)):
                continue
            if not debouncer.should_process(CAMERA_ID, plate):
                continue
            payload = {
                "camera_id": CAMERA_ID,
                "plate_number": plate,
                "vehicle_type": det.get("vehicle_type", "UNKNOWN"),
                "confidence": det.get("confidence", 0.0),
                "timestamp": timestamp,
            }
            try:
                resp = session.post(API_INGEST_URL, json=payload, timeout=0.8)
                if resp.status_code == 200:
                    data = resp.json()
                    print(f"[PLATE OK] {det.get('vehicle_type', 'UNKNOWN')} {plate} | "
                          f"Conf: {det.get('confidence', 0):.2f} | "
                          f"Hotlist: {data.get('hotlist_match', 'N/A')}")
                else:
                    print(f"[API ERROR] Backend returned {resp.status_code}")
            except Exception as e:
                print(f"[NETWORK ERROR] Backend Unreachable: {e}")

        # Step 3: Debounce + send CLOSED tracklet events to backend (backup path)
        for tracklet in closed_tracklets:
            plate = tracklet["plate_text"]
            # Skip garbage OCR reads (too short / empty) to avoid phantom alerts
            if not plate or len(plate.strip()) < 4:
                continue
            if not debouncer.should_process(CAMERA_ID, plate):
                continue

            payload = {
                "camera_id": CAMERA_ID,
                "plate_number": plate,
                "vehicle_type": tracklet.get("vehicle_type", "UNKNOWN"),
                "confidence": tracklet["confidence"],
                "timestamp": timestamp
            }
            try:
                resp = session.post(API_INGEST_URL, json=payload, timeout=0.8)
                if resp.status_code == 200:
                    data = resp.json()
                    print(f"[TRACKLET #{tracklet['track_id']} OK] Plate: {plate} | "
                          f"Conf: {tracklet['confidence']:.2f} | Obs: {tracklet['observations']} | "
                          f"Hotlist: {data.get('hotlist_match', 'N/A')}")
                else:
                    print(f"[API ERROR] Backend returned {resp.status_code}")
            except Exception as e:
                print(f"[NETWORK ERROR] Backend Unreachable: {e}")

        # Step 4: Draw valid reads GREEN (with number), candidates ORANGE
        # (raw OCR number, below strict gate), bare vehicles YELLOW.
        # Numbers are now ALWAYS painted when OCR reads anything.
        for det in detections:
            x1, y1, x2, y2 = det["bbox"]
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            vb = det.get("vehicle_bbox")
            if vb:
                cv2.rectangle(frame, (vb[0], vb[1]), (vb[2], vb[3]), (255, 0, 0), 1)
            cv2.putText(frame, f"{det.get('vehicle_type','')} {det.get('plate_text','')} ({det.get('confidence',0):.2f})",
                        (x1, max(0, y1 - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        for _c in candidates:
            x1, y1, x2, y2 = _c["bbox"]
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 165, 255), 2)
            cv2.putText(frame, f"{_c.get('vehicle_type','')} {_c.get('plate_text','')} ({_c.get('confidence',0):.2f})?",
                        (x1, max(0, y1 - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2)
        for _v in ocr_vehicles:
            _vb = _v.get("vehicle_bbox") or _v.get("bbox")
            if _vb and not any(d.get("vehicle_bbox") == _vb for d in detections):
                cv2.rectangle(frame, (_vb[0], _vb[1]), (_vb[2], _vb[3]), (255, 255, 0), 1)
                cv2.putText(frame, "vehicle: no plate yet",
                            (_vb[0], max(0, _vb[1] - 8)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)

        # Step 5: Push annotated frame to backend (max ~5 FPS) for live browser video
        last_send = push_frame(API_BASE, CAMERA_ID, frame, session, last_send, min_interval=0.2)

        if not args.no_show:
            # Show active track count
            active_tracks = tracker.get_active_tracks()
            cv2.putText(frame, f"Active Tracks: {len(active_tracks)}",
                        (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
            cv2.imshow("ARGUS Edge Camera", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

    cap.release()
    if not args.no_show:
        cv2.destroyAllWindows()
    print("[INFO] ARGUS Edge Pipeline stopped.")


if __name__ == "__main__":
    main()