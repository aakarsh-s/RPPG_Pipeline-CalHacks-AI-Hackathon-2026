from __future__ import annotations

import numpy as np


def normalize_rgb(rgb: np.ndarray) -> np.ndarray:
    """Normalize RGB channels by their temporal mean."""
    rgb = np.asarray(rgb, dtype=np.float64)
    means = rgb.mean(axis=0)
    means[means == 0] = 1.0
    return (rgb / means) - 1.0


def pos(rgb: np.ndarray, fps: float) -> np.ndarray:
    """Plane-Orthogonal-to-Skin rPPG projection.

    Input shape: (n_samples, 3), RGB channel means over time.
    Output shape: (n_samples,), raw pulse signal.
    """
    del fps
    c = normalize_rgb(rgb).T
    if c.shape[1] < 2:
        return np.zeros(c.shape[1])

    projection = np.array([[0.0, 1.0, -1.0], [-2.0, 1.0, 1.0]])
    s = projection @ c
    std0 = np.std(s[0]) or 1.0
    std1 = np.std(s[1]) or 1.0
    pulse = s[0] + (std0 / std1) * s[1]
    return pulse - np.mean(pulse)


def chrom(rgb: np.ndarray, fps: float) -> np.ndarray:
    """Chrominance-based rPPG projection."""
    del fps
    c = normalize_rgb(rgb).T
    if c.shape[1] < 2:
        return np.zeros(c.shape[1])

    x = 3.0 * c[0] - 2.0 * c[1]
    y = 1.5 * c[0] + c[1] - 1.5 * c[2]
    std_x = np.std(x) or 1.0
    std_y = np.std(y) or 1.0
    pulse = x - (std_x / std_y) * y
    return pulse - np.mean(pulse)


def extract_pulse(rgb: np.ndarray, fps: float, method: str) -> np.ndarray:
    method = method.lower()
    if method == "pos":
        return pos(rgb, fps)
    if method == "chrom":
        return chrom(rgb, fps)
    raise ValueError(f"Unknown rPPG method: {method}. Choose 'pos' or 'chrom'.")

