"""ASTRANET — Simulation Clock Module.

Provides a deterministic master clock for the CubeSat swarm simulation,
supporting fixed-step progression, variable acceleration warp factors,
pause/resume states, and formatted mission elapsed time strings.
"""

from typing import Optional, Dict, Any
import datetime


class SimulationClock:
    """Deterministic simulation clock for the ASTRANET swarm engine.

    All time values are tracked in SI seconds (float). Time progression is strictly
    discrete and reproducible.
    """

    def __init__(
        self,
        start_epoch_sec: float = 1729175400.0,
        initial_elapsed_sec: float = 0.0,
        default_step_sec: float = 1.0,
        warp_factor: float = 1.0,
    ) -> None:
        """Initialize the simulation clock.

        Args:
            start_epoch_sec: Base UTC Unix timestamp representing T=0.
            initial_elapsed_sec: Initial mission elapsed time in seconds.
            default_step_sec: Default integration time step in seconds.
            warp_factor: Time acceleration multiplier (e.g. 1.0 = real-time, 60.0 = demo mode).
        """
        self._start_epoch_sec: float = float(start_epoch_sec)
        self._elapsed_sec: float = float(initial_elapsed_sec)
        self._default_step_sec: float = float(default_step_sec)
        self._warp_factor: float = float(warp_factor)
        self._is_paused: bool = False
        self._ticks_count: int = 0

    @property
    def elapsed_seconds(self) -> float:
        """Cumulative simulated elapsed mission time in seconds."""
        return self._elapsed_sec

    @property
    def current_epoch_sec(self) -> float:
        """Current simulated UTC Unix timestamp in seconds."""
        return self._start_epoch_sec + self._elapsed_sec

    @property
    def warp_factor(self) -> float:
        """Current time acceleration multiplier."""
        return self._warp_factor

    @property
    def is_paused(self) -> bool:
        """Whether the simulation clock is paused."""
        return self._is_paused

    @property
    def ticks_count(self) -> int:
        """Total number of discrete tick steps executed."""
        return self._ticks_count

    @property
    def default_step_sec(self) -> float:
        """Default step size in seconds."""
        return self._default_step_sec

    def set_warp(self, factor: float) -> None:
        """Set the time acceleration factor.

        Args:
            factor: Multiplier (must be >= 0.0).
        """
        if factor < 0.0:
            raise ValueError(f"Warp factor must be non-negative, got {factor}")
        self._warp_factor = float(factor)

    def pause(self) -> None:
        """Pause simulation time progression."""
        self._is_paused = True

    def resume(self) -> None:
        """Resume simulation time progression."""
        self._is_paused = False

    def toggle_pause(self) -> bool:
        """Toggle pause state and return the new state."""
        self._is_paused = not self._is_paused
        return self._is_paused

    def tick(self, dt: Optional[float] = None) -> float:
        """Advance the simulation clock by one discrete step.

        If the clock is paused, elapsed time does not advance, but tick count is
        preserved for step attribution.

        Args:
            dt: Optional explicit time step in seconds. If None, default_step_sec is used.

        Returns:
            The new cumulative elapsed time in seconds.
        """
        step = self._default_step_sec if dt is None else float(dt)
        if step < 0.0:
            raise ValueError(f"Time step dt must be non-negative, got {step}")

        if not self._is_paused:
            delta = step * self._warp_factor
            self._elapsed_sec += delta

        self._ticks_count += 1
        return self._elapsed_sec

    def reset(self, initial_elapsed_sec: float = 0.0) -> None:
        """Reset the clock to initial state."""
        self._elapsed_sec = float(initial_elapsed_sec)
        self._ticks_count = 0
        self._is_paused = False

    def format_mission_time(self) -> str:
        """Format elapsed mission time as HH:MM:SS string."""
        total_sec = int(self._elapsed_sec)
        hours = total_sec // 3600
        minutes = (total_sec % 3600) // 60
        seconds = total_sec % 60
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"

    def format_utc_time(self) -> str:
        """Format current epoch time as UTC timestamp string."""
        dt = datetime.datetime.fromtimestamp(self.current_epoch_sec, tz=datetime.timezone.utc)
        return dt.strftime("%H:%M:%S UTC")

    def to_dict(self) -> Dict[str, Any]:
        """Serialize clock state to a dictionary for API/WebSocket frames."""
        return {
            "epochSec": round(self.current_epoch_sec, 3),
            "elapsedSec": round(self._elapsed_sec, 3),
            "timeString": self.format_mission_time(),
            "utcString": self.format_utc_time(),
            "warpFactor": self._warp_factor,
            "isPaused": self._is_paused,
            "ticks": self._ticks_count,
        }
