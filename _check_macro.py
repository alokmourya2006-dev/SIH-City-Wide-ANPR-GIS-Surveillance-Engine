#!/usr/bin/env python3
"""Find unclosed divs in MacroAnalytics.jsx"""
filepath = r'c:\Users\Alok maurya\OneDrive\Desktop\SIH 127\frontend\src\components\MacroAnalytics.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

depth = 0
for i, line in enumerate(lines, 1):
    # Count opening <div (not closing, not self-closing)
    opens = line.count('<div')
    # Closing </div>
    closes = line.count('</div>')
    # Self-closing <div ... /> — they still open+close, so skip by subtracting
    # A line like <div style=... /> is an open and a close on the same tag.
    before = depth
    depth += opens - closes
    if depth != before:
        print(f'L{i:>3} | {line.rstrip()[:100]}')
        print(f'     -> div depth {before} -> {depth}')
print('FINAL DEPTH:', depth)