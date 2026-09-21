"""
Virtual accelerated clock shared across the system.

Stateless by design: simulated "now" is derived purely from real elapsed time
since process start, so no background thread or persisted state is needed.
24 simulated hours compress into ~18 real minutes (MULTIPLIER = 80x), and the
simulated day wraps at 24h so a long-running demo never runs out of "day".

The epoch is pinned to 05:00 at import time (server boot). That is not arbitrary:
on this timetable every train-free window long enough to host a real maintenance
block (>= 200 min) starts between 06:00 and 12:00 - the corridor has no long
night or afternoon gaps. Booting at 05:00 therefore leaves the entire usable band
ahead of the clock, so a report approved in the first minute of a demo gets a
window later the same simulated day and starts executing within a couple of real
minutes, instead of rolling over to tomorrow.
"""

import time
from datetime import datetime, timedelta

MULTIPLIER = 80.0  # 1 real second == 80 simulated seconds -> 24h in 18 real min

SIM_EPOCH_HOUR = 5
SIM_EPOCH_MINUTE = 0

_PROCESS_START_REAL = time.time()
_SIM_EPOCH = datetime.now().replace(
    hour=SIM_EPOCH_HOUR, minute=SIM_EPOCH_MINUTE, second=0, microsecond=0
)


def sim_now() -> datetime:
    """Current simulated time. Pure function of real elapsed time since boot."""
    real_elapsed = time.time() - _PROCESS_START_REAL
    sim_elapsed_seconds = real_elapsed * MULTIPLIER
    sim_elapsed_seconds %= 86400  # wrap every simulated 24h
    return _SIM_EPOCH + timedelta(seconds=sim_elapsed_seconds)


def sim_now_iso() -> str:
    return sim_now().isoformat()


def multiplier() -> float:
    return MULTIPLIER


def parse_hhmm(hhmm: str) -> int:
    """
    Parses an "HH:MM" window string into minutes-of-day.

    The OR-Tools scheduler computes end times as `start_min + duration` without
    wrapping, so an end string may legitimately read "25:30". Callers get the raw
    (unwrapped) minute count and decide how to roll it.
    """
    parts = str(hhmm).strip().split(":")
    hours = int(parts[0])
    minutes = int(parts[1]) if len(parts) > 1 else 0
    return hours * 60 + minutes


def next_occurrence(hhmm: str, after: datetime = None) -> datetime:
    """
    Resolves an "HH:MM" window string to the next absolute datetime at or after
    `after` (default: simulated now).

    Sanctioned windows are stored as bare clock strings, but the simulated day
    wraps - so a block sanctioned at 03:00 for an 01:20 window belongs to
    *tomorrow*. Converting to an absolute datetime up front makes the lifecycle
    engine immune to that wrap.
    """
    if after is None:
        after = sim_now()

    total_min = parse_hhmm(hhmm)
    day_offset, minute_of_day = divmod(total_min, 1440)

    candidate = after.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(
        days=day_offset, minutes=minute_of_day
    )
    if candidate < after:
        candidate += timedelta(days=1)
    return candidate


def resolve_window(start_hhmm: str, end_hhmm: str, after: datetime = None):
    """
    Resolves a (start, end) window pair to absolute datetimes, guaranteeing that
    end follows start even when the block runs across midnight.
    """
    if after is None:
        after = sim_now()

    start_dt = next_occurrence(start_hhmm, after)
    duration_min = parse_hhmm(end_hhmm) - parse_hhmm(start_hhmm)
    if duration_min <= 0:
        duration_min += 1440  # window crosses midnight
    return start_dt, start_dt + timedelta(minutes=duration_min)


if __name__ == "__main__":
    print(f"Simulated now : {sim_now_iso()}  ({MULTIPLIER}x real time)")
    s, e = resolve_window("23:00", "01:30")
    print(f"Window 23:00-01:30 resolves to {s} -> {e}")
