from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta, timezone
import jwt
import json
import re

from security import hash_plate, log_audit, AuditLogDB, AuditBase
from hotlist import check_hotlist, add_to_hotlist, remove_from_hotlist, HotlistDB, HotlistBase
from analytics import compute_od_matrix, compute_congestion, spatial_aggregate, CAMERA_LOCATIONS
from stream_manager import update_frame, latest_frame, has_frame, mjpeg_generator
from models import CameraRegisterRequest, CameraHeartbeat
from debouncer import DetectionDebouncer
from ocr_cleaner import fix_ocr_errors, is_valid_plate
import base64
from collections import deque

# Global edge-detection debouncer: suppresses duplicate (camera, plate) posts
# from the edge pipeline while a vehicle is in a camera's field of view.
edge_debouncer = DetectionDebouncer(interval_seconds=45.0, max_keys=4096)

# --- LIVE WEBCAM DETECTION BUS (in-memory ring buffer, newest first) ---
LIVE_EVENT_BUS = deque(maxlen=200)

# Optional OCR backend: pytesseract (Tesseract) if installed, graceful fallback otherwise
try:
    import pytesseract  # noqa: F401
    from PIL import Image
    OCR_AVAILABLE = True
except Exception:
    OCR_AVAILABLE = False

# --- Lazy YOLO + EasyOCR plate detector (same stack as the edge pipeline) ---
_PLATE_DETECTOR = None
_PLATE_DETECTOR_FAILED = False


def _get_plate_detector():
    """Lazily build the PlateDetector (YOLO weights + EasyOCR).

    Returns None when ultralytics/cv2/easyocr or the plate weights are
    unavailable so the live-frame endpoint can degrade to pytesseract
    (and finally to the frontend's simulation mode) without crashing.
    """
    global _PLATE_DETECTOR, _PLATE_DETECTOR_FAILED
    if _PLATE_DETECTOR is not None or _PLATE_DETECTOR_FAILED:
        return _PLATE_DETECTOR
    try:
        from plate_detector import PlateDetector
        _PLATE_DETECTOR = PlateDetector()
        print(f"[LIVE-ANPR] PlateDetector ready (mode={_PLATE_DETECTOR.mode})")
    except Exception as exc:
        print(f"[LIVE-ANPR] PlateDetector unavailable, pytesseract fallback only: {exc}")
        _PLATE_DETECTOR_FAILED = True
        _PLATE_DETECTOR = None
    return _PLATE_DETECTOR


class LiveFrameRequest(BaseModel):
    image_base64: str          # raw base64 (no data: prefix) JPEG/PNG frame
    camera_id: str = "WEB_CAM_LIVE"
    vehicle_type: str = "CAR"


