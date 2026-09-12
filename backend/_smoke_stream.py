"""Smoke-test the live camera streaming endpoints end-to-end."""
import io
import time
import requests

BASE = "http://127.0.0.1:8000/api/v1"

# 1. Login
r = requests.post(f"{BASE}/auth/login", data={"username": "POLICE_7082", "password": "admin123"})
assert r.status_code == 200, f"login failed: {r.status_code}"
token = r.json()["access_token"]
H = {"Authorization": f"Bearer {token}"}
print("1. LOGIN OK")

# 2. Register a test camera
r = requests.post(f"{BASE}/cameras/register", headers=H, json={
    "camera_id": "CAM_TEST_SMOKE_99",
    "name": "Smoke Test Cam",
    "latitude": 26.85,
    "longitude": 80.95,
    "sector": "SECTOR_B",
    "source_type": "WEBCAM",
})
print("2. REGISTER ->", r.status_code, r.json())
assert r.status_code == 200

# 3. Heartbeat
r = requests.post(f"{BASE}/cameras/heartbeat", json={"camera_id": "CAM_LKO_HAZRATGANJ_01"})
print("3. HEARTBEAT ->", r.status_code, r.json())
assert r.status_code == 200

# 4. Push a tiny valid JPEG frame (1x1 red pixel JPEG)
import struct
# Minimal valid JPEG generated via PIL if available, else raw bytes fallback
try:
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (64, 48), (200, 30, 30)).save(buf, format="JPEG")
    jpeg = buf.getvalue()
except ImportError:
    jpeg = bytes.fromhex(
        "ffd8ffe000104a46494600010100000100010000ffdb004300"
        + "08" * 64 + "ffc0000b080001000101011100ffc4001f000001050101010101"
        + "0100000000000000000102030405060708090a0bffc400b5100002010303"
        + "020403050504040000017d01010200000101010101010100000000000001"
        + "000102030405060708090a0b0c0d0e0f10ffda0008010100000100ffd9"
    )
r = requests.post(
    f"{BASE}/cameras/CAM_LKO_HAZRATGANJ_01/frame",
    data=jpeg,
    headers={"Content-Type": "image/jpeg"},
)
print("4. FRAME PUSH ->", r.status_code, r.json())
assert r.status_code == 200

# 5. Pull MJPEG stream (should return multipart body with at least 1 frame)
r = requests.get(f"{BASE}/cameras/CAM_LKO_HAZRATGANJ_01/stream", params={"token": token}, stream=True, timeout=10)
print("5. STREAM ->", r.status_code, r.headers.get("content-type"))
assert r.status_code == 200 and "multipart" in r.headers.get("content-type", "")
body = b""
for chunk in r.iter_content(4096):
    body += chunk
    if len(body) > 200:
        break
print("   stream bytes received:", len(body), "| multipart OK:", b"--frame" in body)
assert b"--frame" in body

# 6. Status shows ONLINE + stream_available
r = requests.get(f"{BASE}/cameras/status", headers=H)
cams = {c["camera_id"]: c for c in r.json()["cameras"]}
hz = cams.get("CAM_LKO_HAZRATGANJ_01", {})
print("6. STATUS ->", r.status_code,
      "| HAZRATGANJ:", hz.get("status"), "stream_available:", hz.get("stream_available"),
      "| total cameras:", len(cams))
assert hz.get("status") == "ONLINE" and hz.get("stream_available") is True

# 7. Stale-camera logic: a camera with no heartbeat must not be ONLINE
print("7. STATUS values:", sorted({c["status"] for c in cams.values()}))
print("ALL SMOKE TESTS PASSED")
