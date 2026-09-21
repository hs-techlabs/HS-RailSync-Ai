"""
Sanctioned Block Lifecycle Engine.

Walks approved maintenance demands through real execution as the virtual clock
advances, so a sanctioned block does not just sit in a table forever:

    APPROVED_SHADOW_BLOCK --(sim clock reaches window start)--> IN_PROGRESS
                          --(sim clock passes window end)-----> COMPLETED
                          --(control office withdrawal)--------> CANCELLED

Cancellation mirrors what actually happens in a control office: a sanctioned
block gets withdrawn because a late-running superfast needs the path, a machine
is unavailable, or the weather turns. It is deliberately rare (at most one per
~90 simulated minutes) and only ever targets a block that has not yet started -
you cannot un-sanction work that is already under way.

Every transition emits an event, which is what surfaces as a notification on the
Central OCC desk and on the owning department's portal.
"""

import random
from datetime import datetime

from src.simulator import sim_state
from src.simulator.virtual_clock import sim_now

# Statuses this engine owns
STATUS_APPROVED = "APPROVED_SHADOW_BLOCK"
STATUS_IN_PROGRESS = "IN_PROGRESS"
STATUS_COMPLETED = "COMPLETED"
STATUS_CANCELLED = "CANCELLED"

# Cancellation policy. Deliberately conservative: a withdrawal should read as a
# notable event, not as the normal state of the corridor.
MIN_CANCEL_GAP_SIM_MIN = 90.0    # never more than one withdrawal per 90 sim-min
CANCEL_PROBABILITY = 0.30        # ...and even then, only sometimes
MIN_UPCOMING_TO_CANCEL = 2       # never withdraw the last remaining block
MIN_LEAD_SIM_MIN = 20.0          # give a block a chance to actually start

CANCELLATION_REASONS = [
    "Path required for late-running 12002 Shatabdi Express - block withdrawn by Sr.DOM",
    "VIP / Special train movement notified; corridor possession cancelled by Control",
    "Tower wagon unavailable at depot - TRD unable to turn out crew in time",
    "Adverse weather: dense fog, visibility below 50m - unsafe to occupy block",
    "25 kV power block permit not granted by TPC; OHE isolation refused",
    "Emergency block clash on adjacent section takes precedence",
    "Engineering gang diverted to derailment restoration duty",
]


def _parse(ts: str):
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts)
    except (ValueError, TypeError):
        return None


def _sim_minutes_since(then: datetime, now: datetime) -> float:
    """Elapsed simulated minutes, accounting for the simulated day wrapping."""
    delta_min = (now - then).total_seconds() / 60.0
    if delta_min < 0:
        delta_min += 24 * 60
    return delta_min


def _cancellation_allowed(now: datetime) -> bool:
    """True if enough simulated time has passed since the last withdrawal."""
    events = sim_state.read_events()
    last = None
    for ev in reversed(events):
        if ev.get("kind") == "BLOCK_CANCELLED":
            last = _parse(ev.get("sim_time"))
            break
    if last is None:
        return True
    return _sim_minutes_since(last, now) >= MIN_CANCEL_GAP_SIM_MIN


def _describe(demand: dict) -> str:
    # S&T assets are station-based, so their raw section reads "KRJ - KRJ".
    # Render that as a yard rather than a nonsensical section.
    frm, to = demand.get("section_from"), demand.get("section_to")
    where = f"{frm} Station Yard" if frm == to else f"{frm} - {to}"
    return (f"{demand.get('defect_category', 'Maintenance')} on "
            f"{where} ({demand.get('line')})")


