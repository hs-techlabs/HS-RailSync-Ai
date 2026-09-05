"""
Live train positions on the corridor.

Derives where each of the 29 timetabled trains is *right now* by interpolating
between its bracketing timetable stops against the accelerated simulated clock.
Nothing is persisted and no state is held: position is a pure function of
`sim_now()`, exactly like `virtual_clock` itself, so this survives restarts and
can be polled at any rate without drift.

The timetable already stores `departure_min_of_day` / `arrival_min_of_day` per
stop and orders each train's rows in travel order (DN ascending in chainage, UP
descending), so a train's path is just a walk down its own rows.

A train only exists on the map between its first departure and its final
arrival. Outside that window it is simply not running - which is honest, and is
why the corridor thins out overnight rather than showing 29 phantom trains.
"""

import os

import pandas as pd

from src.map_service import geometry
from src.simulator.virtual_clock import sim_now

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
TIMETABLE_CSV = os.path.join(ROOT_DIR, "data", "raw", "ndls_cnb_real_timetable.csv")

# Train categories, mapped to the colour vocabulary the corridor map already uses.
TRAIN_CLASS_STYLE = {
    "VANDE_BHARAT": {"label": "Vande Bharat", "cls": "premium"},
    "RAJDHANI": {"label": "Rajdhani", "cls": "premium"},
    "SHATABDI": {"label": "Shatabdi", "cls": "premium"},
    "SUPERFAST": {"label": "Superfast", "cls": "express"},
    "EXPRESS": {"label": "Express", "cls": "express"},
    "PASSENGER": {"label": "Passenger", "cls": "passenger"},
    "FREIGHT": {"label": "Freight", "cls": "freight"},
}

_schedule_cache = None


def _schedule() -> dict:
    """
    Caches the timetable as {train_number: (meta, [stops...])}, stops in travel
    order. Parsed once - the file never changes at runtime.
    """
    global _schedule_cache
    if _schedule_cache is not None:
        return _schedule_cache

    if not os.path.exists(TIMETABLE_CSV):
        _schedule_cache = {}
        return _schedule_cache

    df = pd.read_csv(TIMETABLE_CSV)
    out = {}

    for train_no, grp in df.groupby("train_number", sort=False):
        first = grp.iloc[0]
        stops = [
            {
                "station": str(r["station"]),
                "km": float(r["km_location"]),
                "arr": float(r["arrival_min_of_day"]),
                "dep": float(r["departure_min_of_day"]),
                "is_halt": bool(r["is_halt"]),
            }
            for _, r in grp.iterrows()
        ]
        out[str(train_no)] = (
            {
                "train_number": str(train_no),
                "train_name": str(first["train_name"]),
                "train_type": str(first["train_type"]),
                "direction": str(first["direction"]).upper(),
                "priority_class": int(first["priority_class"]),
            },
            stops,
        )

    _schedule_cache = out
    return _schedule_cache


def _locate(stops: list, now_min: float):
    """
    Places a train against its own stop list at `now_min` (minutes of day).

    Returns (km, state, from_stop, to_stop, segment_speed_kmph), or None when the
    train is not on the corridor at this moment.
    """
    if not stops:
        return None

    # Before it starts, or after it terminates: not running.
    if now_min < stops[0]["dep"] or now_min > stops[-1]["arr"]:
        return None

    for i, stop in enumerate(stops):
        # Standing at a station, between arrival and departure.
        if stop["arr"] <= now_min <= stop["dep"]:
            return stop["km"], "HALTED", stop, stop, 0.0

        if i + 1 >= len(stops):
            break

        nxt = stops[i + 1]
        if stop["dep"] < now_min < nxt["arr"]:
            run_min = nxt["arr"] - stop["dep"]
            t = 0.0 if run_min <= 0 else (now_min - stop["dep"]) / run_min
            km = stop["km"] + (nxt["km"] - stop["km"]) * t
            dist = abs(nxt["km"] - stop["km"])
            speed = (dist / run_min * 60.0) if run_min > 0 else 0.0
            return km, "RUNNING", stop, nxt, speed

    return None


def live_trains() -> list:
    """
    Every train currently on the corridor, resolved to map coordinates.

    Chainage is turned into a position through the same `geometry.position_at_km`
    every other layer uses, and each train carries its `line` (UP/DN) so the
    client offsets it onto the correct rail of the pair.
    """
    now = sim_now()
    now_min = now.hour * 60 + now.minute + now.second / 60.0

    out = []
    for train_no, (meta, stops) in _schedule().items():
        located = _locate(stops, now_min)
        if located is None:
            continue

        km, state, frm, to, speed = located
        pos = geometry.position_at_km(km)
        line = meta["direction"]

        # UP trains travel against the stored chainage direction, so the heading
        # the client should rotate the icon to is the reverse bearing.
        heading = pos["bearing"] if line == "DN" else (pos["bearing"] + 180.0) % 360.0
        style = TRAIN_CLASS_STYLE.get(meta["train_type"], {"label": meta["train_type"], "cls": "express"})

        out.append({
            "id": f"TRN-{train_no}",
            "layer": "trains",
            "train_number": meta["train_number"],
            "train_name": meta["train_name"],
            "train_type": meta["train_type"],
            "class_label": style["label"],
            "class_cls": style["cls"],
            "priority_class": meta["priority_class"],
            "line": line,
            "km": round(km, 2),
            "km_start": round(km, 2),
            "km_end": round(km, 2),
            "lat": pos["lat"],
            "lng": pos["lng"],
            "bearing": pos["bearing"],
            "heading": round(heading, 1),
            "state": state,
            "speed_kmph": round(speed, 1),
            "from_station": frm["station"],
            "next_station": to["station"],
            "severity": "LOW",
            "title": f"{meta['train_number']} {meta['train_name']}",
            "subtitle": (f"Halted at {frm['station']}" if state == "HALTED"
                         else f"{frm['station']} -> {to['station']} at {speed:.0f} km/h"),
            "detail": {
                "train_number": meta["train_number"],
                "train_name": meta["train_name"],
                "class_label": style["label"],
                "line": line,
                "state": state,
                "km": round(km, 2),
                "speed_kmph": round(speed, 1),
                "from_station": frm["station"],
                "next_station": to["station"],
                "priority_class": meta["priority_class"],
            },
        })

    out.sort(key=lambda t: t["km"])
    return out
