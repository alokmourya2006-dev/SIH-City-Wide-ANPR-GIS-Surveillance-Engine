from pydantic import BaseModel
from typing import Optional, List

class TelemetryPayload(BaseModel):
    camera_id: str
    plate_number: str
    confidence: float
    timestamp: str

class TrajectorySearchRequest(BaseModel):
    plate_number: str
    badge_id: str
    case_file_id: str

class CameraRegisterRequest(BaseModel):
    camera_id: str
    name: str
    latitude: float
    longitude: float
    sector: str = "SECTOR_A"
    source_type: str = "WEBCAM"          # WEBCAM | RTSP | FILE
    rtsp_url: Optional[str] = None

class CameraHeartbeat(BaseModel):
    camera_id: str

class DetectionEvent(BaseModel):
    camera_id: str
    plate_number: str
    vehicle_type: str
    confidence: float
    timestamp: str
    bbox: Optional[List[float]] = None  # [x1, y1, x2, y2]
    track_id: Optional[int] = None

class TrackletEvent(BaseModel):
    track_id: int
    camera_id: str
    plate_number: str
    vehicle_type: str
    start_time: str
    end_time: str
    confidence: float
    observations: int

class AlertEvent(BaseModel):
    camera_id: str
    alert_type: str  # "HOTLIST_MATCH" | "ANOMALY" | "CONGESTION"
    severity: str    # "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    plate_number: Optional[str] = None
    message: str
    timestamp: str

class ODMatrixQuery(BaseModel):
    start_time: str
    end_time: str

class CongestionQuery(BaseModel):
    camera_id: Optional[str] = None
    start_time: str
    end_time: str