def tick() -> list:
    """
    Advances every sanctioned demand against the simulated clock.

    Returns the list of events emitted this tick (empty when nothing moved).
    Safe to call from the generator thread; acquires demands_lock for the whole
    read-modify-write, then emits events (demands -> events lock order).
    """
    now = sim_now()
    transitions = []

    with sim_state.demands_lock:
        demands = sim_state.read_demands_unlocked()
        changed = False

        # 1. Advance started / finished blocks
        for d in demands:
            status = d.get("status")
            if status not in (STATUS_APPROVED, STATUS_IN_PROGRESS):
                continue

            start_dt = _parse(d.get("window_start_sim"))
            end_dt = _parse(d.get("window_end_sim"))
            if start_dt is None or end_dt is None:
                continue

            if now >= end_dt and status in (STATUS_APPROVED, STATUS_IN_PROGRESS):
                d["status"] = STATUS_COMPLETED
                d["completed_at"] = now.isoformat()
                changed = True
                transitions.append(("BLOCK_COMPLETED", d))
            elif now >= start_dt and status == STATUS_APPROVED:
                d["status"] = STATUS_IN_PROGRESS
                d["started_at"] = now.isoformat()
                changed = True
                transitions.append(("BLOCK_STARTED", d))

        # 2. Occasionally withdraw a block that has not started yet.
        #    Only blocks still comfortably ahead of their window are eligible,
        #    and the last remaining one is never taken - a demo where the single
        #    sanctioned block gets withdrawn before it can run shows nothing.
        upcoming = [
            d for d in demands
            if d.get("status") == STATUS_APPROVED
            and _parse(d.get("window_start_sim")) is not None
            and now < _parse(d["window_start_sim"])
        ]
        cancellable = [
            d for d in upcoming
            if (_parse(d["window_start_sim"]) - now).total_seconds() / 60.0 >= MIN_LEAD_SIM_MIN
        ]
        if (len(upcoming) >= MIN_UPCOMING_TO_CANCEL and cancellable
                and random.random() < CANCEL_PROBABILITY and _cancellation_allowed(now)):
            victim = random.choice(cancellable)
            victim["status"] = STATUS_CANCELLED
            victim["cancellation_reason"] = random.choice(CANCELLATION_REASONS)
            victim["cancelled_at"] = now.isoformat()
            changed = True
            transitions.append(("BLOCK_CANCELLED", victim))

        if changed:
            sim_state.write_demands_unlocked(demands)

    # 3. Emit notifications outside the demands lock section's mutation work
    emitted = []
    for kind, d in transitions:
        dept = d.get("department", "ALL")
        demand_id = d.get("demand_id", "")
        window = d.get("sanctioned_window", "")

        if kind == "BLOCK_STARTED":
            emitted.append(sim_state.emit_event(
                kind="BLOCK_STARTED", department=dept, severity="info",
                title=f"Block {demand_id} under execution",
                message=f"{_describe(d)} has commenced. Window {window}.",
                ref_id=demand_id))
        elif kind == "BLOCK_COMPLETED":
            emitted.append(sim_state.emit_event(
                kind="BLOCK_COMPLETED", department=dept, severity="success",
                title=f"Block {demand_id} completed",
                message=f"{_describe(d)} finished; track fit certificate issued.",
                ref_id=demand_id))
        elif kind == "BLOCK_CANCELLED":
            emitted.append(sim_state.emit_event(
                kind="BLOCK_CANCELLED", department=dept, severity="danger",
                title=f"Block {demand_id} WITHDRAWN",
                message=f"{_describe(d)} cancelled - {d.get('cancellation_reason', '')}",
                ref_id=demand_id))

    return emitted


def live_state(demand: dict, now: datetime = None) -> dict:
    """
    Derives display-time execution state for one demand: how far through its
    window it is, and how long until it starts. Pure - persists nothing.
    """
    if now is None:
        now = sim_now()

    start_dt = _parse(demand.get("window_start_sim"))
    end_dt = _parse(demand.get("window_end_sim"))
    status = demand.get("status", "PENDING_SANCTION")

    progress_pct = 0.0
    minutes_to_start = None

    if start_dt and end_dt:
        total = (end_dt - start_dt).total_seconds()
        if status == STATUS_COMPLETED:
            progress_pct = 100.0
        elif now >= start_dt and total > 0:
            progress_pct = max(0.0, min(100.0, (now - start_dt).total_seconds() / total * 100.0))
        else:
            minutes_to_start = round((start_dt - now).total_seconds() / 60.0, 1)

    return {
        "status": status,
        "progress_pct": round(progress_pct, 1),
        "sim_minutes_to_start": minutes_to_start,
        "window_start_sim": demand.get("window_start_sim"),
        "window_end_sim": demand.get("window_end_sim"),
        "window_day_label": demand.get("window_day_label"),
    }
