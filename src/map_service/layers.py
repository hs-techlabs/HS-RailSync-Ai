"""
Geo-resolved map layers.

Every layer is a pure read model: it reads live simulator state or the ML
backlog, resolves chainage to coordinates through `geometry`, and returns
features in one common shape. Nothing here mutates simulator state, so a map
refresh can never disturb the demo.

The common feature shape, which corridor_map.js renders generically:

    {
      "id":       stable identifier,
      "layer":    which layer produced it,
      "line":     "UP" | "DN" | "YARD",
      "km_start", "km_end",
      "lat", "lng", "bearing",     anchor point on the centreline
      "path":     [{lat,lng,bearing}, ...]   spans only
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "title", "subtitle",
      "detail":   { ... everything the hover card and the inspect form need }
    }

Layer -> screen mapping:

    issues    TMS 1.1, TDMS 2.1, SMMS 3.1   reported issues from the simulator
    blocks    TMS 1.2                        blocks currently on the corridor
    routines  TMS 1.3                        scheduled routine checks
    powercuts TDMS 2.3                       approved blocks carrying 25 kV isolation
    assets    TDMS 2.2                       assets high in wear needing attention
    health    SMMS 3.2                       per-section S&T system health
"""

import os
from datetime import timedelta

import pandas as pd

from src.map_service import geometry
from src.simulator import sim_state, block_lifecycle
from src.simulator.virtual_clock import sim_now

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
PREDICTIONS_CSV = os.path.join(ROOT_DIR, "data", "processed", "ml_predictions.csv")

SEVERITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}

# Routine inspection periodicity in days, keyed by department. Grounded in the
# IRPWM / ACTM / IRSEM schedules of dues the rest of the system already models:
# track geometry recording is monthly, OHE overhead inspection quarterly, and
# S&T point machine / track circuit testing runs on a shorter cycle.
ROUTINE_PERIODICITY_DAYS = {
    "ENGINEERING_TRACK": 90,
    "TRACTION_DISTRIBUTION_OHE": 120,
    "SIGNAL_AND_TELECOM": 60,
}

ROUTINE_LABEL = {
    "ENGINEERING_TRACK": "Track Geometry Recording & Through Packing",
    "TRACTION_DISTRIBUTION_OHE": "OHE Overhead Inspection & Tension Check",
    "SIGNAL_AND_TELECOM": "Point Machine & Track Circuit Periodic Testing",
}

_dataset_cache = None


def _dataset() -> pd.DataFrame:
    """Loads and caches the ML backlog that the wear, routine and health layers read."""
    global _dataset_cache
    if _dataset_cache is None:
        _dataset_cache = (
            pd.read_csv(PREDICTIONS_CSV) if os.path.exists(PREDICTIONS_CSV)
            else pd.DataFrame()
        )
    return _dataset_cache


def _dept_filter(records: list, department: str) -> list:
    dept = (department or "ALL").upper().strip()
    if dept == "ALL":
        return records
    return [r for r in records if r.get("department") == dept]


def _anchor(km_start, km_end, line):
    """
    Resolves a chainage range to its map anchor plus the span polyline.

    The anchor is the midpoint of the range, which is where the marker sits;
    the path is the full span, which is what gets stroked for blocks.
    """
    ks, ke = float(km_start or 0.0), float(km_end or 0.0)
    if ke <= ks:
        ke = ks + 1.0
    mid = geometry.position_at_km((ks + ke) / 2.0)
    return {
        "line": str(line or "DN").upper(),
        "km_start": round(ks, 2),
        "km_end": round(ke, 2),
        "lat": mid["lat"],
        "lng": mid["lng"],
        "bearing": mid["bearing"],
        "path": geometry.path_between_km(ks, ke),
    }


def _sort_features(features: list) -> list:
    return sorted(
        features,
        key=lambda f: (SEVERITY_ORDER.get(f.get("severity"), 9), f.get("km_start", 0.0))
    )


# ---------------------------------------------------------------------------
# issues - reported field issues awaiting officer review (TMS/TDMS/SMMS)
# ---------------------------------------------------------------------------

def issues_layer(department: str = "ALL") -> list:
    """
    Field reports the simulator has generated and that are still awaiting the
    department officer's decision.

    The whole worker-request record is carried through in `detail` - attachments
    included - because the popup's Inspect action prefills a block request from
    exactly these fields, and re-fetching per marker would be a round trip for
    data already in hand.
    """
    pending = [
        r for r in sim_state.read_worker_requests()
        if r.get("status") == "PENDING_REVIEW"
    ]

    features = []
    for r in _dept_filter(pending, department):
        anchor = _anchor(r.get("km_start"), r.get("km_end"), r.get("line"))
        section = r.get("section_label") or f"{r.get('section_from')} - {r.get('section_to')}"

        features.append({
            "id": r.get("request_id"),
            "layer": "issues",
            "severity": str(r.get("priority", "MEDIUM")).upper(),
            "title": r.get("defect_category"),
            "subtitle": f"{section} ({anchor['line']}) - KM {anchor['km_start']:.1f}",
            "department": r.get("department"),
            "department_label": r.get("department_label"),
            **anchor,
            "detail": r,
        })

    return _sort_features(features)


