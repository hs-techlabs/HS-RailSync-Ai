"""
Field Worker Fault Report Generator (the live demo simulator).

Runs as a daemon thread and manufactures worker-submitted field reports on its
own, so the corridor keeps producing new maintenance evidence for as long as the
server is up. This is what turns a static dataset into a live workflow: reports
arrive -> the department officer (TMS/TDMS/SMMS) reviews the photo/PDF evidence
and approves or rejects -> approved reports become OCC demands.

Grounded, not invented: every generated report is built from a real row of
`data/processed/ml_predictions.csv` - the same 1,850-asset file the ML risk
engine and the OR-Tools scheduler already consume. Priority tier, criticality,
machine, power/disconnection flags and location are carried forward rather than
randomised, so a generated fault is indistinguishable from a real backlog item.
"""

import os
import re
import random
import threading
import time
import uuid

import pandas as pd

from src.simulator import sim_state, block_lifecycle
from src.simulator.virtual_clock import sim_now, sim_now_iso

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
PREDICTIONS_CSV = os.path.join(ROOT_DIR, "data", "processed", "ml_predictions.csv")

# Pacing. At 80x, 25-40 sim-minutes is 19-30 real seconds, which is why the loop
# sleeps 20-40 real seconds - the two ranges are chosen to line up.
TARGET_GAP_SIM_MIN_RANGE = (25, 40)
TICK_SLEEP_REAL_SEC_RANGE = (20, 40)

# Spatial de-clustering. Applied PER DEPARTMENT only: two track faults should not
# pile up on the same kilometre, but a track fault and an OHE fault sitting close
# together is exactly the co-located scenario the shadow-block bundler exists to
# solve, so cross-department proximity is deliberately left alone.
MIN_SEP_KM = 8.0
MAX_CANDIDATE_TRIES = 25

DEPARTMENTS = {
    "ENGINEERING_TRACK": {
        "label": "Track", "prefix": "TRK", "dir": "track",
        "photos": ["site_photo_1.png", "site_photo_2.png"],
        "pdf": "inspection_report.pdf",
        "gangs": ["Track Patrol Gang A", "Track Patrol Gang B",
                  "Track Patrol Gang C", "PWI Field Inspector"],
    },
    "TRACTION_DISTRIBUTION_OHE": {
        "label": "OHE", "prefix": "OHE", "dir": "ohe",
        "photos": ["site_photo_1.png", "site_photo_2.png"],
        "pdf": "inspection_report.pdf",
        "gangs": ["TRD Linemen Gang A", "TRD Linemen Gang B", "OHE Patrol Inspector"],
    },
    "SIGNAL_AND_TELECOM": {
        "label": "Signal", "prefix": "SIG", "dir": "signal",
        "photos": ["site_photo_1.png", "site_photo_2.png"],
        "pdf": "inspection_report.pdf",
        "gangs": ["Signal Maintainer Gang A", "Signal Maintainer Gang B",
                  "S&T Field Technician"],
    },
}

_started = False
_dataset = None
_schedulable_combos = None


# ---------------------------------------------------------------------------
# Candidate pool
# ---------------------------------------------------------------------------

def _load_schedulable_combos() -> set:
    """
    The (section_from, line) pairs the corridor timetable can actually host a
    block on.

    Not every asset is schedulable: 161 signal assets sit on `line="YARD"`,
    ALJN-TDL never opens a 45-minute gap, and CNB is the terminal station so no
    section starts there. Generating a report against those would produce a
    demand the CP-SAT solver can never place. Restricting the pool up front means
    every report an officer approves can reach a genuine sanctioned window.
    """
    global _schedulable_combos
    if _schedulable_combos is None:
        from src.optimizer.slot_finder import find_available_corridor_slots
        slots = find_available_corridor_slots()
        _schedulable_combos = {(s["section_from"], s["line"]) for s in slots}
    return _schedulable_combos


def _load_dataset() -> pd.DataFrame:
    """Loads and caches the asset backlog, filtered to schedulable locations."""
    global _dataset
    if _dataset is None:
        if not os.path.exists(PREDICTIONS_CSV):
            _dataset = pd.DataFrame()
            return _dataset

        df = pd.read_csv(PREDICTIONS_CSV)
        combos = _load_schedulable_combos()
        mask = df.apply(
            lambda r: (str(r.get("section_from")), str(r.get("line")).upper()) in combos,
            axis=1
        )
        _dataset = df[mask].reset_index(drop=True)
    return _dataset


def _open_asset_ids(dept: str, worker_requests: list, demands: list) -> set:
    """Assets already awaiting review or sanction, so we never duplicate one."""
    open_ids = {
        wr.get("asset_id") for wr in worker_requests
        if wr.get("department") == dept and wr.get("status") == "PENDING_REVIEW"
    }
    open_ids |= {
        d.get("asset_id") for d in demands
        if d.get("department") == dept
        and d.get("status") in ("PENDING_SANCTION", "APPROVED_SHADOW_BLOCK", "IN_PROGRESS")
    }
    return {i for i in open_ids if i}


