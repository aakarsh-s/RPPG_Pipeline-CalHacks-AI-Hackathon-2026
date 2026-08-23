from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Deque, Iterable

import numpy as np


@dataclass
class RPPGConfig:
    method: str = "pos"
    window_seconds: float = 20.0
    min_bpm: float = 45.0
    max_bpm: float = 180.0
    output: str | None = None
    show: bool = False


class RollingBuffer:
    """Fixed-duration buffer for timestamps and RGB samples."""

    def __init__(self, duration_seconds: float) -> None:
        self.duration_seconds = duration_seconds
        self.times: Deque[float] = deque()
        self.samples: Deque[np.ndarray] = deque()

    def append(self, timestamp: float, rgb: Iterable[float]) -> None:
        self.times.append(float(timestamp))
        self.samples.append(np.asarray(rgb, dtype=np.float64))
        self._trim()

    def _trim(self) -> None:
        if not self.times:
            return
        newest = self.times[-1]
        while self.times and newest - self.times[0] > self.duration_seconds:
            self.times.popleft()
            self.samples.popleft()

    def arrays(self) -> tuple[np.ndarray, np.ndarray]:
        if not self.times:
            return np.empty(0), np.empty((0, 3))
        return np.asarray(self.times, dtype=np.float64), np.vstack(self.samples)

    def __len__(self) -> int:
        return len(self.times)


def estimate_fps(times: np.ndarray, fallback: float = 30.0) -> float:
    if len(times) < 3:
        return fallback
    intervals = np.diff(times)
    intervals = intervals[intervals > 0]
    if len(intervals) == 0:
        return fallback
    return float(1.0 / np.median(intervals))