# ---------------------------------------------------------------------------
# blocks - what is actually on the corridor right now (TMS 1.2)
# ---------------------------------------------------------------------------

BLOCK_STATUSES = ("APPROVED_SHADOW_BLOCK", "IN_PROGRESS")


def blocks_layer(department: str = "ALL", include_completed: bool = False) -> list:
    """
    Sanctioned possessions on the corridor, with live execution state.

    Reads the same demand records and `block_lifecycle.live_state` the OCC
    execution board uses, so the map and the board can never disagree about
    whether a block is running.
    """
    now = sim_now()
    wanted = set(BLOCK_STATUSES)
    if include_completed:
        wanted |= {"COMPLETED"}

    demands = [d for d in sim_state.read_demands() if d.get("status") in wanted]

    features = []
    for d in _dept_filter(demands, department):
        anchor = _anchor(d.get("km_start"), d.get("km_end"), d.get("line"))
        live = block_lifecycle.live_state(d, now)
        section = f"{d.get('section_from')} - {d.get('section_to')}"
        running = d.get("status") == "IN_PROGRESS"

        features.append({
            "id": d.get("demand_id"),
            "layer": "blocks",
            "severity": "CRITICAL" if running else str(d.get("priority", "MEDIUM")).upper(),
            "title": f"{'Block under execution' if running else 'Approved block'}: {d.get('demand_id')}",
            "subtitle": f"{section} ({anchor['line']}) - {d.get('sanctioned_window') or 'window pending'}",
            "department": d.get("department"),
            "department_label": d.get("department_label"),
            "status": d.get("status"),
            "progress_pct": live.get("progress_pct", 0.0),
            **anchor,
            "detail": {**d, **live, "section": section},
        })

    return _sort_features(features)


def powercuts_layer(department: str = "ALL") -> list:
    """
    TDMS 2.3 - approved blocks that carry a 25 kV traction isolation.

    A power cut is not a separate record in this system: it is a property of a
    sanctioned block, so this is the blocks layer filtered on the flag the
    demand pipeline already sets (and auto-enforces for every TDMS demand).
    """
    features = [
        f for f in blocks_layer(department)
        if f["detail"].get("power_block_required")
    ]
    for f in features:
        f["layer"] = "powercuts"
        f["title"] = f"25 kV Isolation: {f['id']}"
    return features


# ---------------------------------------------------------------------------
# routines - scheduled routine checks (TMS 1.3)
# ---------------------------------------------------------------------------

def routines_layer(department: str = "ALL", horizon_days: int = 21, limit: int = 40) -> list:
    """
    Upcoming routine inspections, synthesised from the maintenance history the
    backlog already carries.

    Due date = last maintenance + the department's schedule-of-dues periodicity.
    Nothing invented: `days_since_last_maintenance` is a real column on every
    asset row, so the resulting calendar is consistent with the same data the
    risk model and the scheduler consume. Assets already overdue are surfaced
    first - an overdue statutory inspection is exactly what a Sr.DEN wants to
    see on a corridor map.
    """
    df = _dataset()
    if df.empty:
        return []

    dept = (department or "ALL").upper().strip()
    if dept != "ALL":
        df = df[df["department"] == dept]
    if df.empty:
        return []

    now = sim_now()
    features = []

    for _, row in df.iterrows():
        rdept = str(row.get("department"))
        periodicity = ROUTINE_PERIODICITY_DAYS.get(rdept, 90)
        since = float(row.get("days_since_last_maintenance") or 0.0)
        due_in = periodicity - since

        if due_in > horizon_days:
            continue

        overdue = due_in < 0
        if overdue:
            severity = "HIGH"
        elif due_in <= 7:
            severity = "MEDIUM"
        else:
            severity = "LOW"

        anchor = _anchor(row.get("km_start"), row.get("km_end"), row.get("line"))
        due_date = now + timedelta(days=due_in)
        near = geometry.nearest_station(anchor["km_start"])
        section = f"{row.get('section_from')} - {row.get('section_to')}"

        features.append({
            "id": f"RTN-{row.get('asset_id')}",
            "layer": "routines",
            "severity": severity,
            "title": ROUTINE_LABEL.get(rdept, "Routine Inspection"),
            "subtitle": (f"{'OVERDUE by' if overdue else 'Due in'} "
                         f"{abs(round(due_in))} days - KM {anchor['km_start']:.1f}"),
            "department": rdept,
            "department_label": sim_state.DEPT_LABEL.get(rdept, rdept),
            **anchor,
            "detail": {
                "asset_id": row.get("asset_id"),
                "department": rdept,
                "section": section,
                "line": anchor["line"],
                "km_start": anchor["km_start"],
                "routine_type": ROUTINE_LABEL.get(rdept, "Routine Inspection"),
                "periodicity_days": periodicity,
                "days_since_last_maintenance": round(since),
                "due_in_days": round(due_in),
                "is_overdue": overdue,
                "due_date": due_date.strftime("%d %b %Y"),
                "nearest_station": f"{near['name']} ({near['code']})",
                "machine_required": row.get("machine_required"),
                "estimated_duration_min": int(row.get("predicted_duration_min") or 120),
                "health_index": round(float(row.get("health_index") or 0.0), 1),
                "priority_tier": row.get("priority_tier"),
            },
        })

    features = sorted(features, key=lambda f: f["detail"]["due_in_days"])
    return features[:limit]


