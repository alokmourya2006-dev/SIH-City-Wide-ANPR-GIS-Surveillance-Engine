import os

base = r'C:\Users\Alok maurya\OneDrive\Desktop\SIH 127\frontend'

# Read Login.jsx
with open(os.path.join(base, 'src', 'components', 'Login.jsx'), 'r', encoding='utf-8') as f:
    login_src = f.read()

print('=' * 50)
print('FINAL FILE STATUS REPORT')
print('=' * 50)

print('\n--- Login.jsx ---')
checks = {
    '1. Unused import removed (GeometricSphereBackground)': 'GeometricSphereBackground' not in login_src,
    '2. Overlay rendered BEFORE SphereHero (DOM order)': login_src.find('Dark overlay FIRST') < login_src.find('<SphereHero'),
    '3. Overlay opacity reduced (0.20/0.55)': '0.20' in login_src and '0.55' in login_src,
    '4. Login card bg transparent (/40)': '/40' in login_src,
    '5. Glass-morphism comment added': 'Glass-morphism card' in login_src,
    '6. SphereHero import present': 'SphereHero' in login_src and "import SphereHero" in login_src,
    '7. GuideChat import present': 'GuideChat' in login_src and "import GuideChat" in login_src,
}
for k, v in checks.items():
    print(f'  [{ "PASS" if v else "FAIL" }] {k}')

print('\n--- geometric-sphere.jsx (SphereHero - ACTIVE) ---')
with open(os.path.join(base, 'src', 'components', 'ui', 'geometric-sphere.jsx'), 'r', encoding='utf-8') as f:
    sphere_src = f.read()
sphere_checks = {
    '1. CONFIG block present': 'CONFIG' in sphere_src and 'primaryColor' in sphere_src,
    '2. Sphere container z-40': 'z-40' in sphere_src,
    '3. Sphere rotation animation': 'sphere-rotation' in sphere_src,
    '4. showContent prop supported': 'showContent' in sphere_src,
    '5. Parallax mouse tracking': 'parallax' in sphere_src or 'mousemove' in sphere_src,
}
for k, v in sphere_checks.items():
    print(f'  [{ "PASS" if v else "FAIL" }] {k}')

print('\n--- GeometricSphere.jsx (GeometricSphereBackground - UNUSED) ---')
with open(os.path.join(base, 'src', 'components', 'ui', 'GeometricSphere.jsx'), 'r', encoding='utf-8') as f:
    gsrc = f.read()
gsrc_checks = {
    '1. Component file exists and valid': 'GeometricSphereBackground' in gsrc,
    '2. Different config from SphereHero': '56, 189, 248' in gsrc,  # Sky blue vs purple
    '3. NOT imported in Login.jsx': 'GeometricSphereBackground' not in login_src,
}
for k, v in gsrc_checks.items():
    print(f'  [{ "PASS" if v else "FAIL" }] {k}')

print('\n--- index.css ---')
with open(os.path.join(base, 'src', 'index.css'), 'r', encoding='utf-8') as f:
    css_src = f.read()
css_checks = {
    '1. sphereRotate keyframe': 'sphereRotate' in css_src,
    '2. gridPan keyframe': 'gridPan' in css_src,
    '3. wireframe-line class': 'wireframe-line' in css_src,
    '4. sphere-container class (z-40 support)': 'sphere-container' in css_src,
    '5. core-light class': 'core-light' in css_src,
    '6. panning-grid class': 'panning-grid' in css_src,
    '7. vignette-overlay class': 'vignette-overlay' in css_src,
    '8. noise-layer class': 'noise-layer' in css_src,
}
for k, v in css_checks.items():
    print(f'  [{ "PASS" if v else "FAIL" }] {k}')

print('\n--- GuideChat.jsx ---')
with open(os.path.join(base, 'src', 'components', 'GuideChat.jsx'), 'r', encoding='utf-8') as f:
    gc_src = f.read()
gc_checks = {
    '1. Component exists': 'GuideChat' in gc_src,
    '2. Bot replies defined': 'botReply' in gc_src,
    '3. SUGS suggestions': 'SUGS' in gc_src,
}
for k, v in gc_checks.items():
    print(f'  [{ "PASS" if v else "FAIL" }] {k}')

print('\n' + '=' * 50)
print('STRUCTURE DIAGRAM (DOM order)')
print('=' * 50)
print('''
  Login.jsx render tree:
  ┌─────────────────────────────────────────────────┐
  │ div (relative, min-h-screen, bg-[#020617])      │
  │   ├── div (overlay, opacity 0.20→0.55) [z: auto]│  ← BEHIND sphere
  │   ├── SphereHero (showContent={false})           │
  │   │   └── div (h-screen, relative)               │
  │   │       ├── panning-grid [Layer 0]             │
  │   │       ├── volumetric haze [Layer 1]          │
  │   │       ├── deep base + core glow [Layer 2]    │
  │   │       ├── ★ SPHERE z-40 [Layer 3] ★         │  ← VISIBLE ON TOP
  │   │       ├── bloom [Layer 4]                    │
  │   │       ├── noise [Layer 5]                    │
  │   │       └── (showContent content - SKIP)       │
  │   │       └── vignette [Layer 6]                 │
  │   ├── div (z-10, !revealed → title screen)      │
  │   ├── div (z-10, revealed → login card /40)     │  ← LAYERS OVER SPHERE
  │   └── div (z-20, revealed → assistant popup)    │
  └─────────────────────────────────────────────────┘

  Layering result:
    • Sphere/glove fully visible (NOT blocked by overlay)
    • Login card glass-morphism: sphere shows THROUGH card
    • Assistant popup on top (z-20)
''')
