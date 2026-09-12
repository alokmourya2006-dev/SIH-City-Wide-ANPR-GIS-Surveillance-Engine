import threading
import time
from collections import OrderedDict
from typing import Dict, Optional


class DetectionDebouncer:
    """
    Thread-safe per-(camera, plate) cooldown window for edge detections.

    A typical edge pipeline re-reads the same plate on every frame while a
    vehicle is in view (5-30s per pass). A cooldown of 45s absorbs the whole
    pass plus a short re-entry margin, while still allowing the SAME vehicle
    to be logged again at the NEXT camera immediately (key includes camera_id)
    and a genuine repeat visit after the pass.

    - Dict is pruned (LRU-bounded) so long-running edge nodes never leak memory.
    - Stats counters make the suppression rate visible for monitoring.
    """

    def __init__(
        self,
        interval_seconds: float = 45.0,
        max_keys: int = 4096,
    ):
        self.interval_seconds = float(interval_seconds)
        self.max_keys = int(max_keys)
        self.last_seen: "OrderedDict[str, float]" = OrderedDict()
        self._lock = threading.Lock()

        # Monitoring stats
        self.accepted = 0
        self.suppressed = 0

    def should_process(self, camera_id: str, plate_number: str, *, now: Optional[float] = None) -> bool:
        """
        Return True (and record the hit) if this camera+plate is outside the
        cooldown window; return False if it is a suppressed duplicate.
        """
        key = f"{camera_id}:{plate_number}"
        current_time = now if now is not None else time.time()

        with self._lock:
            last = self.last_seen.get(key)
            if last is not None and (current_time - last) < self.interval_seconds:
                # Refresh position so the entry does not get pruned while the
                # vehicle is still actively in view.
                self.last_seen.move_to_end(key)
                self.suppressed += 1
                return False

            self.last_seen[key] = current_time
            self.last_seen.move_to_end(key)
            self._prune_locked()
            self.accepted += 1
            return True

    def _prune_locked(self) -> None:
        """Trim expired entries first, then hard-cap the dict size (LRU)."""
        cutoff = time.time() - max(self.interval_seconds * 4, 300.0)
        expired = [k for k, ts in self.last_seen.items() if ts < cutoff]
        for k in expired:
            self.last_seen.pop(k, None)
        while len(self.last_seen) > self.max_keys:
            self.last_seen.popitem(last=False)

    def stats(self) -> Dict[str, float]:
        with self._lock:
            total = self.accepted + self.suppressed
            return {
                "interval_seconds": self.interval_seconds,
                "active_keys": len(self.last_seen),
                "accepted": self.accepted,
                "suppressed": self.suppressed,
                "suppress_rate_pct": round(
                    (self.suppressed / total * 100.0) if total else 0.0, 1
                ),
            }