"""
Shared simulator state: locks, JSON persistence primitives, and the event log.

Lives in its own module so the fault generator, the block lifecycle engine and
the FastAPI layer all share one lock set without importing each other.

Concurrency rules (these are what keep the daemon thread and the request
handlers from corrupting each other):

1. Every multi-step read-modify-write holds its lock for the WHOLE operation.
   Never read, release, then write - the background thread can append between.
   That is what the `*_unlocked()` primitives are for: a caller holds one `with`
   block across the entire sequence.
2. When more than one lock is needed the order is ALWAYS
   worker_requests_lock -> demands_lock -> events_lock.
   Same order everywhere means no lock-ordering deadlock is possible.
"""

import os
import json
import threading
import uuid

from src.simulator.virtual_clock import sim_now_iso

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
PROCESSED_DIR = os.path.join(ROOT_DIR, "data", "processed")

WORKER_REQUESTS_FILE = os.path.join(PROCESSED_DIR, "worker_requests.json")
DEMANDS_FILE = os.path.join(PROCESSED_DIR, "pending_demands.json")
EVENTS_FILE = os.path.join(PROCESSED_DIR, "sim_events.json")

MAX_EVENTS_RETAINED = 200

# Department identity, shared by the generator, the lifecycle engine and the API
# so demand IDs, labels and event routing never drift apart.
DEPT_PREFIX = {
    "ENGINEERING_TRACK": "TMS",
    "TRACTION_DISTRIBUTION_OHE": "TDMS",
    "SIGNAL_AND_TELECOM": "SMMS",
}
DEPT_LABEL = {
    "ENGINEERING_TRACK": "Civil / Track (TMS)",
    "TRACTION_DISTRIBUTION_OHE": "Electrical / OHE (TDMS)",
    "SIGNAL_AND_TELECOM": "Signalling & Telecom (SMMS)",
}

# Acquisition order: worker_requests -> demands -> events
worker_requests_lock = threading.Lock()
demands_lock = threading.Lock()
events_lock = threading.Lock()


def _read_json_list(path: str, key: str) -> list:
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f).get(key, [])
    except Exception:
        return []


def _write_json_list(path: str, key: str, items: list):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump({key: items}, f, indent=2)


# ---------------------------------------------------------------------------
# Worker field reports
# ---------------------------------------------------------------------------

def read_worker_requests_unlocked() -> list:
    return _read_json_list(WORKER_REQUESTS_FILE, "requests")


def write_worker_requests_unlocked(requests: list):
    _write_json_list(WORKER_REQUESTS_FILE, "requests", requests)


def read_worker_requests() -> list:
    with worker_requests_lock:
        return read_worker_requests_unlocked()


def write_worker_requests(requests: list):
    with worker_requests_lock:
        write_worker_requests_unlocked(requests)


# ---------------------------------------------------------------------------
# Pending demands (the OCC queue - same file/shape the app already used)
# ---------------------------------------------------------------------------

def read_demands_unlocked() -> list:
    return _read_json_list(DEMANDS_FILE, "demands")


def write_demands_unlocked(demands: list):
    _write_json_list(DEMANDS_FILE, "demands", demands)


def read_demands() -> list:
    with demands_lock:
        return read_demands_unlocked()


def write_demands(demands: list):
    with demands_lock:
        write_demands_unlocked(demands)


# ---------------------------------------------------------------------------
# Event log (drives the notification toasts on OCC + department portals)
# ---------------------------------------------------------------------------

EVENT_KINDS = (
    "REPORT_SUBMITTED",
    "REPORT_APPROVED",
    "REPORT_REJECTED",
    "DEMAND_SANCTIONED",
    "DEMAND_DEFERRED",
    "BLOCK_STARTED",
    "BLOCK_COMPLETED",
    "BLOCK_CANCELLED",
)


def read_events_unlocked() -> list:
    return _read_json_list(EVENTS_FILE, "events")


def write_events_unlocked(events: list):
    _write_json_list(EVENTS_FILE, "events", events)


def read_events() -> list:
    with events_lock:
        return read_events_unlocked()


def emit_event(kind: str, title: str, message: str, department: str = "ALL",
               severity: str = "info", ref_id: str = "") -> dict:
    """
    Appends one event to the log and returns it.

    `seq` is a monotonically increasing integer the frontend uses as a
    high-water mark, so each page only toasts events it has not seen yet.
    """
    with events_lock:
        events = read_events_unlocked()
        next_seq = (events[-1]["seq"] + 1) if events else 1
        event = {
            "seq": next_seq,
            "event_id": f"EVT-{uuid.uuid4().hex[:8].upper()}",
            "kind": kind,
            "department": department,
            "severity": severity,
            "title": title,
            "message": message,
            "ref_id": ref_id,
            "sim_time": sim_now_iso(),
        }
        events.append(event)
        write_events_unlocked(events[-MAX_EVENTS_RETAINED:])
    return event


def clear_events():
    with events_lock:
        write_events_unlocked([])