# ---------------------------------------------------------------------------
# assets - wear and tear needing attention (TDMS 2.2)
# ---------------------------------------------------------------------------

def _wear_window(rul_days: float) -> str:
    if rul_days <= 30:
        return "NOW"
    if rul_days <= 90:
        return "NEAR_TERM"
    return "PLANNED"


def assets_layer(department: str = "ALL", limit: int = 60) -> list:
    """
    Assets high in wear that need attention now or in the near term.

    Ranked by the composite criticality score the ML pipeline already produces,
    and captioned with each department's own wear diagnostic - contact wire wear
    percentage for OHE, TGI/USFD for track, health index for S&T - so the card
    reads in the language of the department looking at it.
    """
    df = _dataset()
    if df.empty:
        return []

    dept = (department or "ALL").upper().strip()
    if dept != "ALL":
        df = df[df["department"] == dept]
    if df.empty:
        return []

    df = df[df["priority_tier"].isin(["CRITICAL", "HIGH"])]
    if df.empty:
        return []

    df = df.sort_values("composite_criticality_score", ascending=False).head(limit)

    features = []
    for _, row in df.iterrows():
        rdept = str(row.get("department"))
        anchor = _anchor(row.get("km_start"), row.get("km_end"), row.get("line"))
        rul = float(row.get("predicted_rul_days") or 999)
        window = _wear_window(rul)
        near = geometry.nearest_station(anchor["km_start"])

        if rdept == "TRACTION_DISTRIBUTION_OHE":
            wear_metric = f"Contact wire wear {float(row.get('wire_wear_percentage') or 0):.1f}%"
            wear_state = str(row.get("wire_status") or "-")
        elif rdept == "ENGINEERING_TRACK":
            wear_metric = f"TGI {float(row.get('tgi_composite') or 0):.1f}"
            wear_state = f"{row.get('tgi_category')} / USFD {row.get('usfd_status')}"
        else:
            wear_metric = f"Health index {float(row.get('health_index') or 0):.1f}"
            wear_state = str(row.get("asset_type") or "-")

        features.append({
            "id": f"AST-{row.get('asset_id')}",
            "layer": "assets",
            "severity": str(row.get("priority_tier", "HIGH")).upper(),
            "title": f"{wear_state} - {wear_metric}",
            "subtitle": (f"RUL {int(rul)} days - attention "
                         f"{'required now' if window == 'NOW' else 'in near term'}"),
            "department": rdept,
            "department_label": sim_state.DEPT_LABEL.get(rdept, rdept),
            "attention_window": window,
            **anchor,
            "detail": {
                "asset_id": row.get("asset_id"),
                "department": rdept,
                "section": f"{row.get('section_from')} - {row.get('section_to')}",
                "line": anchor["line"],
                "km_start": anchor["km_start"],
                "km_end": anchor["km_end"],
                "wear_metric": wear_metric,
                "wear_state": wear_state,
                "attention_window": window,
                "predicted_rul_days": int(rul),
                "failure_percentage": round(float(row.get("failure_percentage") or 0.0), 1),
                "health_index": round(float(row.get("health_index") or 0.0), 1),
                "criticality_score": round(float(row.get("composite_criticality_score") or 0.0), 1),
                "priority_tier": row.get("priority_tier"),
                "machine_required": row.get("machine_required"),
                "power_block_required": bool(row.get("power_block_required")),
                "disconnection_required": bool(row.get("disconnection_required")),
                "estimated_duration_min": int(row.get("predicted_duration_min") or 120),
                "nearest_station": f"{near['name']} ({near['code']})",
                "description": row.get("description"),
            },
        })

    return _sort_features(features)


# ---------------------------------------------------------------------------
# health - S&T system health per section (SMMS 3.2)
# ---------------------------------------------------------------------------