def _open_locations(dept: str, worker_requests: list, demands: list) -> list:
    locs = [
        (float(wr.get("km_start", 0.0)), str(wr.get("line", "")).upper())
        for wr in worker_requests
        if wr.get("department") == dept and wr.get("status") == "PENDING_REVIEW"
    ]
    locs += [
        (float(d.get("km_start", 0.0)), str(d.get("line", "")).upper())
        for d in demands
        if d.get("department") == dept
        and d.get("status") in ("PENDING_SANCTION", "APPROVED_SHADOW_BLOCK", "IN_PROGRESS")
    ]
    return locs


def _pick_candidate(dept_df: pd.DataFrame, dept: str, worker_requests: list, demands: list):
    """
    Uniform sample over real asset rows, with exclusion and spatial spacing.

    Uniform rather than criticality-weighted on purpose: the dataset already
    skews hard toward CRITICAL and LOW, so weighting by criticality would make
    almost every generated report CRITICAL and flatten the priority mix. Sampling
    uniformly over real rows preserves the dataset's natural spread for free.
    """
    open_ids = _open_asset_ids(dept, worker_requests, demands)
    open_locs = _open_locations(dept, worker_requests, demands)

    pool = dept_df[~dept_df["asset_id"].isin(open_ids)]
    if pool.empty:
        return None

    candidates = pool.sample(n=min(MAX_CANDIDATE_TRIES, len(pool)))

    fallback = None
    for _, row in candidates.iterrows():
        if fallback is None:
            fallback = row
        km = float(row["km_start"])
        line = str(row["line"]).upper()
        well_spaced = all(
            abs(km - loc_km) >= MIN_SEP_KM
            for loc_km, loc_line in open_locs if loc_line == line
        )
        if well_spaced:
            return row

    # Spacing is a nice-to-have, never a blocker: a demo that occasionally places
    # two faults close together beats one that silently stops generating.
    return fallback


# ---------------------------------------------------------------------------
# Report construction
# ---------------------------------------------------------------------------

def _derive_defect_category(row, dept: str) -> str:
    """Maps each department's own diagnostic columns to a human-readable label."""
    if dept == "ENGINEERING_TRACK":
        if str(row.get("usfd_status")) == "IMR":
            return "Rail Flaw (USFD Immediate)"
        if str(row.get("usfd_status")) == "OBS":
            return "Rail Flaw (USFD Under Observation)"
        if str(row.get("tgi_category")) == "POOR":
            return "Track Geometry Deviation (TGI)"
        machine = str(row.get("machine_required", ""))
        if machine == "BCM":
            return "Ballast Deficiency / Deep Screening"
        if str(row.get("tgi_category")) == "AVERAGE":
            return "Track Geometry Attention (TGI)"
        # Asset is within limits - a routine patrol finding, not a defect. Saying
        # so keeps the category honest against the description text.
        return "Routine Track Patrol Observation"

    if dept == "TRACTION_DISTRIBUTION_OHE":
        wire = str(row.get("wire_status"))
        if wire == "CONDEMN_RENEW":
            return "Contact Wire Condemning Wear"
        if wire in ("CRITICAL", "WORN"):
            return "Contact Wire Wear"
        if str(row.get("atd_status")) == "AT_LIMIT":
            return "ATD Counterweight Deviation"
        return "OHE Tension & Insulator Inspection"

    asset_type = str(row.get("asset_type"))
    return {
        "POINT_MACHINE": "Point Machine Sluggish",
        "TRACK_CIRCUIT": "Track Circuit Fault",
        "AXLE_COUNTER": "Axle Counter Reset Failure",
        "EI_SYSTEM": "Electronic Interlocking Alarm",
    }.get(asset_type, "S&T Asset Defect")


def _normalise_description(row, priority: str) -> str:
    """
    Resyncs the tier embedded in the dataset's pre-baked description text.

    The description was written at data-generation time; `priority_tier` was
    recomputed later by ML inference, so 260 of 450 signal rows carry a stale
    "Tier: LOW" while the model now says HIGH. Left alone, the review card would
    visibly contradict its own severity badge.
    """
    description = str(row.get("description", "")).strip()
    if not description:
        return ""
    return re.sub(r"Tier:\s*\w+", f"Tier: {priority}", description)


def _pick_attachments(cfg: dict) -> list:
    n = random.choice([1, 2])
    chosen_photos = random.sample(cfg["photos"], min(n, len(cfg["photos"])))
    atts = [
        {"type": "image", "filename": f, "url": f"/attachments/{cfg['dir']}/{f}"}
        for f in chosen_photos
    ]
    atts.append({
        "type": "pdf", "filename": cfg["pdf"],
        "url": f"/attachments/{cfg['dir']}/{cfg['pdf']}"
    })
    return atts


