from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.signal import butter, detrend, filtfilt, find_peaks, periodogram


@dataclass
class BPMEstimate:
    bpm: float | None
    confidence: float
    method: str
    message: str


def bandpass_filter(signal: np.ndarray, fps: float, min_bpm: float, max_bpm: float) -> np.ndarray:
    signal = np.asarray(signal, dtype=np.float64)
    if len(signal) < 12 or fps <= 0:
        return signal

    nyquist = 0.5 * fps
    low = (min_bpm / 60.0) / nyquist
    high = (max_bpm / 60.0) / nyquist
    high = min(high, 0.99)

    if low <= 0 or high <= low:
        return signal - np.mean(signal)

    order = 3
    min_required = 3 * (order + 1)
    if len(signal) <= min_required:
        return signal - np.mean(signal)

    b, a = butter(order, [low, high], btype="band")
    return filtfilt(b, a, detrend(signal))


def estimate_bpm_fft(
    pulse: np.ndarray,
    fps: float,
    min_bpm: float = 45.0,
    max_bpm: float = 180.0,
) -> BPMEstimate:
    pulse = np.asarray(pulse, dtype=np.float64)
    if len(pulse) < max(32, int(5 * fps)):
        return BPMEstimate(None, 0.0, "fft", "Need at least ~5 seconds of usable signal")

    filtered = bandpass_filter(pulse, fps, min_bpm, max_bpm)
    freqs, power = periodogram(filtered, fs=fps, scaling="spectrum")

    valid = (freqs >= min_bpm / 60.0) & (freqs <= max_bpm / 60.0)
    if not np.any(valid):
        return BPMEstimate(None, 0.0, "fft", "No frequency bins inside heart-rate range")

    valid_freqs = freqs[valid]
    valid_power = power[valid]
    if np.all(valid_power <= 0):
        return BPMEstimate(None, 0.0, "fft", "No spectral power in heart-rate range")

    peak_idx = int(np.argmax(valid_power))
    bpm = float(valid_freqs[peak_idx] * 60.0)

    total_power = float(np.sum(valid_power)) or 1.0
    confidence = float(valid_power[peak_idx] / total_power)
    confidence = max(0.0, min(1.0, confidence * 5.0))

    return BPMEstimate(bpm, confidence, "fft", "ok")


def estimate_bpm_peaks(
    pulse: np.ndarray,
    fps: float,
    min_bpm: float = 45.0,
    max_bpm: float = 180.0,
) -> BPMEstimate:
    pulse = np.asarray(pulse, dtype=np.float64)
    if len(pulse) < max(32, int(8 * fps)):
        return BPMEstimate(None, 0.0, "peaks", "Need at least ~8 seconds of usable signal")

    filtered = bandpass_filter(pulse, fps, min_bpm, max_bpm)
    min_distance = int(fps * 60.0 / max_bpm)
    peaks, props = find_peaks(filtered, distance=max(1, min_distance), prominence=np.std(filtered) * 0.25)

    if len(peaks) < 3:
        return BPMEstimate(None, 0.0, "peaks", "Not enough stable peaks")

    intervals = np.diff(peaks) / fps
    bpms = 60.0 / intervals
    bpms = bpms[(bpms >= min_bpm) & (bpms <= max_bpm)]
    if len(bpms) == 0:
        return BPMEstimate(None, 0.0, "peaks", "Peak intervals outside heart-rate range")

    bpm = float(np.median(bpms))
    stability = float(1.0 / (1.0 + np.std(bpms)))
    prominence = float(np.mean(props.get("prominences", [0.0])))
    confidence = max(0.0, min(1.0, stability * (1.0 + prominence)))

    return BPMEstimate(bpm, confidence, "peaks", "ok")


def fuse_bpm_estimates(fft_estimate: BPMEstimate, peak_estimate: BPMEstimate) -> BPMEstimate:
    estimates = [e for e in (fft_estimate, peak_estimate) if e.bpm is not None]
    if not estimates:
        return BPMEstimate(None, 0.0, "fused", f"{fft_estimate.message}; {peak_estimate.message}")

    if len(estimates) == 1:
        e = estimates[0]
        return BPMEstimate(e.bpm, e.confidence * 0.75, "fused", f"Only {e.method} available")

    a, b = estimates
    disagreement = abs(float(a.bpm) - float(b.bpm))
    weights = np.array([a.confidence, b.confidence], dtype=np.float64)
    if np.sum(weights) <= 0:
        weights = np.ones(2)
    bpm = float(np.average([a.bpm, b.bpm], weights=weights))

    agreement_penalty = max(0.0, 1.0 - disagreement / 20.0)
    confidence = float(np.mean(weights) * agreement_penalty)
    return BPMEstimate(bpm, max(0.0, min(1.0, confidence)), "fused", "ok")

