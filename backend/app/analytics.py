"""
Analytics engine: OD matrix, congestion index, spatial aggregation.
"""
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional

# Lucknow camera node GIS mapping (shared with main.py)
CAMERA_LOCATIONS = {
    "CAM_LKO_HAZRATGANJ_01": {"name": "Hazratganj Crossing", "lat": 26.8467, "lon": 80.9462, "sector": "SECTOR_A"},
    "CAM_LKO_CHARBAGH_02": {"name": "Charbagh Station North", "lat": 26.8302, "lon": 80.9197, "sector": "SECTOR_B"},
    "CAM_LKO_ALAMBAGH_03": {"name": "Alambagh Bus Terminal", "lat": 26.8094, "lon": 80.8934, "sector": "SECTOR_C"},
    "CAM_LKO_GOMTINAGAR_04": {"name": "Gomti Nagar Cyber Heights", "lat": 26.8514, "lon": 80.9942, "sector": "SECTOR_D"}
}

def compute_od_matrix(db, start_time: str, end_time: str) -> dict:
    """
    Origin-Destination flow matrix between camera sectors.
    Tracks same plate appearing at different cameras in sequence.
    """
    from main import TelemetryDB

    # Query telemetry in time window
    records = db.query(TelemetryDB).filter(
        TelemetryDB.timestamp >= start_time,
        TelemetryDB.timestamp <= end_time
    ).order_by(TelemetryDB.timestamp).all()

    # Group by plate, ordered by timestamp
    plate_visits: Dict[str, List[dict]] = defaultdict(list)
    for r in records:
        plate_visits[r.plate_number].append({
            "camera_id": r.camera_id,
            "timestamp": r.timestamp,
            "sector": CAMERA_LOCATIONS.get(r.camera_id, {}).get("sector", "UNKNOWN")
        })

    # Build OD matrix
    od_matrix: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for plate, visits in plate_visits.items():
        visits.sort(key=lambda v: v["timestamp"])
        for i in range(len(visits) - 1):
            src = visits[i]["sector"]
            dst = visits[i + 1]["sector"]
            if src != dst:
                od_matrix[src][dst] += 1

    # Convert to serializable format
    result = {
        "sectors": list(CAMERA_LOCATIONS.values()),
        "matrix": {
            src: dict(dsts) for src, dsts in od_matrix.items()
        },
        "total_transitions": sum(
            count for dsts in od_matrix.values() for count in dsts.values()
        )
    }
    return result

def compute_congestion(db, camera_id: Optional[str], start_time: str, end_time: str) -> dict:
    """
    Congestion index per camera segment.
    CI = (observed_flow / capacity) * 100
    """
    from main import TelemetryDB

    # Query telemetry in time window
    query = db.query(TelemetryDB).filter(
        TelemetryDB.timestamp >= start_time,
        TelemetryDB.timestamp <= end_time
    )
    if camera_id:
        query = query.filter(TelemetryDB.camera_id == camera_id)
    records = query.all()

    # Group by camera
    camera_flow: Dict[str, int] = defaultdict(int)
    for r in records:
        camera_flow[r.camera_id] += 1

    # Capacity assumptions (vehicles per time window)
    CAPACITY = {
        "CAM_LKO_HAZRATGANJ_01": 100,
        "CAM_LKO_CHARBAGH_02": 80,
        "CAM_LKO_ALAMBAGH_03": 90,
        "CAM_LKO_GOMTINAGAR_04": 70
    }

    results = []
    for cam_id, flow in camera_flow.items():
        capacity = CAPACITY.get(cam_id, 50)
        ci = min((flow / capacity) * 100, 100.0)
        loc = CAMERA_LOCATIONS.get(cam_id, {"name": "Unknown", "lat": 0, "lon": 0})
        results.append({
            "camera_id": cam_id,
            "location_name": loc["name"],
            "observed_flow": flow,
            "capacity": capacity,
            "congestion_index": round(ci, 1),
            "status": "CRITICAL" if ci > 80 else "HIGH" if ci > 60 else "MODERATE" if ci > 40 else "LOW"
        })

    results.sort(key=lambda x: x["congestion_index"], reverse=True)
    return {
        "time_window": {"start": start_time, "end": end_time},
        "segments": results
    }

def spatial_aggregate(db, start_time: str, end_time: str) -> dict:
    """
    Simple spatial aggregation by sector (H3-style simplified).
    """
    from main import TelemetryDB

    records = db.query(TelemetryDB).filter(
        TelemetryDB.timestamp >= start_time,
        TelemetryDB.timestamp <= end_time
    ).all()

    sector_counts: Dict[str, int] = defaultdict(int)
    for r in records:
        sector = CAMERA_LOCATIONS.get(r.camera_id, {}).get("sector", "UNKNOWN")
        sector_counts[sector] += 1

    return {
        "sector_counts": dict(sector_counts),
        "total_observations": len(records)
    }