def _extract_plate_objects(image_base64: str):
    """Decode a webcam frame and run the full OCR chain.

    Engine 1: YOLO plate/vehicle detection + EasyOCR crop reading
              (the edge-pipeline stack, returns real bboxes + confidence).
    Engine 2: pytesseract whole-frame + ROI character-whitelist scan.

    Every raw read is pushed through ocr_cleaner.fix_ocr_errors() and
    validated with ocr_cleaner.is_valid_plate() before surfacing.

    Returns (objects, frame_w, frame_h); each object is
    {plate, conf, bbox [x1,y1,x2,y2] | None, vehicle_type, valid, engine, raw}.
    """
    raw = base64.b64decode(image_base64)
    frame = None
    fw = fh = 0
    try:
        import cv2
        import numpy as np
        arr = np.frombuffer(raw, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is not None:
            fh, fw = frame.shape[:2]
    except Exception:
        frame = None

    objects = []
    debug_texts = []

    # --- Engine 1: YOLO + EasyOCR (primary; real bounding boxes) ---
    detector = _get_plate_detector()
    if detector is not None and frame is not None:
        try:
            # Upscale small webcam frames so tiny plates become detectable
            # (YOLO needs plate width >= ~20px; a plate at 640x480 may be < 10px)
            scale = 1.0
            if fw > 0 and fw < 1280:
                scale = max(1.5, min(2.5, 1280 / fw))
                import cv2 as _cv2
                frame_yolo = _cv2.resize(frame, (int(fw * scale), int(fh * scale)), interpolation=_cv2.INTER_CUBIC)
            else:
                frame_yolo = frame

            for det in detector.detect_plates(frame_yolo):
                # Scale bbox back to original frame coordinates
                if scale > 1.0:
                    det = {**det, "bbox": [int(v / scale) for v in det["bbox"]], "plate_bbox": [int(v / scale) for v in det["plate_bbox"]] if det.get("plate_bbox") else det.get("bbox")}
                crop = detector.crop_plate(frame, det["bbox"])
                text, conf, valid, _raw = detector.ocr_plate(crop)
                if not text:
                    continue
                plate = fix_ocr_errors(text)
                debug_texts.append(f"YOLO raw='{text}' -> cleaned='{plate}' valid={valid}")
                objects.append({
                    "plate": plate,
                    "conf": round(float(conf or 0.0), 3),
                    "bbox": det.get("plate_bbox") or det.get("bbox"),
                    "vehicle_type": det.get("vehicle_type") or "UNKNOWN",
                    "valid": bool(valid and is_valid_plate(plate)),
                    "engine": f"YOLO+EasyOCR ({detector.mode})",
                    "raw": text,
                })
        except Exception as exc:
            print(f"[LIVE-ANPR] YOLO/EasyOCR pass failed, falling back: {exc}")

    # --- Engine 2: pytesseract with preprocessing (fallback) ---
    if not objects and OCR_AVAILABLE:
        try:
            from io import BytesIO
            img_color = Image.open(BytesIO(raw))
            img_gray = img_color.convert("L")
            w, h = img_gray.size

            # Upscale small webcam frames for better OCR accuracy
            if max(w, h) < 1000:
                img_gray = img_gray.resize((w * 2, h * 2))

            # Preprocess: increase contrast + sharpen
            from PIL import ImageFilter, ImageEnhance
            img_gray = ImageEnhance.Contrast(img_gray).enhance(2.0)
            img_gray = ImageEnhance.Sharpness(img_gray).enhance(2.0)
            img_gray = img_gray.filter(ImageFilter.MedianFilter(3))

            # Try multiple PSM modes for best results
            for psm in [6, 7, 11, 13]:
                config = f"--psm {psm} -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                text = pytesseract.image_to_string(img_gray, config=config)
                found = re.findall(r"[A-Z0-9]{5,10}", text.upper())
                debug_texts.append(f"pytesseract psm={psm}: {found}")
                for token in found:
                    fixed = fix_ocr_errors(token)
                    if len(fixed) >= 6:
                        objects.append({
                            "plate": fixed,
                            "conf": 0.85,
                            "bbox": None,
                            "vehicle_type": "CAR",
                            "valid": bool(is_valid_plate(fixed)),
                            "engine": f"pytesseract (psm={psm})",
                            "raw": token,
                        })
                if objects:
                    break
        except Exception as exc:
            debug_texts.append(f"pytesseract error: {exc}")

    # Strict-valid reads first; near-miss reads still surface for the operator
    objects.sort(key=lambda o: 0 if o["valid"] else 1)
    # Store debug info for the endpoint to return
    _extract_plate_objects._last_debug = debug_texts
    return objects, fw, fh

_extract_plate_objects._last_debug = []


def _extract_plates_from_frame(image_base64: str) -> List[str]:
    """Back-compat helper: plate strings only."""
    objects, _fw, _fh = _extract_plate_objects(image_base64)
    return [o["plate"] for o in objects if o["plate"]]

# --- 1. SQLALCHEMY & SQLITE DATABASE SETUP ---
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

SQLALCHEMY_DATABASE_URL = "sqlite:///./surveillance.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database Model (Table Structure)
class TelemetryDB(Base):
    __tablename__ = "telemetry_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(String, index=True)
    plate_number = Column(String, index=True)
    plate_hash = Column(String, index=True, nullable=True)
    vehicle_type = Column(String, default="SEDAN_CAR")
    confidence = Column(Float)
    timestamp = Column(String)
    location_name = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)

