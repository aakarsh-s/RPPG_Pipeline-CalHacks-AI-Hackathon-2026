from __future__ import annotations

import argparse
import csv
import time
from pathlib import Path

import cv2
import numpy as np

from .face import FaceROIExtractor
from .methods import extract_pulse
from .signal import estimate_bpm_fft, estimate_bpm_peaks, fuse_bpm_estimates
from .utils import RPPGConfig, RollingBuffer, estimate_fps


def parse_args() -> RPPGConfig:
    parser = argparse.ArgumentParser(description="rPPG heart-rate estimation from webcam/video.")
    parser.add_argument("--source", default="0", help="Camera index like 0, or path to video file.")
    parser.add_argument("--method", default="pos", choices=["pos", "chrom"], help="rPPG extraction method.")
    parser.add_argument("--window-seconds", type=float, default=20.0, help="Sliding signal window in seconds.")
    parser.add_argument("--min-bpm", type=float, default=45.0, help="Minimum plausible BPM.")
    parser.add_argument("--max-bpm", type=float, default=180.0, help="Maximum plausible BPM.")
    parser.add_argument("--output", default=None, help="Optional CSV output path.")
    parser.add_argument("--show", action="store_true", help="Show live debug window.")
    args = parser.parse_args()
    return RPPGConfig(
        method=args.method,
        window_seconds=args.window_seconds,
        min_bpm=args.min_bpm,
        max_bpm=args.max_bpm,
        output=args.output,
        show=args.show,
    ), args.source


def open_capture(source: str) -> cv2.VideoCapture:
    if source.isdigit():
        return cv2.VideoCapture(int(source))
    return cv2.VideoCapture(source)


def draw_overlay(
    frame: np.ndarray,
    mask: np.ndarray | None,
    bpm: float | None,
    confidence: float,
    fps: float,
    status: str,
) -> np.ndarray:
    output = frame.copy()

    if mask is not None:
        color_mask = np.zeros_like(output)
        color_mask[:, :, 1] = mask
        output = cv2.addWeighted(output, 1.0, color_mask, 0.25, 0.0)

    bpm_text = "--" if bpm is None else f"{bpm:0.1f}"
    lines = [
        f"BPM: {bpm_text}",
        f"Confidence: {confidence:0.2f}",
        f"FPS: {fps:0.1f}",
        f"Status: {status}",
    ]
    for i, line in enumerate(lines):
        y = 32 + i * 28
        cv2.putText(output, line, (18, y), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 0, 0), 4)
        cv2.putText(output, line, (18, y), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2)

    return output


def run_pipeline(config: RPPGConfig, source: str) -> None:
    cap = open_capture(source)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open source: {source}")

    extractor = FaceROIExtractor()
    buffer = RollingBuffer(config.window_seconds)
    rows: list[dict[str, float | str]] = []

    source_fps = cap.get(cv2.CAP_PROP_FPS)
    source_fps = source_fps if source_fps and source_fps > 1 else 30.0
    start_wall = time.time()
    frame_index = 0
    last_estimate_time = 0.0
    current_bpm: float | None = None
    current_confidence = 0.0
    status = "warming up"

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            if source.isdigit():
                timestamp = time.time() - start_wall
            else:
                timestamp = frame_index / source_fps

            rgb, mask = extractor.extract_rgb(frame)
            if rgb is not None:
                buffer.append(timestamp, rgb)
                status = "tracking"
            else:
                status = "face/skin ROI not found"

            times, rgb_samples = buffer.arrays()
            fps = estimate_fps(times, fallback=source_fps)

            # Estimate at about 2 Hz instead of every frame.
            if len(buffer) > int(max(5.0, config.window_seconds * 0.4) * fps) and timestamp - last_estimate_time > 0.5:
                pulse = extract_pulse(rgb_samples, fps, config.method)
                fft_estimate = estimate_bpm_fft(pulse, fps, config.min_bpm, config.max_bpm)
                peak_estimate = estimate_bpm_peaks(pulse, fps, config.min_bpm, config.max_bpm)
                fused = fuse_bpm_estimates(fft_estimate, peak_estimate)
                current_bpm = fused.bpm
                current_confidence = fused.confidence
                status = fused.message
                last_estimate_time = timestamp

                rows.append(
                    {
                        "time_seconds": round(timestamp, 3),
                        "bpm": "" if current_bpm is None else round(current_bpm, 3),
                        "confidence": round(current_confidence, 4),
                        "method": config.method,
                        "fps": round(fps, 3),
                        "status": status,
                    }
                )

            if config.show:
                debug = draw_overlay(frame, mask, current_bpm, current_confidence, fps, status)
                cv2.imshow("rPPG Pipeline", debug)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

            frame_index += 1
    finally:
        extractor.close()
        cap.release()
        if config.show:
            cv2.destroyAllWindows()

    if config.output:
        write_csv(config.output, rows)


def write_csv(path: str, rows: list[dict[str, float | str]]) -> None:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = ["time_seconds", "bpm", "confidence", "method", "fps", "status"]
    with output_path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} estimates to {output_path}")


def main() -> None:
    config, source = parse_args()
    run_pipeline(config, source)

