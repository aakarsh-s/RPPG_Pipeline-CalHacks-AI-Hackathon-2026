from __future__ import annotations

import cv2
import mediapipe as mp
import numpy as np


class FaceROIExtractor:
    """Extracts stable cheek and forehead regions using MediaPipe Face Mesh."""

    # Small sets of face-mesh landmarks that roughly cover cheeks and forehead.
    # These are intentionally conservative to avoid eyes, mouth, and background.
    LEFT_CHEEK = [50, 101, 118, 119, 120, 126, 203, 205, 206, 216]
    RIGHT_CHEEK = [280, 330, 347, 348, 349, 355, 423, 425, 426, 436]
    FOREHEAD = [9, 10, 67, 69, 103, 104, 108, 109, 151, 299, 333, 334, 337, 338]

    def __init__(self) -> None:
        self._mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.6,
            min_tracking_confidence=0.6,
        )

    def close(self) -> None:
        self._mesh.close()

    def extract_rgb(self, frame_bgr: np.ndarray) -> tuple[np.ndarray | None, np.ndarray | None]:
        """Return mean RGB over skin ROIs plus a debug mask.

        Returns:
            (rgb_mean, mask). rgb_mean is None when no reliable face is found.
        """
        h, w = frame_bgr.shape[:2]
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        result = self._mesh.process(frame_rgb)

        if not result.multi_face_landmarks:
            return None, None

        landmarks = result.multi_face_landmarks[0].landmark
        points = np.array([(int(lm.x * w), int(lm.y * h)) for lm in landmarks], dtype=np.int32)

        mask = np.zeros((h, w), dtype=np.uint8)
        for indices in (self.LEFT_CHEEK, self.RIGHT_CHEEK, self.FOREHEAD):
            polygon = points[indices]
            if self._valid_polygon(polygon, w, h):
                hull = cv2.convexHull(polygon)
                cv2.fillConvexPoly(mask, hull, 255)

        mask = self._skin_refine(frame_bgr, mask)

        pixels = frame_rgb[mask > 0]
        if len(pixels) < 200:
            return None, mask

        # Trim extreme pixels to reduce specular highlights and shadows.
        low = np.percentile(pixels, 10, axis=0)
        high = np.percentile(pixels, 90, axis=0)
        trimmed = pixels[np.all((pixels >= low) & (pixels <= high), axis=1)]
        if len(trimmed) < 100:
            trimmed = pixels

        return trimmed.mean(axis=0).astype(np.float64), mask

    @staticmethod
    def _valid_polygon(polygon: np.ndarray, width: int, height: int) -> bool:
        if polygon.shape[0] < 3:
            return False
        if np.any(polygon[:, 0] < 0) or np.any(polygon[:, 0] >= width):
            return False
        if np.any(polygon[:, 1] < 0) or np.any(polygon[:, 1] >= height):
            return False
        return cv2.contourArea(polygon) > 20

    @staticmethod
    def _skin_refine(frame_bgr: np.ndarray, roi_mask: np.ndarray) -> np.ndarray:
        """Lightweight HSV/YCrCb refinement inside the landmark ROI."""
        ycrcb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2YCrCb)
        hsv = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2HSV)

        y, cr, cb = cv2.split(ycrcb)
        h, s, v = cv2.split(hsv)

        skin_ycrcb = (cr > 133) & (cr < 180) & (cb > 77) & (cb < 135)
        not_too_dark = v > 35
        not_too_desaturated = s > 10

        refined = roi_mask.copy()
        refined[~(skin_ycrcb & not_too_dark & not_too_desaturated)] = 0
        refined = cv2.medianBlur(refined, 5)
        return refined

