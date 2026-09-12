"""Overview status check - writes _overview_status.txt"""
import urllib.request, json, os
root = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
out = []
def check(name, url):
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            out.append(f"{name}: UP ({r.status}) -> {url}")
            return True
    except Exception as e:
        out.append(f"{name}: DOWN ({e}) -> {url}")
        return False
b = check("BACKEND 8000", "http://127.0.0.1:8000/docs")
f = check("FRONTEND 5173", "http://localhost:5173/")
# extra: login + status
if b:
    try:
        req = urllib.request.Request("http://127.0.0.1:8000/api/v1/auth/login",
            data=b"username=POLICE_7082&password=admin123",
            headers={"Content-Type": "application/x-www-form-urlencoded"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            tok = json.loads(resp.read())["access_token"]
        out.append("LOGIN: OK (POLICE_7082)")
        req2 = urllib.request.Request("http://127.0.0.1:8000/api/v1/cameras/status",
            headers={"Authorization": f"Bearer {tok}"})
        with urllib.request.urlopen(req2, timeout=5) as resp2:
            cams = json.loads(resp2.read())["cameras"]
        out.append(f"CAMERAS: {len(cams)} registered")
        for c in cams:
            out.append(f"  - {c['camera_id']} | {c['name']} | {c['status']} | stream={c['stream_available']}")
    except Exception as e:
        out.append(f"LOGIN/STATUS: FAIL ({e})")
with open(os.path.join(root, "_overview_status.txt"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(out))
print("\n".join(out))