class TrackletDB(Base):
    __tablename__ = "tracklets"
    id = Column(Integer, primary_key=True)
    track_id = Column(Integer, index=True)
    camera_id = Column(String, index=True)
    plate_number = Column(String, index=True)
    vehicle_type = Column(String)
    start_time = Column(String)
    end_time = Column(String)
    confidence = Column(Float)
    observations = Column(Integer)

class AlertDB(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True)
    camera_id = Column(String, index=True)
    alert_type = Column(String)
    severity = Column(String)
    plate_number = Column(String, nullable=True)
    message = Column(String)
    timestamp = Column(String, index=True)

class CameraDB(Base):
    __tablename__ = "cameras"
    id = Column(Integer, primary_key=True)
    camera_id = Column(String, unique=True, index=True)
    name = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    sector = Column(String, default="SECTOR_A")
    source_type = Column(String, default="WEBCAM")
    rtsp_url = Column(String, nullable=True)
    last_heartbeat = Column(String, nullable=True)
    registered_at = Column(String)

# Create tables in surveillance.db
Base.metadata.create_all(bind=engine)
HotlistBase.metadata.create_all(bind=engine)
AuditBase.metadata.create_all(bind=engine)

# Seed the default Lucknow camera registry (idempotent)
def seed_cameras():
    db = SessionLocal()
    try:
        if db.query(CameraDB).count() > 0:
            return
        from analytics import CAMERA_LOCATIONS
        for cam_id, info in CAMERA_LOCATIONS.items():
            db.add(CameraDB(
                camera_id=cam_id,
                name=info["name"],
                latitude=info["lat"],
                longitude=info["lon"],
                sector=info["sector"],
                source_type="STANDBY",
                registered_at=datetime.utcnow().isoformat()
            ))
        db.commit()
    except Exception as e:
        print(f"[SEED] Camera seed warning: {e}")
        db.rollback()
    finally:
        db.close()

seed_cameras()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- 2. FASTAPI APP INITIALIZATION ---
app = FastAPI(
    title="Law Enforcement Surveillance Engine",
    version="2.0.0"
)

# GLOBAL ERROR HANDLING: any unhandled exception returns a clean JSON 500
# instead of a raw traceback, so the dashboard never breaks on API hiccups.
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"[ERROR] Unhandled exception at {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"status": "error", "detail": "Internal server error — operation aborted safely."},
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"status": "error", "detail": exc.detail},
        headers=getattr(exc, "headers", None),
    )

# Debouncer health/stats for monitoring (no auth — read-only counters)
@app.get("/api/v1/telemetry/debounce-stats")
def debounce_stats():
    return {"status": "success", "debouncer": edge_debouncer.stats()}

# CORS enabled so the Vite dashboard (5173) can call the API (8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# CORS Middleware (React frontend connection ke liye)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 3. AUTHENTICATION CONFIGURATION ---
SECRET_KEY = "sih_2026_secure_police_key_lucknow"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8h — presentation/testing-friendly window

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

class PoliceUser(BaseModel):
    badge_id: str
    password: str

class VehicleTelemetry(BaseModel):
    camera_id: str
    plate_number: str
    vehicle_type: Optional[str] = "SEDAN_CAR"
    confidence: float
    timestamp: str

class TrajectorySearchQuery(BaseModel):
    plate_number: str
    case_file_id: str

class ODMatrixQuery(BaseModel):
    start_time: str
    end_time: str

class CongestionQuery(BaseModel):
    camera_id: Optional[str] = None
    start_time: str
    end_time: str

class HotlistAddRequest(BaseModel):
    plate_number: str
    reason: str
    severity: str = "HIGH"

