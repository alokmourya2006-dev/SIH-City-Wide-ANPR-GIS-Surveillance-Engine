import urllib.request, sys

def check(name, url):
    try:
        r = urllib.request.urlopen(url, timeout=3)
        print(f'{name} UP ({r.status})')
        return True
    except Exception as e:
        print(f'{name} DOWN ({e})')
        return False

check('BACKEND 8000', 'http://127.0.0.1:8000/docs')
check('FRONTEND 5173', 'http://localhost:5173/')