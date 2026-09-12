"""
Lightweight IoU-based multi-object tracker for tracklet generation.
Tracks detections across frames and groups them into tracklets.
"""
import time
from typing import Dict, List, Optional
from collections import defaultdict

class Track:
    def __init__(self, track_id: int, bbox: List[float], plate_text: str, confidence: float, timestamp: str, vehicle_type: str = "UNKNOWN"):
        self.track_id = track_id
        self.bbox = bbox
        self.plate_text = plate_text
        self.best_plate = plate_text
        self.confidence = confidence
        self.best_conf = confidence
        self.vehicle_type = vehicle_type
        self.best_vehicle_type = vehicle_type
        self.start_time = timestamp
        self.last_time = timestamp
        self.observations = 1
        self.last_bbox = bbox
        self.last_seen_frame = 0
        self.active = True

class TrackletTracker:
    def __init__(self, iou_threshold: float = 0.3, max_age_frames: int = 10):
        """
        IoU-based tracker.
        iou_threshold: minimum IoU to match detections to existing tracks
        max_age_frames: number of frames before a track is considered closed
        """
        self.iou_threshold = iou_threshold
        self.max_age_frames = max_age_frames
        self.tracks: Dict[int, Track] = {}
        self.next_track_id = 1
        self.frame_count = 0

    def _compute_iou(self, box1: List[float], box2: List[float]) -> float:
        """
        Compute Intersection over Union between two bounding boxes.
        """
        x1_1, y1_1, x2_1, y2_1 = box1
        x1_2, y1_2, x2_2, y2_2 = box2
        
        # Intersection
        x1_i = max(x1_1, x1_2)
        y1_i = max(y1_1, y1_2)
        x2_i = min(x2_1, x2_2)
        y2_i = min(y2_1, y2_2)
        
        if x2_i < x1_i or y2_i < y1_i:
            return 0.0
        
        inter_area = (x2_i - x1_i) * (y2_i - y1_i)
        
        # Union
        area1 = (x2_1 - x1_1) * (y2_1 - y1_1)
        area2 = (x2_2 - x1_2) * (y2_2 - y1_2)
        union_area = area1 + area2 - inter_area
        
        if union_area == 0:
            return 0.0
        
        return inter_area / union_area

    def update(self, detections: List[dict], timestamp: str) -> List[dict]:
        """
        Update tracker with new detections.
        Returns list of closed tracklets.
        """
        self.frame_count += 1
        closed_tracklets = []
        
        # Match detections to existing tracks
        matched_track_ids = set()
        
        for det in detections:
            best_track_id = None
            best_iou = self.iou_threshold
            
            for track_id, track in self.tracks.items():
                if track_id in matched_track_ids or not track.active:
                    continue
                
                iou = self._compute_iou(track.last_bbox, det["bbox"])
                if iou > best_iou:
                    best_iou = iou
                    best_track_id = track_id
            
            if best_track_id is not None:
                # Update existing track
                track = self.tracks[best_track_id]
                track.last_bbox = det["bbox"]
                track.last_time = timestamp
                track.last_seen_frame = self.frame_count
                track.observations += 1
                track.confidence = max(track.confidence, det["confidence"])
                if det.get("confidence", 0) > track.best_conf and det.get("plate_text"):
                    track.best_conf = det["confidence"]
                    track.best_plate = det["plate_text"]
                    track.plate_text = det["plate_text"]
                    if det.get("vehicle_type"):
                        track.best_vehicle_type = det["vehicle_type"]
                        track.vehicle_type = det["vehicle_type"]
                matched_track_ids.add(best_track_id)
            else:
                # Create new track
                new_track = Track(
                    track_id=self.next_track_id,
                    bbox=det["bbox"],
                    plate_text=det.get("plate_text", ""),
                    confidence=det["confidence"],
                    timestamp=timestamp,
                    vehicle_type=det.get("vehicle_type", "UNKNOWN")
                )
                new_track.last_seen_frame = self.frame_count
                self.tracks[self.next_track_id] = new_track
                self.next_track_id += 1
                matched_track_ids.add(new_track.track_id)
        
        # Close tracks unseen for max_age_frames (frames-since-seen semantics)
        to_close = []
        for track_id, track in self.tracks.items():
            if track_id not in matched_track_ids and track.active:
                if self.frame_count - track.last_seen_frame > self.max_age_frames:
                    to_close.append(track_id)
        
        for track_id in to_close:
            track = self.tracks[track_id]
            track.active = False
            closed_tracklets.append({
                "track_id": track.track_id,
                "plate_text": track.best_plate or track.plate_text,
                "confidence": track.best_conf,
                "vehicle_type": track.best_vehicle_type or track.vehicle_type or "UNKNOWN",
                "start_time": track.start_time,
                "end_time": track.last_time,
                "observations": track.observations
            })
            del self.tracks[track_id]
        
        return closed_tracklets

    def get_active_tracks(self) -> List[dict]:
        """
        Get currently active tracks.
        """
        return [
            {
                "track_id": t.track_id,
                "plate_text": t.plate_text,
                "confidence": t.confidence,
                "start_time": t.start_time,
                "observations": t.observations
            }
            for t in self.tracks.values() if t.active
        ]