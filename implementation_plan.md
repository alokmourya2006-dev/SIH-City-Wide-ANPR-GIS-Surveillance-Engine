## [Classes]

All classes modified or introduced in this plan are described in the Functions and Files sections.

- PlateDetector (backend/app/plate_detector.py) - the main ANPR pipeline; gains plate-model path plus a secondary COCO vehicle classifier on plate-mode boxes, and 7-variant OCR with voting/fragment-concat/Tesseract fallback, and the bike/car tagging coming from the vehicle model found on disk.
- PlateLocalizer (backend/app/plate_localizer.py) - keeps classical CV plate-candidate finder for vehicle+localizer fallback; still used when plate model is unavailable.
- Track (backend/app/tracker.py) - unchanged for this plan; it already carries best_plate/best_conf/vehicle_type and records last_seen_frame semantics.
- TrackletTracker (backend/app/tracker.py) - unchanged; closed-tracklet upload is the ingest path in the edge loop; instant ingest path already bypasses tracklet waiting.


## [Dependencies]

- No new pip/npm packages for this task.
- Plate model `license-plate-finetune-v1n.pt` already on disk in `backend/models/`.
- COCO `yolov8n.pt` already on disk in project root for the vehicle classifier used to tag bike/car when in plate mode.

All classes modified or introduced in this plan are described in the Functions and Files sections.

- PlateDetector (backend/app/plate_detector.py) - the main ANPR pipeline; gains plate-model path plus a secondary COCO vehicle classifier on plate-mode boxes, and 7-variant OCR with voting/fragment-concat/Tesseract fallback, and the bike/car tagging coming from the vehicle model found on disk.
- PlateLocalizer (backend/app/plate_localizer.py) - keeps classical CV plate-candidate finder for vehicle+localizer fallback; still used when plate model is unavailable.
- Track (backend/app/tracker.py) - unchanged for this plan; it already carries best_plate/best_conf/vehicle_type and records last_seen_frame semantics.
- TrackletTracker (backend/app/tracker.py) - unchanged; closed-tracklet upload is the ingest path in the edge loop; instant ingest path already bypasses tracklet waiting.


## [Dependencies]

- No new pip/npm packages for this task.
- Plate model `license-plate-finetune-v1n.pt` already on disk in `backend/models/`.
- COCO `yolov8n.pt` already on disk in project root for the vehicle classifier used to tag bike/car when in plate mode.

All classes modified or introduced in this plan are described in the Functions and Files sections.
The following summary lists the key classes touched:

- PlateDetector (backend/app/plate_detector.py) - the main ANPR pipeline; gains plate-model/vehicle-fallback modes.
- PlateLocalizer (backend/app/plate_localizer.py) - NEW - classical CV plate-candidate finder.
- Track (backend/app/tracker.py) - gains last_seen_frame, best_plate, best_conf fields.
- TrackletTracker (backend/app/tracker.py) - staleness fixed to frames-since-seen; default max_age_frames=10.

See ## [Functions] for signatures and ## [Files] for location details.


| Class | File | Type | Key changes |

| PlateDetector | backend/app/plate_detector.py | Modified | mode (plate / vehicle+localizer), new multi-variant OCR, validity gating, skip tiny plate boxes |

| PlateLocalizer | backend/app/plate_localizer.py | New | classical CV plate-candidate finder; .locate(vehicle_crop) -> List[List[int]] |

| Track | backend/app/tracker.py | Modified | new fields last_seen_frame, best_plate, best_conf |

| TrackletTracker | backend/app/tracker.py | Modified | correct staleness semantics; default max_age_frames=10 |



| PlateDetector | backend/app/plate_detector.py | Modified | mode (plate / vehicle+localizer), new multi-variant OCR, validity gating, skip tiny plate boxes |

| PlateLocalizer | backend/app/plate_localizer.py | New | classical CV plate-candidate finder; .locate(vehicle_crop) -> List[List[int]] |

| Track | backend/app/tracker.py | Modified | new fields last_seen_frame, best_plate, best_conf |

| TrackletTracker | backend/app/tracker.py | Modified | correct staleness semantics; default max_age_frames=10 |

## [Dependencies]

- No new pip/npm packages. Download script uses stdlib urllib.request; model loads through existing ultralytics package.
- One-time ~6 MB model (license-plate-finetune-v1n.pt) is already on disk; download script can still be used later.

## [Testing]

1. **Offline proof first** (backend/test_plate_detection.py, no camera needed):
   - Synthesize a 1280x720 image with a rendered plate UP32KT2112 (black on white, ~220x60 px, realistic position) using OpenCV.
   - Run PlateDetector.process_frame(); assert at least one read and is_valid_plate(read) is True.
   - Run **before** the fix to document the failure, and **after** to prove the fix (also test a small variant ~90x28 px to mimic webcam distance).

2. **Compile checks**: py_compile on plate_detector.py, plate_localizer.py, tracker.py, edge_pipeline.py, main.py.

3. **Model download validation**: script must print YOLO()-loaded class names and file size.

4. **Backend restart** (uvicorn on 127.0.0.1:8000) -> POST /api/v1/cameras/register **without** an Authorization header -> expect **200** (was 401).

5. **Live verification**: run python edge_pipeline.py (webcam) with a printed plate / phone screen / real vehicle; expect: overlay shows green plate box within ~1 s, [TRACKLET OK] Plate: <valid> | Conf: >=0.35 lines, alert + map marker within ~2-5 s (not 10-30 s).

6. **Negative test**: show the camera a face/text document - assert **no ingest** (validity rule rejects non-plate text), confirming the UPHAM1IZ @ 0.01 class of garbage is gone.

7. Regression: npm.cmd run build (frontend untouched -> must stay exit 0); re-run backend/test_api.py smoke flow.

## [Implementation Order]
1. Download plate-trained YOLO model (license-plate-finetune-v1s.pt) into backend/models/.
2. Build PlateLocalizer fallback (classical CV plate finder) in backend/app/plate_localizer.py.
3. Rewrite PlateDetector to support plate-model/vehicle-fallback modes + multi-variant OCR + validity gating, and open a 1280x720 capture path in edge_pipeline.
4. Fix tracker staleness (last_seen_frame, best_plate/conf, max_age_frames=10).
5. Add single-shot image mode (edge_pipeline --source some.jpg) and --plate-model override flag.
6. Open register_camera_endpoint to edge nodes (no user token (was 401 due to verify_police_token dependency); EDGE_NODE audit).
7. Restart backend uvicorn; verify register-200 and API smoke tests.
8. Run backend/test_plate_detection.py synthetic-plate test before/after the fix.
9. Live run with webcam + printed plate; confirm fast reads and negative test on non-plate content.
10. Final validation: compile checks, frontend build, full smoke check.
