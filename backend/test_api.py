"""Quick API test script"""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# Test login
print("=== Testing Login ===")
r = client.post('/api/v1/auth/login', data={'username': 'POLICE_7082', 'password': 'admin123'})
print(f"Login: {r.status_code}")
token = r.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

# Test telemetry ingest (hotlist match)
print("\n=== Testing Telemetry Ingest (Hotlist Match) ===")
r = client.post('/api/v1/telemetry/ingest', json={
    'camera_id': 'CAM_LKO_HAZRATGANJ_01',
    'plate_number': 'UP32KT2112',
    'confidence': 0.95,
    'timestamp': '2026-09-09T10:00:00Z'
}, headers=headers)
print(f"Ingest: {r.status_code} - {r.json()}")

# Test ingest non-hotlist plate
print("\n=== Testing Telemetry Ingest (Non-Hotlist) ===")
r = client.post('/api/v1/telemetry/ingest', json={
    'camera_id': 'CAM_LKO_CHARBAGH_02',
    'plate_number': 'DL8CAF1234',
    'confidence': 0.88,
    'timestamp': '2026-09-09T10:05:00Z'
}, headers=headers)
print(f"Ingest: {r.status_code} - {r.json()}")

# Test alerts
print("\n=== Testing Alerts ===")
r = client.get('/api/v1/alerts', headers=headers)
print(f"Alerts: {r.status_code} - {len(r.json().get('alerts', []))} alerts")

# Test camera status
print("\n=== Testing Camera Status ===")
r = client.get('/api/v1/cameras/status', headers=headers)
print(f"Cameras: {r.status_code} - {len(r.json().get('cameras', []))} cameras")

# Test trajectory search
print("\n=== Testing Trajectory Search ===")
r = client.post('/api/v1/trajectory/search', json={
    'plate_number': 'UP32KT2112',
    'case_file_id': 'INCIDENT_9021'
}, headers=headers)
print(f"Search: {r.status_code} - {r.json().get('total_hits', 0)} hits")

# Test OD matrix
print("\n=== Testing OD Matrix ===")
r = client.post('/api/v1/analytics/od-matrix', json={
    'start_time': '2026-09-09T00:00:00Z',
    'end_time': '2026-09-09T23:59:59Z'
}, headers=headers)
print(f"OD Matrix: {r.status_code} - {r.json().get('total_transitions', 0)} transitions")

# Test congestion
print("\n=== Testing Congestion ===")
r = client.post('/api/v1/analytics/congestion', json={
    'start_time': '2026-09-09T00:00:00Z',
    'end_time': '2026-09-09T23:59:59Z'
}, headers=headers)
print(f"Congestion: {r.status_code} - {len(r.json().get('segments', []))} segments")

# Test audit logs
print("\n=== Testing Audit Logs ===")
r = client.get('/api/v1/audit/logs', headers=headers)
print(f"Audit: {r.status_code} - {len(r.json().get('logs', []))} logs")

# Test hotlist
print("\n=== Testing Hotlist ===")
r = client.get('/api/v1/hotlist', headers=headers)
print(f"Hotlist: {r.status_code} - {len(r.json().get('hotlist', []))} entries")

print("\n=== All Tests Complete ===")