def verify_police_token(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        badge_id: str = payload.get("sub")
        if badge_id is None:
            raise HTTPException(status_code=401, detail="Invalid Authentication Credentials")
        return badge_id
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token Expired or Invalid")

# --- 4. API ENDPOINTS ---

@app.post("/api/v1/auth/login")
def police_login(form_data: OAuth2PasswordRequestForm = Depends(), request: Request = None):
    # Hardcoded secure police badge credential for SIH demo
    if form_data.username == "POLICE_7082" and form_data.password == "admin123":
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode = {"sub": form_data.username, "exp": datetime.utcnow() + access_token_expires}
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        
        # Audit log for successful login
        db = SessionLocal()
        try:
            log_audit(
                db,
                actor_id=form_data.username,
                actor_role="POLICE_OFFICER",
                action="AUTH_LOGIN",
                resource_type="SESSION",
                outcome="SUCCESS",
                source_ip=request.client.host if request else None
            )
        finally:
            db.close()
        
        return {"access_token": encoded_jwt, "token_type": "bearer"}
    
    # Audit log for failed login
    db = SessionLocal()
    try:
        log_audit(
            db,
            actor_id=form_data.username,
            actor_role="UNKNOWN",
            action="AUTH_LOGIN",
            resource_type="SESSION",
            outcome="FAILED",
            source_ip=request.client.host if request else None
        )
    finally:
        db.close()
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect Badge ID or Passcode",
        headers={"WWW-Authenticate": "Bearer"},
    )

# LIVE WEBCAM ANPR: process a captured frame through the OCR chain
# (YOLO+EasyOCR -> pytesseract), clean/validate via ocr_cleaner, check the
# watchlist and push the event to the live detection bus.
@app.post("/api/v1/detect-live-frame")
def detect_live_frame(data: LiveFrameRequest, db: Session = Depends(get_db)):
    try:
        objects, fw, fh = _extract_plate_objects(data.image_base64)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Frame decode failed: {exc}")

    if not objects and not OCR_AVAILABLE and _get_plate_detector() is None:
        return {
            "status": "unavailable",
            "ocr_available": False,
            "detail": "No OCR engine available on the server - install 'pytesseract pillow' plus the Tesseract binary, or 'ultralytics easyocr' with the plate weights, to enable webcam ANPR.",
            "detections": [],
        }

    now_iso = datetime.utcnow().isoformat()
    detections = []       # new (non-debounced) events -> bus + sidebar
    frame_plates = []     # every plate seen this frame -> overlay even if debounced
    seen_plates = set()

    for obj in objects:
        plate = (obj.get("plate") or "").strip().upper()
        if not plate or plate in seen_plates:
            continue
        seen_plates.add(plate)

        # Debounce: same (webcam, plate) within 45s is the same vehicle pass.
        # The plate still appears on the video overlay (frame_plates), it just
        # isn't re-pushed to the bus/database while the vehicle stays in view.
        fresh = edge_debouncer.should_process(data.camera_id, plate)
        match = check_hotlist(db, plate) if fresh else None
        vehicle_type = obj.get("vehicle_type") or data.vehicle_type
        if vehicle_type == "UNKNOWN":
            vehicle_type = data.vehicle_type

        event = {
            "id": f"webcam-{now_iso}-{plate}",
            "plate": plate,
            "vehicle": vehicle_type,
            "cameraId": data.camera_id,
            "timestamp": now_iso,
            "conf": float(obj.get("conf") or 0.88),
            "bbox": obj.get("bbox"),
            "engine": obj.get("engine"),
            "blacklisted": bool(match),
            "severity": match["severity"] if match else None,
            "reason": match["reason"] if match else None,
            "source": "WEBCAM",
        }
        frame_plates.append(event)
        if not fresh:
            continue

        LIVE_EVENT_BUS.appendleft(event)
        detections.append(event)

        # Save to telemetry database (same table as the edge ingest pipeline)
        try:
            db_item = TelemetryDB(
                camera_id=data.camera_id,
                plate_number=plate,
                plate_hash=hash_plate(plate),
                vehicle_type=vehicle_type,
                confidence=float(obj.get("conf") or 0.88),
                timestamp=now_iso,
                location_name="WEB_CAM_LIVE",
                latitude=0.0,
                longitude=0.0,
            )
            db.add(db_item)
        except Exception:
            pass  # never let a DB write failure break the live response

        db.commit()

        if match:
            log_audit(
                db,
                actor_id="WEB_CAM_LIVE",
                actor_role="SYSTEM",
                action="WEBCAM_HOTLIST_MATCH",
                resource_type=f"PLATE:{plate}",
                outcome="ALERT",
            )

    detector = _get_plate_detector()
    return {
        "status": "success",
        "ocr_available": True,
        "engine": (detections[0]["engine"] if detections
                   else (f"YOLO+EasyOCR ({detector.mode})" if detector
                         else ("pytesseract" if OCR_AVAILABLE else "none"))),
        "candidates": list(seen_plates),
        "frame_size": {"width": fw, "height": fh},
        "frame_plates": frame_plates,
        "detections": detections,
        "debug": getattr(_extract_plate_objects, "_last_debug", []),
    }


