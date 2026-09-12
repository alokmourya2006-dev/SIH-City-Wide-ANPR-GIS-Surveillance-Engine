import pathlib, re
p = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127\implementation_plan.md"
s = pathlib.Path(p).read_text(encoding="utf-8")
pat = re.compile(r"(?m)^## \[Implementation Order\][\r\n]+.*?(?=\r?\n## \[Testing\]|\Z)", re.S)
new = (
    "## [Implementation Order]\r\n\r\n"
    "1. Tighten real-plate policy in `backend/app/ocr_cleaner.py` (`is_valid_plate_strict` + safe `fix_ocr_errors`).\r\n"
    "2. Tighten the `ocr_plate` validity signal in `backend/app/plate_detector.py` so it uses strict Indian format for real-plate flag, keeping candidate path.\r\n"
    "3. Add one-shot check CLI `backend/driver_plate_check.py` (plate detection + best OCR + bike/car type + verdict).\r\n"
    "4. Add offline strictness test `backend/test_plate_strictness.py`.\r\n"
    "5. Align ingest paths in `backend/edge_pipeline.py` to strict-valid-real-plate only; candidates remain overlay-only.\r\n"
    "6. Verify compile + offline tests pass; then run live webcam flow + negative test.\r\n"
    "7. Update `implementation_plan.md` to match reality."
)
s2 = pat.sub(lambda m: new, s, count=1)
pathlib.Path(p).write_text(s2, encoding="utf-8")
print("patched impl order")
