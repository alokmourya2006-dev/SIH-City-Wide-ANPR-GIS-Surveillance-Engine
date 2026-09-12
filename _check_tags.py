#!/usr/bin/env python3
"""Check JSX tag balance in MacroAnalytics.jsx"""
import os

filepath = r'c:\Users\Alok maurya\OneDrive\Desktop\SIH 127\frontend\src\components\MacroAnalytics.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Count tags
opens = content.count('<div')
closes = content.count('</div>')
print(f'div opens: {opens}, div closes: {closes}')

tr_o = content.count('<tr')
tr_c = content.count('</tr>')
print(f'tr opens: {tr_o}, tr closes: {tr_c}')

td_o = content.count('<td')
td_c = content.count('</td>')
print(f'td opens: {td_o}, td closes: {td_c}')

table_o = content.count('<table')
table_c = content.count('</table>')
print(f'table opens: {table_o}, table closes: {table_c}')

tbody_o = content.count('<tbody')
tbody_c = content.count('</tbody>')
print(f'tbody opens: {tbody_o}, tbody closes: {tbody_c}')

braces_o = content.count('{')
braces_c = content.count('}')
print(f'braces: {braces_o} open, {braces_c} close')

parens_o = content.count('(')
parens_c = content.count(')')
print(f'parens: {parens_o} open, {parens_c} close')

print(f'total lines: {content.count(chr(10))+1}')
