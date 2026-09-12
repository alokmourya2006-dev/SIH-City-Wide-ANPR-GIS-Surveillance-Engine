"""Part 2: verify backend+frontend after manual restart. Writes _restart_part2.txt"""
import urllib.request, urllib.error, json, os, time
ROOT = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
out = []
def log(s):
    print(s, flush=True); out.append(s)
for name, url in [("BACKEND", "http://127.0.0.1:8000/docs"),
                  ("FRONTEND", "http://localhost:5173/")]:
    ok = False
    for i in range(12):
        try:
            with urllib.request.urlopen(url, timeout=5) as r:
                log(f"{name}: UP ({r.status}) -> {url}"); ok = True; break
        except Exception as e:
            if i in (0, 5, 11):
                log(f"{name} wait: {e}")
            time.sleep(5)
    if not ok:
        log(f"{name}: DOWN after 60s")
try:
    req = urllib.request.Request("http://127.0.0.1:8000/api/v1/auth/login",
        data=b"username=POLICE_7082&password=admin123",
        headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=5) as resp:
        tok = json.loads(resp.read())["access_token"]
    log("LOGIN OK (POLICE_7082)")
    reg = json.dumps({"camera_id": "CAM_LKO_HAZRATGANJ_01", "name": "Hazratganj Crossing",
        "latitude": 26.8467, "longitude": 80.9462,
        "sector": "SECTOR_A", "source_type": "WEBCAM"}).encode()
    req2 = urllib.request.Request("http://127.0.0.1:8000/api/v1/cameras/register",
        data=reg, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req2, timeout=5) as r2:
            log(f"REGISTER (no-auth edge path) -> {r2.status} {r2.read().decode()[:160]}")
    except urllib.error.HTTPError as he:
        log(f"REGISTER HTTP {he.code}: {he.read().decode()[:200]}")
    req3 = urllib.request.Request("http://127.0.0.1:8000/api/v1/cameras/status",
        headers={"Authorization": f"Bearer {tok}"})
    with urllib.request.urlopen(req3, timeout=5) as r3:
        cams = json.loads(r3.read())["cameras"]
    log(f"CAMERAS: {len(cams)}")
    for c in cams:
        log(f"  - {c['camera_id']} | {c['status']} | stream={c['stream_available']}")
except Exception as e:
    log(f"API CHECK: {e}")
with open(os.path.join(ROOT, "_restart_part2.txt"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(out))