# Live bus snapshot for polling clients (newest first)
@app.get("/api/v1/live-events")
def get_live_events(limit: int = 25):
    return {"status": "success", "events": list(LIVE_EVENT_BUS)[: max(1, min(limit, 100))]}


# INGEST ENDPOINT: Data save hoga SQLite Database me (`surveillance.db`)
@app.post("/api/v1/telemetry/ingest")
def ingest_telemetry(data: VehicleTelemetry, db: Session = Depends(get_db)):
    # DEBOUNCE: skip duplicate edge posts for the same (camera, plate) while the
    # vehicle is still in view — prevents DB bloat from per-frame re-reads.
    plate_clean = data.plate_number.strip().upper()
    if not edge_debouncer.should_process(data.camera_id, plate_clean):
        return {
            "status": "success",
            "recorded_id": None,
            "duplicate": True,
            "location": None,
            "vehicle_type": data.vehicle_type,
            "hotlist_match": None,
            "alert_created": False,
            "alert_suppressed": True,
        }

    # Lucknow nodes GIS mapping dictionary
    locations = {
        "CAM_LKO_HAZRATGANJ_01": {"name": "Hazratganj Crossing", "lat": 26.8467, "lon": 80.9462},
        "CAM_LKO_CHARBAGH_02": {"name": "Charbagh Station North", "lat": 26.8302, "lon": 80.9197},
        "CAM_LKO_ALAMBAGH_03": {"name": "Alambagh Bus Terminal", "lat": 26.8094, "lon": 80.8934},
        "CAM_LKO_GOMTINAGAR_04": {"name": "Gomti Nagar Cyber Heights", "lat": 26.8514, "lon": 80.9942}
    }
    
    loc_info = locations.get(data.camera_id, {"name": "Unknown Sector", "lat": 26.8467, "lon": 80.9462})
    
    # Save record to Database using SQLAlchemy
    db_item = TelemetryDB(
        camera_id=data.camera_id,
        plate_number=data.plate_number.upper(),
        plate_hash=hash_plate(data.plate_number),
        vehicle_type=data.vehicle_type,
        confidence=data.confidence,
        timestamp=data.timestamp,
        location_name=loc_info["name"],
        latitude=loc_info["lat"],
        longitude=loc_info["lon"]
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    # Check hotlist for alert generation
    hotlist_match = check_hotlist(db, data.plate_number)
    alert_created = False
    alert_suppressed = False
    plate_clean = data.plate_number.strip().upper()
    if hotlist_match and len(plate_clean) >= 4:
        # DEDUPE: suppress repeat alerts for the same plate within a 10-minute window
        recent = db.query(AlertDB).filter(
            AlertDB.plate_number == plate_clean
        ).order_by(AlertDB.id.desc()).first()
        suppressed = False
        if recent:
            try:
                last_ts = datetime.fromisoformat(recent.timestamp.replace("Z", "+00:00"))
                if last_ts.tzinfo is not None:
                    last_ts = last_ts.astimezone(timezone.utc).replace(tzinfo=None)
                if abs((datetime.utcnow() - last_ts).total_seconds()) < 600:
                    suppressed = True
            except ValueError:
                suppressed = False
        alert_suppressed = suppressed
        if not suppressed:
            alert = AlertDB(
                camera_id=data.camera_id,
                alert_type="HOTLIST_MATCH",
                severity=hotlist_match["severity"],
                plate_number=plate_clean,
                message=f"{hotlist_match['reason']} — sighted at {loc_info['name']}",
                timestamp=datetime.utcnow().isoformat()
            )
            db.add(alert)
            db.commit()
            alert_created = True
    
    return {
        "status": "success", 
        "recorded_id": db_item.id, 
        "location": loc_info["name"],
        "vehicle_type": db_item.vehicle_type,
        "hotlist_match": hotlist_match,
        "alert_created": alert_created,
        "alert_suppressed": alert_suppressed
    }

# SEARCH TRAJECTORY ENDPOINT: Fetching data from SQLite Database
@app.post("/api/v1/trajectory/search")
def search_trajectory(query: TrajectorySearchQuery, db: Session = Depends(get_db), current_user: str = Depends(verify_police_token)):
    target_plate = query.plate_number.upper()
    
    # Audit log for trajectory search
    log_audit(
        db,
        actor_id=current_user,
        actor_role="POLICE_OFFICER",
        action="TRAJECTORY_SEARCH",
        resource_type="TELEMETRY",
        resource_id=target_plate,
        outcome="SUCCESS"
    )
    
    # Query SQLite database for matching license plates (chronological order)
    records = db.query(TelemetryDB).filter(TelemetryDB.plate_number == target_plate).order_by(TelemetryDB.timestamp.asc()).all()
    
    trajectory_data = [
        {
            "camera_id": r.camera_id,
            "location_name": r.location_name,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "vehicle_type": r.vehicle_type,
            "timestamp": r.timestamp,
            "confidence": r.confidence
        } for r in records
    ]
    
    return {
        "status": "success",
        "search_metadata": {
            "case_file_id": query.case_file_id,
            "queried_badge": current_user,
            "query_timestamp": datetime.utcnow().isoformat()
        },
        "total_hits": len(trajectory_data),
        "trajectory": trajectory_data
    }

# TRACKLETS ENDPOINT: Fetch tracklet history
@app.get("/api/v1/tracklets")
def get_tracklets(db: Session = Depends(get_db), current_user: str = Depends(verify_police_token)):
    tracklets = db.query(TrackletDB).order_by(TrackletDB.start_time.desc()).limit(100).all()
    return {
        "status": "success",
        "total": len(tracklets),
        "tracklets": [
            {
                "track_id": t.track_id,
                "camera_id": t.camera_id,
                "plate_number": t.plate_number,
                "vehicle_type": t.vehicle_type,
                "start_time": t.start_time,
                "end_time": t.end_time,
                "confidence": t.confidence,
                "observations": t.observations
            } for t in tracklets
        ]
    }

# ALERTS ENDPOINT: Fetch active alerts (newest first by insertion id)
@app.get("/api/v1/alerts")
def get_alerts(since_minutes: int = 0, db: Session = Depends(get_db), current_user: str = Depends(verify_police_token)):
    q = db.query(AlertDB)
    if since_minutes and since_minutes > 0:
        cutoff = (datetime.utcnow() - timedelta(minutes=since_minutes)).isoformat()
        q = q.filter(AlertDB.timestamp >= cutoff)
    alerts = q.order_by(AlertDB.id.desc()).limit(50).all()
    return {
        "status": "success",
        "total": len(alerts),
        "alerts": [
            {
                "id": a.id,
                "camera_id": a.camera_id,
                "alert_type": a.alert_type,
                "severity": a.severity,
                "plate_number": a.plate_number,
                "message": a.message,
                "timestamp": a.timestamp
            } for a in alerts
        ]
    }

# OD MATRIX ENDPOINT
@app.post("/api/v1/analytics/od-matrix")
def od_matrix_endpoint(query: ODMatrixQuery, db: Session = Depends(get_db), current_user: str = Depends(verify_police_token)):
    result = compute_od_matrix(db, query.start_time, query.end_time)
    return {"status": "success", **result}

# CONGESTION ENDPOINT
@app.post("/api/v1/analytics/congestion")
def congestion_endpoint(query: CongestionQuery, db: Session = Depends(get_db), current_user: str = Depends(verify_police_token)):
    result = compute_congestion(db, query.camera_id, query.start_time, query.end_time)
    return {"status": "success", **result}

def verify_police_token_optional(request: Request):
    """JWT when dashboard calls; None when edge node calls (no header)."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        return verify_police_token(request)
    except HTTPException:
        return None

# CAMERA REGISTRATION ENDPOINT (open to edge nodes; dashboard passes JWT too)
@app.post("/api/v1/cameras/register")
def register_camera_endpoint(data: CameraRegisterRequest, request: Request, db: Session = Depends(get_db), current_user: str = Depends(verify_police_token_optional)):
    now = datetime.utcnow().isoformat()
    cam = db.query(CameraDB).filter(CameraDB.camera_id == data.camera_id).first()
    if cam:
        # Update existing registration
        cam.name = data.name
        cam.latitude = data.latitude
        cam.longitude = data.longitude
        cam.sector = data.sector
        cam.source_type = data.source_type
        cam.rtsp_url = data.rtsp_url
        updated = False
    else:
        cam = CameraDB(
            camera_id=data.camera_id,
            name=data.name,
            latitude=data.latitude,
            longitude=data.longitude,
            sector=data.sector,
            source_type=data.source_type,
            rtsp_url=data.rtsp_url,
            registered_at=now
        )
        db.add(cam)
        updated = True
    db.commit()
    actor = current_user or "EDGE_NODE"
    role = "POLICE_OFFICER" if current_user else "EDGE_NODE"
    log_audit(
        db,
        actor_id=actor,
        actor_role=role,
        action="CAMERA_REGISTER",
        resource_type="CAMERA",
        resource_id=data.camera_id,
        outcome="SUCCESS"
    )
    return {"status": "success", "camera_id": data.camera_id, "registered": updated}

# CAMERA HEARTBEAT ENDPOINT (edge node pings every ~5s)
@app.post("/api/v1/cameras/heartbeat")
def camera_heartbeat_endpoint(heartbeat: CameraHeartbeat, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc).isoformat()
    cam = db.query(CameraDB).filter(CameraDB.camera_id == heartbeat.camera_id).first()
    if not cam:
        # Auto-register unknown cameras with default position
        from analytics import CAMERA_LOCATIONS
        info = CAMERA_LOCATIONS.get(heartbeat.camera_id, {"name": heartbeat.camera_id, "lat": 26.8467, "lon": 80.9462, "sector": "SECTOR_A"})
        cam = CameraDB(
            camera_id=heartbeat.camera_id,
            name=info["name"],
            latitude=info["lat"],
            longitude=info["lon"],
            sector=info["sector"],
            source_type="UNKNOWN",
            registered_at=now
        )
        db.add(cam)
    cam.last_heartbeat = now
    db.commit()
    return {"status": "success", "camera_id": heartbeat.camera_id, "last_heartbeat": now}

# CAMERA FRAME PUSH ENDPOINT (edge node uploads annotated JPEG)
@app.post("/api/v1/cameras/{camera_id}/frame")
async def camera_frame_endpoint(camera_id: str, request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="Empty frame body")
    update_frame(camera_id, body)
    # Frame arrival implies liveness
    cam = db.query(CameraDB).filter(CameraDB.camera_id == camera_id).first()
    if cam:
        cam.last_heartbeat = datetime.now(timezone.utc).isoformat()
        db.commit()
    return {"status": "success", "camera_id": camera_id, "bytes": len(body)}

# CAMERA STREAM ENDPOINT (MJPEG for browser <img>)
@app.get("/api/v1/cameras/{camera_id}/stream")
def camera_stream_endpoint(camera_id: str, token: str = ""):
    # Validate token (query param because <img> can't send Authorization header)
    if token:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            if not payload.get("sub"):
                raise HTTPException(status_code=401, detail="Invalid Token")
        except jwt.PyJWTError:
            raise HTTPException(status_code=401, detail="Token Expired or Invalid")
    else:
        raise HTTPException(status_code=401, detail="Missing Token")
    
    return StreamingResponse(
        mjpeg_generator(camera_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        }
    )

# CAMERA STATUS ENDPOINT (heartbeat-based ONLINE/OFFLINE/STANDBY)
@app.get("/api/v1/cameras/status")
def camera_status(db: Session = Depends(get_db), current_user: str = Depends(verify_police_token)):
    cameras = []
    cam_rows = db.query(CameraDB).all()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    HEARTBEAT_TIMEOUT_SECONDS = 15

    for cam in cam_rows:
        recent = db.query(TelemetryDB).filter(
            TelemetryDB.camera_id == cam.camera_id
        ).order_by(TelemetryDB.timestamp.desc()).first()

        status = "STANDBY"
        if cam.last_heartbeat:
            try:
                hb = datetime.fromisoformat(cam.last_heartbeat.replace("Z", "+00:00"))
                if hb.tzinfo is not None:
                    hb = hb.astimezone(timezone.utc).replace(tzinfo=None)
                age_seconds = (now - hb).total_seconds()
                if age_seconds <= HEARTBEAT_TIMEOUT_SECONDS:
                    status = "ONLINE"
                else:
                    status = "OFFLINE"
            except ValueError:
                status = "STANDBY"

        cameras.append({
            "camera_id": cam.camera_id,
            "name": cam.name,
            "latitude": cam.latitude,
            "longitude": cam.longitude,
            "sector": cam.sector,
            "source_type": cam.source_type,
            "rtsp_url": cam.rtsp_url,
            "status": status,
            "last_heartbeat": cam.last_heartbeat,
            "stream_available": has_frame(cam.camera_id),
            "last_seen": recent.timestamp if recent else cam.last_heartbeat,
            "last_plate": recent.plate_number if recent else None
        })

    return {"status": "success", "cameras": cameras}

# AUDIT LOGS ENDPOINT (admin only)
@app.get("/api/v1/audit/logs")
def get_audit_logs(db: Session = Depends(get_db), current_user: str = Depends(verify_police_token)):
    logs = db.query(AuditLogDB).order_by(AuditLogDB.event_ts.desc()).limit(100).all()
    return {
        "status": "success",
        "total": len(logs),
        "logs": [
            {
                "id": l.id,
                "event_ts": l.event_ts,
                "actor_id": l.actor_id,
                "actor_role": l.actor_role,
                "action": l.action,
                "resource_type": l.resource_type,
                "resource_id": l.resource_id,
                "outcome": l.outcome,
                "source_ip": l.source_ip,
                "metadata": l.meta_json
            } for l in logs
        ]
    }

# HOTLIST MANAGEMENT ENDPOINTS
@app.get("/api/v1/hotlist")
def get_hotlist(db: Session = Depends(get_db), current_user: str = Depends(verify_police_token)):
    entries = db.query(HotlistDB).all()
    return {
        "status": "success",
        "total": len(entries),
        "hotlist": [
            {
                "id": h.id,
                "plate_number": h.plate_number,
                "reason": h.reason,
                "severity": h.severity,
                "added_at": h.added_at
            } for h in entries
        ]
    }

@app.post("/api/v1/hotlist/add")
def add_hotlist_entry(data: HotlistAddRequest, db: Session = Depends(get_db), current_user: str = Depends(verify_police_token)):
    entry_id = add_to_hotlist(db, data.plate_number, data.reason, data.severity)
    
    # Audit log
    log_audit(
        db,
        actor_id=current_user,
        actor_role="POLICE_OFFICER",
        action="HOTLIST_ADD",
        resource_type="HOTLIST",
        resource_id=data.plate_number,
        outcome="SUCCESS"
    )
    
    return {"status": "success", "hotlist_id": entry_id}

@app.delete("/api/v1/hotlist/{plate_number}")
def delete_hotlist_entry(plate_number: str, db: Session = Depends(get_db), current_user: str = Depends(verify_police_token)):
    removed = remove_from_hotlist(db, plate_number)

    # Audit log
    log_audit(
        db,
        actor_id=current_user,
        actor_role="POLICE_OFFICER",
        action="HOTLIST_DELETE",
        resource_type="HOTLIST",
        resource_id=plate_number.upper(),
        outcome="SUCCESS" if removed else "NOT_FOUND"
    )

    if not removed:
        raise HTTPException(status_code=404, detail="Plate not found on hotlist")
    return {"status": "success", "removed": plate_number.upper()}