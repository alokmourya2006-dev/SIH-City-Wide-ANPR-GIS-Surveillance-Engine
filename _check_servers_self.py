import urllib.request, time, os

def check(name, url):
    try:
        r = urllib.request.urlopen(url, timeout=4)
        return f'{name} UP ({r.status})'
    except Exception as e:
        return f'{name} DOWN'

time.sleep(8)
lines = []
lines.append(check('BACKEND 8000', 'http://127.0.0.1:8000/docs'))
lines.append(check('FRONTEND 5173', 'http://localhost:5173/'))
print('\n'.join(lines))
open(r'c:\Users\Alok maurya\OneDrive\Desktop\SIH 127\_check_servers3.txt', 'w', encoding='utf-8').write('\n'.join(lines))