def build_worker_request(row, dept: str) -> dict:
    cfg = DEPARTMENTS[dept]
    priority = str(row.get("priority_tier", "MEDIUM"))
    defect_category = _derive_defect_category(row, dept)
    submitted_by = random.choice(cfg["gangs"])

    km_start = float(row.get("km_start", 0.0))
    km_end = float(row.get("km_end", km_start + 1.0))

    section_from = str(row.get("section_from", "")).upper()
    section_to = str(row.get("section_to", "")).upper()

    return {
        "request_id": f"WREQ-{cfg['prefix']}-{uuid.uuid4().hex[:8].upper()}",
        "department": dept,
        "department_label": sim_state.DEPT_LABEL.get(dept, dept),
        "asset_id": str(row.get("asset_id", "")),
        "defect_category": defect_category,
        "section_from": section_from,
        "section_to": section_to,
        # Display-only. S&T assets are station-based, so their section reads
        # "ETW - ETW" in the raw data; show that as a yard instead.
        "section_label": (f"{section_from} Station Yard" if section_from == section_to
                          else f"{section_from} - {section_to}"),
        "line": str(row.get("line", "DN")).upper(),
        "km_start": km_start,
        "km_end": km_end if km_end > km_start else km_start + 1.0,
        "machine_required": str(row.get("machine_required", "NONE")),
        "power_block_required": bool(row.get("power_block_required", False)),
        "disconnection_required": bool(row.get("disconnection_required", False)),
        "gang_crew": submitted_by,
        "duration_requested_min": int(row.get("predicted_duration_min", 120)),
        "priority": priority,
        "description": _normalise_description(row, priority)
                       or f"{defect_category} reported at KM {km_start:.1f}",
        "failure_percentage": float(row.get("failure_percentage", 50.0)),
        "attachments": _pick_attachments(cfg),
        "submitted_by": submitted_by,
        "submitted_at": sim_now_iso(),
        "status": "PENDING_REVIEW",
        "review_note": None,
        "reviewed_at": None,
        "reviewed_by": None,
    }


# ---------------------------------------------------------------------------
# Pacing
# ---------------------------------------------------------------------------

def _should_emit(dept: str, worker_requests: list) -> bool:
    """
    A department is due once enough simulated time has passed since its own most
    recent report. Derived by scanning existing records rather than holding
    separate scheduler state, so a restart resumes correctly.
    """
    dept_requests = [
        wr for wr in worker_requests
        if wr.get("department") == dept and wr.get("submitted_at")
    ]
    if not dept_requests:
        return True  # cold start: emit immediately so queues are never empty

    latest = max(dept_requests, key=lambda wr: wr["submitted_at"])
    last_dt = block_lifecycle._parse(latest["submitted_at"])
    if last_dt is None:
        return True

    elapsed_sim_min = block_lifecycle._sim_minutes_since(last_dt, sim_now())
    return elapsed_sim_min >= random.uniform(*TARGET_GAP_SIM_MIN_RANGE)


# ---------------------------------------------------------------------------
# Daemon
# ---------------------------------------------------------------------------

def tick_reports() -> list:
    """Generates at most one new field report per department. Returns new ones."""
    df = _load_dataset()
    if df.empty:
        return []

    created = []
    # Lock order: worker_requests -> demands (see sim_state module docstring).
    with sim_state.worker_requests_lock, sim_state.demands_lock:
        worker_requests = sim_state.read_worker_requests_unlocked()
        demands = sim_state.read_demands_unlocked()

        for dept in DEPARTMENTS:
            if not _should_emit(dept, worker_requests):
                continue

            dept_df = df[df["department"] == dept]
            if dept_df.empty:
                continue

            row = _pick_candidate(dept_df, dept, worker_requests, demands)
            if row is None:
                continue

            request = build_worker_request(row, dept)
            worker_requests.append(request)
            created.append(request)

        if created:
            sim_state.write_worker_requests_unlocked(worker_requests)

    for req in created:
        sim_state.emit_event(
            kind="REPORT_SUBMITTED",
            department=req["department"],
            severity="warning" if req["priority"] in ("CRITICAL", "HIGH") else "info",
            title=f"New field report {req['request_id']}",
            message=(f"{req['submitted_by']} reported {req['defect_category']} at "
                     f"KM {req['km_start']:.1f} ({req['section_from']} - "
                     f"{req['section_to']}, {req['line']}). Awaiting review."),
            ref_id=req["request_id"],
        )

    return created


def _tick():
    """One full simulator beat: new reports, then advance sanctioned blocks."""
    tick_reports()
    block_lifecycle.tick()


def _run_loop():
    while True:
        try:
            _tick()
        except Exception as exc:  # a demo must never die on one bad tick
            print(f"[fault_generator] tick error: {exc}")
        time.sleep(random.uniform(*TICK_SLEEP_REAL_SEC_RANGE))


def start():
    """
    Starts the simulator daemon exactly once.

    Guarded by a module-level flag so re-importing (or a test importing the API
    module) never spawns a second generator.
    """
    global _started
    if _started:
        return
    _started = True
    thread = threading.Thread(target=_run_loop, name="fault-generator", daemon=True)
    thread.start()
    print("[fault_generator] Live field-report simulator started.")


if __name__ == "__main__":
    created = tick_reports()
    print(f"Generated {len(created)} field reports:")
    for r in created:
        print(f"  {r['request_id']}  {r['priority']:8s}  {r['defect_category']}  "
              f"KM {r['km_start']:.1f}  ({r['section_from']}-{r['section_to']} {r['line']})")
