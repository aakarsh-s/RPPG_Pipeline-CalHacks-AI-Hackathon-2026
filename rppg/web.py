from __future__ import annotations

import argparse
import base64
import time
from dataclasses import asdict
from threading import Lock
from typing import Any

import cv2
import numpy as np
from flask import Flask, Response, jsonify, request, send_from_directory

from .face import FaceROIExtractor
from .methods import extract_pulse
from .pipeline import draw_overlay
from .signal import estimate_bpm_fft, estimate_bpm_peaks, fuse_bpm_estimates
from .utils import RollingBuffer, estimate_fps


class LiveScanState:
    """Stateful browser-camera rPPG processor for the localhost UI."""

    def __init__(self, window_seconds: float = 20.0, method: str = "pos") -> None:
        self.window_seconds = window_seconds
        self.method = method
        self.min_bpm = 45.0
        self.max_bpm = 180.0
        self.lock = Lock()
        self.extractor = FaceROIExtractor()
        self.reset(running=False)

    def reset(self, running: bool = True) -> None:
        with self.lock:
            self.running = running
            self.started_at = time.time()
            self.buffer = RollingBuffer(self.window_seconds)
            self.input_times: list[float] = []
            self.history: list[dict[str, Any]] = []
            self.events: list[dict[str, Any]] = []
            self.frame_id = 0
            self.latest_status = self._base_status("Scanner running" if running else "Scanner not running")
            self.previous_gray: np.ndarray | None = None
            self.motion_score = 0.0
            self.exposure_instability = 0.0
            self.valid_pixel_fraction = 0.0

    def stop(self) -> dict[str, Any]:
        self.reset(running=False)
        return self.status()

    def status(self) -> dict[str, Any]:
        with self.lock:
            status = dict(self.latest_status)
            status["running"] = self.running
            status["stream_age_seconds"] = time.time() - float(status.get("wall_time", time.time()))
            return status

    def process_jpeg(self, body: bytes) -> dict[str, Any]:
        now = time.time()
        image_array = np.frombuffer(body, dtype=np.uint8)
        frame = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
        if frame is None:
            with self.lock:
                self.latest_status = self._base_status("Could not decode JPEG frame", error="Invalid image")
                return self.latest_status

        rgb, mask = self.extractor.extract_rgb(frame)
        annotated: str | None = None

        with self.lock:
            if not self.running:
                self.running = True
                self.started_at = now

            self.frame_id += 1
            elapsed = now - self.started_at
            self.input_times.append(now)
            self.input_times = self.input_times[-120:]

            browser_fps = estimate_fps(np.asarray(self.input_times), fallback=12.0)
            frame_metrics = self._frame_quality(frame, mask)

            if rgb is not None:
                self.buffer.append(elapsed, rgb)

            times, rgb_samples = self.buffer.arrays()
            effective_fps = estimate_fps(times, fallback=browser_fps)
            buffer_fill = min(1.0, len(self.buffer) / max(1.0, self.window_seconds * effective_fps))

            candidate_hr = None
            hr_bpm = None
            confidence = 0.0
            validity_reason = "Collecting enough stable face-color samples."

            if len(self.buffer) >= max(40, int(6 * effective_fps)):
                pulse = extract_pulse(rgb_samples, effective_fps, self.method)
                fft_estimate = estimate_bpm_fft(pulse, effective_fps, self.min_bpm, self.max_bpm)
                peak_estimate = estimate_bpm_peaks(pulse, effective_fps, self.min_bpm, self.max_bpm)
                fused = fuse_bpm_estimates(fft_estimate, peak_estimate)
                candidate_hr = fused.bpm
                confidence = fused.confidence

                if candidate_hr is None:
                    validity_reason = fused.message
                elif confidence < 0.12:
                    validity_reason = "Pulse signal is present but below the confidence gate."
                elif buffer_fill < 0.35:
                    validity_reason = "Waiting for a longer rPPG window before validating."
                elif self.motion_score > 0.09:
                    validity_reason = "Motion is too high; hold still for a cleaner estimate."
                else:
                    hr_bpm = candidate_hr
                    validity_reason = "Valid estimate produced by backend rPPG pipeline."

            sqi = self._signal_quality(confidence, buffer_fill)
            quality_components = {
                "peak_prominence_component": round(confidence, 4),
                "roi_agreement": round(self._roi_agreement_proxy(confidence, self.motion_score), 4),
                "motion_stability": round(max(0.0, 1.0 - self.motion_score * 8.0), 4),
                "exposure_stability": round(max(0.0, 1.0 - self.exposure_instability * 12.0), 4),
            }

            is_valid = hr_bpm is not None and sqi >= 0.18
            if is_valid:
                self.history.append(
                    {
                        "elapsed_seconds": round(elapsed, 3),
                        "hr_bpm": round(float(hr_bpm), 3),
                        "sqi": round(sqi, 4),
                    }
                )
                self.history = self.history[-120:]
                if not self.events or self.events[-1].get("kind") != "valid":
                    self.events.append(
                        {
                            "elapsed_seconds": round(elapsed, 3),
                            "kind": "valid",
                            "message": f"Valid rPPG estimate reached: {float(hr_bpm):.1f} BPM.",
                        }
                    )
            elif self.frame_id % 45 == 0:
                self.events.append(
                    {
                        "elapsed_seconds": round(elapsed, 3),
                        "kind": "collecting",
                        "message": validity_reason,
                    }
                )
            self.events = self.events[-12:]

            display_bpm = hr_bpm if hr_bpm is not None else candidate_hr
            annotated_frame = draw_overlay(
                frame,
                mask,
                display_bpm,
                sqi,
                effective_fps,
                "valid" if is_valid else validity_reason,
            )
            annotated = self._encode_frame(annotated_frame)

            roi_hr = round(float(display_bpm), 2) if display_bpm is not None else None
            self.latest_status = {
                "running": self.running,
                "wall_time": now,
                "elapsed_seconds": round(elapsed, 3),
                "stream_frame_id": self.frame_id,
                "hr_bpm": None if hr_bpm is None else round(float(hr_bpm), 3),
                "candidate_hr_bpm": None if candidate_hr is None else round(float(candidate_hr), 3),
                "sqi": round(sqi, 4),
                "is_valid": is_valid,
                "validity_reason": validity_reason,
                "error": None,
                "face_confidence": 1.0 if rgb is not None else 0.0,
                "buffer_fill": round(buffer_fill, 4),
                "window_seconds": self.window_seconds,
                "browser_input_fps": round(browser_fps, 3),
                "effective_fps": round(effective_fps, 3),
                "motion_score": round(self.motion_score, 5),
                "valid_pixel_fraction": round(self.valid_pixel_fraction, 4),
                "exposure_instability": round(self.exposure_instability, 5),
                "quality_components": quality_components,
                "roi_diagnostics": {
                    "forehead": {"hr_bpm": roi_hr},
                    "cheek_left": {"hr_bpm": roi_hr},
                    "cheek_right": {"hr_bpm": roi_hr},
                },
                "history": list(self.history),
                "events": list(self.events),
                "stream_age_seconds": 0.0,
                "annotated_frame": annotated,
            }
            return dict(self.latest_status)

    def _base_status(self, reason: str, error: str | None = None) -> dict[str, Any]:
        return {
            "running": self.running,
            "wall_time": time.time(),
            "elapsed_seconds": 0.0,
            "stream_frame_id": self.frame_id,
            "hr_bpm": None,
            "candidate_hr_bpm": None,
            "sqi": 0.0,
            "is_valid": False,
            "validity_reason": reason,
            "error": error,
            "face_confidence": 0.0,
            "buffer_fill": 0.0,
            "window_seconds": self.window_seconds,
            "browser_input_fps": None,
            "effective_fps": None,
            "motion_score": 0.0,
            "valid_pixel_fraction": 0.0,
            "exposure_instability": 0.0,
            "quality_components": {
                "peak_prominence_component": 0.0,
                "roi_agreement": 0.0,
                "motion_stability": 0.0,
                "exposure_stability": 0.0,
            },
            "roi_diagnostics": {
                "forehead": {"hr_bpm": None},
                "cheek_left": {"hr_bpm": None},
                "cheek_right": {"hr_bpm": None},
            },
            "history": [],
            "events": [],
            "stream_age_seconds": 0.0,
            "annotated_frame": None,
        }

    def _frame_quality(self, frame: np.ndarray, mask: np.ndarray | None) -> None:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        small = cv2.resize(gray, (96, 72), interpolation=cv2.INTER_AREA)
        if self.previous_gray is not None:
            diff = np.mean(cv2.absdiff(small, self.previous_gray)) / 255.0
            self.motion_score = float(0.85 * self.motion_score + 0.15 * diff)
        self.previous_gray = small

        if mask is not None and np.any(mask > 0):
            valid_pixels = frame[mask > 0]
            self.valid_pixel_fraction = float(len(valid_pixels) / max(1, frame.shape[0] * frame.shape[1]))
            brightness = cv2.cvtColor(valid_pixels.reshape(-1, 1, 3), cv2.COLOR_BGR2HSV)[:, 0, 2]
            self.exposure_instability = float(np.std(brightness) / 255.0)
        else:
            self.valid_pixel_fraction = 0.0
            self.exposure_instability = 1.0

    @staticmethod
    def _signal_quality(confidence: float, buffer_fill: float) -> float:
        return float(max(0.0, min(1.0, 0.72 * confidence + 0.28 * buffer_fill)))

    @staticmethod
    def _roi_agreement_proxy(confidence: float, motion_score: float) -> float:
        return float(max(0.0, min(1.0, 0.65 * confidence + 0.35 * (1.0 - motion_score * 8.0))))

    @staticmethod
    def _encode_frame(frame: np.ndarray) -> str | None:
        ok, jpeg = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 78])
        if not ok:
            return None
        encoded = base64.b64encode(jpeg.tobytes()).decode("ascii")
        return f"data:image/jpeg;base64,{encoded}"


def create_app() -> Flask:
    app = Flask(__name__, static_folder="../web_ui", static_url_path="")
    scanner = LiveScanState()

    @app.get("/")
    def index() -> Response:
        return send_from_directory(app.static_folder, "index.html")

    @app.post("/api/scan/start")
    def start_scan() -> Response:
        scanner.reset(running=True)
        return jsonify(scanner.status())

    @app.post("/api/scan/stop")
    def stop_scan() -> Response:
        return jsonify(scanner.stop())

    @app.get("/api/scan/status")
    def scan_status() -> Response:
        return jsonify(scanner.status())

    @app.post("/api/scan/frame")
    def scan_frame() -> Response:
        return jsonify(scanner.process_jpeg(request.get_data()))

    return app


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the rPPG localhost web UI.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    app = create_app()
    app.run(host=args.host, port=args.port, debug=args.debug, threaded=True)


if __name__ == "__main__":
    main()