SYSTEM_LABELS = {
    "POINT_MACHINE": "Point Machines",
    "TRACK_CIRCUIT": "Track Circuits",
    "AXLE_COUNTER": "Axle Counters",
    "EI_SYSTEM": "Electronic Interlocking",
}


def _health_grade(score: float) -> str:
    """Health index -> the severity vocabulary the rest of the map speaks."""
    if score < 45:
        return "CRITICAL"
    if score < 60:
        return "HIGH"
    if score < 75:
        return "MEDIUM"
    return "LOW"


def health_layer(department: str = "SIGNAL_AND_TELECOM") -> list:
    """
    Track health rolled up per section and broken down by system.

    One feature per corridor section, spanning the whole section so it reads as
    a coloured stretch of line rather than a pin - health is a property of a
    length of track, not a point. The per-system breakdown inside `detail` is
    what the hover card tabulates.
    """
    df = _dataset()
    if df.empty:
        return []

    dept = (department or "SIGNAL_AND_TELECOM").upper().strip()
    if dept != "ALL":
        df = df[df["department"] == dept]
    if df.empty:
        return []

    features = []
    for sec in geometry.sections():
        in_sec = df[
            (df["km_start"] >= sec["km_start"]) & (df["km_start"] < sec["km_end"])
        ]
        if in_sec.empty:
            continue

        overall = float(in_sec["health_index"].mean())

        systems = []
        for asset_type, grp in in_sec.groupby("asset_type"):
            score = float(grp["health_index"].mean())
            systems.append({
                "system": SYSTEM_LABELS.get(str(asset_type), str(asset_type)),
                "asset_type": str(asset_type),
                "health_index": round(score, 1),
                "grade": _health_grade(score),
                "asset_count": int(len(grp)),
                "at_risk_count": int((grp["priority_tier"].isin(["CRITICAL", "HIGH"])).sum()),
            })
        systems.sort(key=lambda s: s["health_index"])

        anchor = _anchor(sec["km_start"], sec["km_end"], "DN")
        at_risk = int((in_sec["priority_tier"].isin(["CRITICAL", "HIGH"])).sum())

        features.append({
            "id": f"HLT-{sec['from']}-{sec['to']}",
            "layer": "health",
            "severity": _health_grade(overall),
            "title": f"{sec['section']} - system health {overall:.1f}",
            "subtitle": f"{len(in_sec)} assets - {at_risk} at risk over {sec['length_km']:.0f} KM",
            "department": dept,
            "department_label": sim_state.DEPT_LABEL.get(dept, dept),
            "health_index": round(overall, 1),
            **anchor,
            "detail": {
                "section": sec["section"],
                "from": sec["from"],
                "to": sec["to"],
                "length_km": sec["length_km"],
                "health_index": round(overall, 1),
                "grade": _health_grade(overall),
                "asset_count": int(len(in_sec)),
                "at_risk_count": at_risk,
                "weakest_system": systems[0]["system"] if systems else None,
                "systems": systems,
            },
        })

    return features


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

LAYER_BUILDERS = {
    "issues": lambda dept: issues_layer(dept),
    "blocks": lambda dept: blocks_layer(dept),
    "powercuts": lambda dept: powercuts_layer(dept),
    "routines": lambda dept: routines_layer(dept),
    "assets": lambda dept: assets_layer(dept),
    "health": lambda dept: health_layer(dept),
}

# What each screen asks for by default, straight from the requirements.
PORTAL_LAYER_PRESETS = {
    "ENGINEERING_TRACK": ["issues", "blocks", "routines"],
    "TRACTION_DISTRIBUTION_OHE": ["issues", "assets", "powercuts"],
    "SIGNAL_AND_TELECOM": ["issues", "health"],
    "ALL": ["issues", "blocks", "routines", "assets", "health"],
}


def build_layers(department: str = "ALL", names: list = None) -> dict:
    """
    Builds the requested layers for one department in a single pass.

    A layer that raises is reported as an empty list with an `errors` entry
    rather than failing the whole response: one bad layer should never blank
    the map on a live demo.
    """
    dept = (department or "ALL").upper().strip()
    wanted = names or PORTAL_LAYER_PRESETS.get(dept, PORTAL_LAYER_PRESETS["ALL"])

    out, errors = {}, {}
    for name in wanted:
        builder = LAYER_BUILDERS.get(name)
        if builder is None:
            errors[name] = "unknown layer"
            continue
        try:
            out[name] = builder(dept)
        except Exception as exc:  # pragma: no cover - defensive on a live demo
            out[name] = []
            errors[name] = str(exc)

    result = {
        "department": dept,
        "sim_time": sim_now().isoformat(),
        "layers": out,
        "counts": {k: len(v) for k, v in out.items()},
    }
    if errors:
        result["errors"] = errors
    return result
