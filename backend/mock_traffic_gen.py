import requests
import time
from datetime import datetime, timezone

API_URL = "http://127.0.0.1:8000/api/v1/telemetry/ingest"

# Lucknow City Camera Nodes
CAMERAS = [
    "CAM_LKO_HAZRATGANJ_01",
    "CAM_LKO_CHARBAGH_02",
    "CAM_LKO_ALAMBAGH_03",
    "CAM_LKO_GOMTINAGAR_04"
]

TARGET_PLATE = "UP32KT2112"

print(f"[SIMULATOR] Starting trajectory simulation for target vehicle: {TARGET_PLATE}")

for idx, cam_id in enumerate(CAMERAS, 1):
    payload = {
        "camera_id": cam_id,
        "plate_number": TARGET_PLATE,
        "confidence": 0.95,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    payload = {
       "camera_id": cam_id,
       "plate_number": "UP32KT2112",
       "vehicle_type": "MOTORCYCLE", # ya "SUV", "SEDAN"
       "confidence": 0.96,
       "timestamp": datetime.utcnow().isoformat()
    }
    
    try:
        res = requests.post(API_URL, json=payload)
        print(f"[{idx}/{len(CAMERAS)}] Hit from {cam_id} -> Status: {res.json().get('status')}")
    except Exception as e:
        print(f"Error hitting server: {e}")
    
    time.sleep(2)  # Delay between camera node hits

print("[SIMULATOR] Simulation Complete! Vehicle trajectory created across Lucknow.")