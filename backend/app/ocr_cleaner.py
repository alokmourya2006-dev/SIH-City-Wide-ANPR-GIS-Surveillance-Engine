import re

PLATE_REGEX = r'^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$'

# Old strict pattern kept for reference (full 10-char plates)
STRICT_PLATE_REGEX = r'^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$'

AMBIGUOUS_CHARS = {
    'O': '0',
    'I': '1',
    'Z': '2',
    'S': '5',
    'B': '8'
}

def fix_ocr_errors(raw_plate: str) -> str:
    """
    Cleans up common OCR misreadings for standard Indian Vehicle Number Plates.
    Example: 'MH01AB120S' -> 'MH01AB1205'
    """
    if not raw_plate:
        return ""
    
    clean = raw_plate.strip().upper()
    clean = re.sub(r'[^A-Z0-9]', '', clean)
    
    if len(clean) < 8 or len(clean) > 10:
        return clean

    state = clean[:2]
    rto = clean[2:4]
    
    rto_corrected = ""
    for char in rto:
        rto_corrected += AMBIGUOUS_CHARS.get(char, char)
        
    series_and_num = clean[4:]
    
    if len(series_and_num) >= 5:
        num_part = series_and_num[-4:]
        series_part = series_and_num[:-4]
        
        num_corrected = ""
        for char in num_part:
            num_corrected += AMBIGUOUS_CHARS.get(char, char)
            
        return f"{state}{rto_corrected}{series_part}{num_corrected}"
    
    return clean

def is_valid_plate(plate: str) -> bool:
    """Validates Indian plates, tolerating common partial reads.

    Full 10-char plates (UP32KT2112) always pass. Partial reads
    (>=6 chars, e.g. UP32KT21 when the last digits are occluded) pass
    too so near-miss OCR still produces a candidate instead of silence.
    """
    if not plate:
        return False
    p = plate.strip().upper()
    if bool(re.match(STRICT_PLATE_REGEX, p)):
        return True
    return len(p) >= 6 and bool(re.match(PLATE_REGEX, p))