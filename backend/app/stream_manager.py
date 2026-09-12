"""
Thread-safe in-memory frame store + MJPEG stream generator.

Edge nodes push annotated JPEG frames via POST /api/v1/cameras/{id}/frame.
The browser pulls a multipart/x-mixed-replace stream via
GET /api/v1/cameras/{id}/stream (MJPEG), rendered natively by <img> tags.
"""
import threading
import time
from typing import Dict, Optional, Tuple

FRAME_STORE: Dict[str, dict] = {}   # camera_id -> {"jpeg": bytes, "ts": float}
FRAME_TTL_SECONDS = 120.0           # drop stale frames after this long
_LOCK = threading.Lock()

# MJPEG multipart boundary
_MJPEG_BOUNDARY = b"--frame"
_MJPEG_HEADER = (
    b"Content-Type: multipart/x-mixed-replace; boundary=frame\r\n\r\n"
)


def update_frame(camera_id: str, jpeg: bytes) -> None:
    """Store the latest JPEG frame for a camera (thread-safe)."""
    with _LOCK:
        FRAME_STORE[camera_id] = {"jpeg": jpeg, "ts": time.monotonic()}


def latest_frame(camera_id: str) -> Optional[Tuple[bytes, float]]:
    """
    Return (jpeg_bytes, monotonic_ts) for the camera's latest frame,
    or None if never seen / expired.
    """
    with _LOCK:
        entry = FRAME_STORE.get(camera_id)
        if not entry:
            return None
        if time.monotonic() - entry["ts"] > FRAME_TTL_SECONDS:
            FRAME_STORE.pop(camera_id, None)
            return None
        return entry["jpeg"], entry["ts"]


def has_frame(camera_id: str) -> bool:
    """Quick liveness check (used by /cameras/status)."""
    return latest_frame(camera_id) is not None


def mjpeg_generator(camera_id: str, first_frame_timeout: float = 60.0):
    """
    Generator that yields MJPEG multipart chunks whenever a newer frame
    arrives for the given camera. Sleeps briefly between polls so the
    connection idles without burning CPU when the camera is quiet.

    - Waits up to first_frame_timeout seconds for the FIRST frame
      (so a browser tab opened before the edge pipeline starts still
      connects successfully once frames begin arriving).
    - Ends the stream only after frames go stale/expired mid-stream.
    """
    start = time.monotonic()
    last_seen = 0.0
    got_first = False
    while True:
        item = latest_frame(camera_id)
        if item is None:
            if got_first:
                break                      # frames went stale -> end stream
            if time.monotonic() - start > first_frame_timeout:
                break                      # never received a first frame
            time.sleep(0.25)
            continue
        jpeg, ts = item
        got_first = True
        if ts != last_seen:
            last_seen = ts
            chunk = (
                _MJPEG_BOUNDARY
                + b"\r\nContent-Type: image/jpeg\r\nContent-Length: "
                + str(len(jpeg)).encode()
                + b"\r\n\r\n"
                + jpeg
                + b"\r\n"
            )
            yield chunk
            # Cap outbound rate at ~10 FPS to be kind to the browser
            time.sleep(0.08)
        else:
            time.sleep(0.04)