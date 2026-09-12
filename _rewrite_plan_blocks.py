#!python314
import pathlib, re, sys

p = pathlib.Path(r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127\implementation_plan.md")

if not p.exists():
    sys.exit("plan file missing")

text = p.read_text(encoding="utf-8")

reg = re.compile(r"(?ms)^.*## \[Classes\].*?$")
replacement = (
    "## [Classes]\n\n"
    "All classes modified or introduced in this plan are described in the Functions and Files sections.\n\n"
    "- PlateDetector (backend/app/plate_detector.py) - the main ANPR pipeline; gains plate-model path plus a secondary COCO vehicle classifier on plate-mode boxes, and 7-variant OCR with voting/fragment-concat/Tesseract fallback, and the bike/car tagging coming from the vehicle model found on disk.\n"
    "- PlateLocalizer (backend/app/plate_localizer.py) - keeps classical CV plate-candidate finder for vehicle+localizer fallback; still used when plate model is unavailable.\n"
    "- Track (backend/app/tracker.py) - unchanged for this plan; it already carries best_plate/best_conf/vehicle_type and records last_seen_frame semantics.\n"
    "- TrackletTracker (backend/app/tracker.py) - unchanged; closed-tracklet upload is the ingest path in the edge loop; instant ingest path already bypasses tracklet waiting.\n\n\n"
    "## [Dependencies]\n\n"
    "- No new pip/npm packages for this task.\n"
    "- Plate model `license-plate-finetune-v1n.pt` already on disk in `backend/models/`.\n"
    "- COCO `yolov8n.pt` already on disk in project root for the vehicle classifier used to tag bike/car when in plate mode."
)

new_text, n = reg.subn(replacement, text, count=1)
if n == 0:
    sys.exit("Classes/Dependencies block not rewritten")

if new_text != text:
    p.write_text(new_text, encoding="utf-8")
    print("updated")
else:
    print("unchanged")
