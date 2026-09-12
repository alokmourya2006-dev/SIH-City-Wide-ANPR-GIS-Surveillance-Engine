import json
import urllib.request

BASE = 'http://127.0.0.1:8000/api/v1'

# login
data = b'username=POLICE_7082&password=admin123'
req = urllib.request.Request(BASE + '/auth/login', data=data,
                             headers={'Content-Type': 'application/x-www-form-urlencoded'})
tok = json.loads(urllib.request.urlopen(req, timeout=8).read())['access_token']
H = {'Authorization': 'Bearer ' + tok}

# fresh camera status
r = urllib.request.urlopen(urllib.request.Request(BASE + '/cameras/status', headers=H), timeout=8)
cams = json.loads(r.read())
print('FRESH CAMERA STATE:')
items = cams if isinstance(cams, list) else cams.get('cameras', cams.get('status', []))
for c in items:
    if isinstance(c, dict):
        cid = c.get('camera_id') or c.get('id')
        print(' ', cid, '|', (c.get('status') or c.get('state')), '| stream=', c.get('stream_available'))

# alerts count (plate reads visible in browser)
try:
    r = urllib.request.urlopen(urllib.request.Request(BASE + '/alerts?limit=5', headers=H), timeout=8)
    alerts = json.loads(r.read())
    items = alerts if isinstance(alerts, list) else alerts.get('alerts', alerts.get('items', []))
    print('ALERTS (browser Alert Feed):', len(items))
    for a in items[:5]:
        print('  ', a.get('plate_number'), '|', a.get('vehicle_type'), '|', a.get('camera_id'), '|', a.get('severity'))
except Exception as e:
    print('ALERTS: skip', e)
