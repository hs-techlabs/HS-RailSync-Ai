"""
FastAPI Application Entry Point.
Serves REST API endpoints for:
- /api/schedule/optimal     : Optimal multi-department bundled block schedule
- /api/schedule/monthly     : 30-day strategic macro horizon plan
- /api/schedule/weekly      : 7-day tactical matrix plan
- /api/assets/health        : Asset inventory & risk breakdown with explainability
- /api/assets/explain/{id}  : SHAP feature attribution justification card
- /api/station/yard/{code}  : Station Yard Interlocking layout, S&T points & OHE mast status
- /api/simulate/delay       : Real-time train delay perturbation recovery
- /api/simulate/defect      : Emergency defect insertion & live resolution
- /api/memos/bdms/{id}      : Formatted Indian Railways Block Sanction Notice generator
- /api/upload/csv           : User custom maintenance CSV ingestion & re-optimization
Serves the interactive Control Office frontend dashboard.
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from pydantic import BaseModel

# Ensure root directory is in python path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
sys.path.append(ROOT_DIR)

from src.optimizer.ortools_scheduler import ORToolsBlockScheduler
from src.optimizer.multi_horizon import generate_monthly_strategic_plan, generate_weekly_tactical_plan
from src.simulator.disruption_engine import DisruptionSimulator
from src.ml_engine.predict import run_inference
from src.simulator import sim_state, fault_generator, block_lifecycle
from src.simulator.virtual_clock import (
    sim_now, sim_now_iso, multiplier as clock_multiplier, resolve_window
)

app = FastAPI(
    title="Indian Railways AI Automatic Block Planning System",
    description="Intelligent Joint Block Scheduling & Multi-Department Maintenance Optimization (SIH 2024)",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static frontend files
frontend_dir = os.path.join(ROOT_DIR, "src", "frontend")
if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

# Field-evidence attachments (photos / inspection PDFs referenced by worker
# reports). Nothing under data/ was web-servable before this.
attachments_dir = os.path.join(ROOT_DIR, "data", "attachments")
if os.path.exists(attachments_dir):
    app.mount("/attachments", StaticFiles(directory=attachments_dir), name="attachments")

# Instantiate engines lazily
scheduler = ORToolsBlockScheduler()
simulator = DisruptionSimulator()
explainability_engine = None

# Start the live field-report simulator on server boot. Tests set
# RAILWAY_SIM_AUTOSTART=0 before importing this module so the daemon never
# mutates state underneath an assertion.
if os.environ.get("RAILWAY_SIM_AUTOSTART", "1") != "0":
    fault_generator.start()


def get_explainability_engine():
    global explainability_engine
    if explainability_engine is None:
        try:
            from src.ml_engine.explainability import ExplainabilityEngine
            explainability_engine = ExplainabilityEngine()
        except Exception as e:
            print(f"Explainability engine note: {e}")
    return explainability_engine


@app.get("/", response_class=HTMLResponse)
def serve_dashboard():
    index_file = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return HTMLResponse("<h1>Indian Railways AI Automatic Block Planner API is Running</h1>")


@app.get("/api/corridor/topology")
def get_corridor_topology():
    topo_path = os.path.join(ROOT_DIR, "data", "topology", "ndls_cnb_corridor.json")
    if os.path.exists(topo_path):
        with open(topo_path, "r") as f:
            return json.load(f)
    return {"error": "Topology not found"}


@app.get("/api/corridor/timetable")
def get_timetable():
    tt_path = os.path.join(ROOT_DIR, "data", "raw", "ndls_cnb_real_timetable.csv")
    if os.path.exists(tt_path):
        df_tt = pd.read_csv(tt_path)
        df_tt = df_tt.replace({np.nan: None})
        return df_tt.to_dict(orient="records")
    return {"error": "Timetable not found"}


@app.get("/api/schedule/optimal")
def get_optimal_schedule():
    sched_path = os.path.join(ROOT_DIR, "data", "processed", "optimized_schedule.json")
    if os.path.exists(sched_path):
        with open(sched_path, "r") as f:
            return json.load(f)
    return scheduler.solve_schedule()


@app.get("/api/schedule/monthly")
def get_monthly_plan():
    return generate_monthly_strategic_plan()


@app.get("/api/schedule/weekly")
def get_weekly_plan():
    return generate_weekly_tactical_plan()


@app.get("/api/assets/health")
def get_assets_health(department: str = None, limit: int = 100):
    preds_path = os.path.join(ROOT_DIR, "data", "processed", "ml_predictions.csv")
    if not os.path.exists(preds_path):
        run_inference()

    df_p = pd.read_csv(preds_path)
    if department and department != "ALL":
        df_p = df_p[df_p["department"] == department]

    critical_count = int((df_p["priority_tier"] == "CRITICAL").sum())
    high_count = int((df_p["priority_tier"] == "HIGH").sum())
    medium_count = int((df_p["priority_tier"] == "MEDIUM").sum())
    low_count = int((df_p["priority_tier"] == "LOW").sum())

    df_p = df_p.replace({np.nan: None})
    records = df_p.head(limit).to_dict(orient="records")

    return {
        "total_assets": len(df_p),
        "critical_count": critical_count,
        "high_count": high_count,
        "medium_count": medium_count,
        "low_count": low_count,
        "assets": records
    }


@app.get("/api/assets/explain/{asset_id}")
def explain_single_asset(asset_id: str):
    preds_path = os.path.join(ROOT_DIR, "data", "processed", "ml_predictions.csv")
    if not os.path.exists(preds_path):
        raise HTTPException(status_code=404, detail="Dataset not ready")

    df_p = pd.read_csv(preds_path)
    match = df_p[df_p["asset_id"] == asset_id]
    if match.empty:
        raise HTTPException(status_code=404, detail=f"Asset {asset_id} not found")

    rec = match.iloc[0].to_dict()
    engine = get_explainability_engine()
    if engine:
        return engine.explain_asset(rec)
    return {
        "asset_id": asset_id,
        "priority_tier": rec.get("priority_tier", "MEDIUM"),
        "failure_probability_pct": rec.get("failure_percentage", 50.0),
        "primary_risk_drivers": ["Degraded asset condition index", "Overdue maintenance window"],
        "recommended_action": f"Schedule {rec.get('priority_tier', 'MEDIUM')} priority block"
    }


@app.get("/api/station/yard/{station_code}")
def get_station_yard(station_code: str):
    st_code = station_code.upper().strip()
    yard_path = os.path.join(ROOT_DIR, "data", "topology", "station_yards.json")
    if not os.path.exists(yard_path):
        raise HTTPException(status_code=404, detail="Station yards topology file not found")

    with open(yard_path, "r") as f:
        all_yards = json.load(f)

    st_yard = next((y for y in all_yards if y["station_code"] == st_code), None)
    if not st_yard:
        raise HTTPException(status_code=404, detail=f"Yard layout for {station_code} not found")

    preds_path = os.path.join(ROOT_DIR, "data", "processed", "ml_predictions.csv")
    st_assets = []
    if os.path.exists(preds_path):
        df_p = pd.read_csv(preds_path)
        sig_matches = df_p[(df_p["department"] == "SIGNAL_AND_TELECOM") & (df_p["station"] == st_code)].copy()
        sig_matches = sig_matches.replace({np.nan: None})
        st_assets = sig_matches.to_dict(orient="records")

    point_machines = [a for a in st_assets if str(a.get("asset_type")) == "POINT_MACHINE"]
    track_circuits = [a for a in st_assets if str(a.get("asset_type")) == "TRACK_CIRCUIT"]

    points_enriched = []
    for idx, pt in enumerate(st_yard.get("points", [])):
        pt_copy = dict(pt)
        if idx < len(point_machines):
            pm = point_machines[idx]
            pt_copy["asset_id"] = pm.get("asset_id")
            pt_copy["health_index"] = pm.get("health_index", 85.0)
            pt_copy["priority_tier"] = pm.get("priority_tier", "LOW")
            pt_copy["failure_probability_pct"] = pm.get("failure_percentage", 15.0)
            pt_copy["throw_time_sec"] = pm.get("point_throw_time_sec", 4.5)
            pt_copy["motor_current_amps"] = pm.get("motor_peak_current_amps", 2.0)
            pt_copy["insulation_mohm"] = pm.get("insulation_resistance_megohm", 10.0)
            pt_copy["predicted_rul_days"] = pm.get("predicted_rul_days", 180)
        else:
            pt_copy["asset_id"] = f"SIG-PT-{st_code}-{idx+1:02d}"
            pt_copy["health_index"] = 92.0
            pt_copy["priority_tier"] = "LOW"
            pt_copy["failure_probability_pct"] = 8.0
            pt_copy["throw_time_sec"] = 4.2
            pt_copy["motor_current_amps"] = 1.9
            pt_copy["insulation_mohm"] = 12.0
            pt_copy["predicted_rul_days"] = 300
        points_enriched.append(pt_copy)

    sched_path = os.path.join(ROOT_DIR, "data", "processed", "optimized_schedule.json")
    active_blocks = []
    if os.path.exists(sched_path):
        with open(sched_path, "r") as f:
            sched_data = json.load(f)
            for b in sched_data.get("scheduled_blocks", []):
                if st_code in b.get("section", ""):
                    active_blocks.append(b)

    return {
        "station_code": st_yard["station_code"],
        "station_name": st_yard["station_name"],
        "km": st_yard["km"],
        "division": st_yard["division"],
        "interlocking_type": st_yard["interlocking_type"],
        "layout_type": st_yard["layout_type"],
        "layout_source": st_yard["layout_source"],
        "platform_count": st_yard["platform_count"],
        "track_count": st_yard["track_count"],
        "speed_limit_kmph": st_yard["speed_limit_kmph"],
        "tracks": st_yard.get("tracks", []),
        "platforms": st_yard.get("platforms", []),
        "points": points_enriched,
        "signals": st_yard.get("signals", []),
        "ohe_masts": st_yard.get("ohe_masts", []),
        "total_signal_assets": len(st_assets),
        "point_machines_count": len(point_machines),
        "track_circuits_count": len(track_circuits),
        "active_blocks": active_blocks
    }


class DelayRequest(BaseModel):
    train_number: str
    delay_minutes: int


@app.post("/api/simulate/delay")
def simulate_delay(req: DelayRequest):
    return simulator.simulate_train_delay(req.train_number, req.delay_minutes)


class DefectRequest(BaseModel):
    section: str
    line: str
    km: float
    department: str = "ENGINEERING_TRACK"


@app.post("/api/simulate/defect")
def simulate_defect(req: DefectRequest):
    return simulator.simulate_emergency_defect(
        section=req.section,
        line=req.line,
        km=req.km,
        department=req.department
    )


@app.get("/api/memos/bdms/{schedule_id}")
def generate_bdms_memo(schedule_id: str):
    sched_path = os.path.join(ROOT_DIR, "data", "processed", "optimized_schedule.json")
    if not os.path.exists(sched_path):
        raise HTTPException(status_code=404, detail="Schedule not ready")

    with open(sched_path, "r") as f:
        sched_data = json.load(f)

    block = next((b for b in sched_data.get("scheduled_blocks", []) if b["schedule_id"] == schedule_id), None)
    if not block:
        raise HTTPException(status_code=404, detail=f"Block {schedule_id} not found")

    tasks_text = "\n".join([f"  {idx+1}. [{task_id}] {desc}" for idx, (task_id, desc) in enumerate(zip(block['tasks'], block['descriptions']))])
    depts = ", ".join(block["departments"])
    machines = ", ".join(block["machines"]) if block["machines"] else "Manual Gang Equipment"

    memo_text = f"""
========================================================================================
             GOVERNMENT OF INDIA &bull; MINISTRY OF RAILWAYS (RAILWAY BOARD)
       NORTHERN & NORTH CENTRAL RAILWAYS &bull; OPERATING (CONTROL) DEPARTMENT
========================================================================================
BLOCK SANCTION MEMORANDUM &bull; JOINT SHADOW MAINTENANCE ORDER
Memo Ref No: NR/NCR/BDMS/OPT/{block['schedule_id']}                      Date: TODAY
To: Station Masters (SM / SS): {block['section'].split('-')[0].strip()} & {block['section'].split('-')[1].strip()}
Copy to: Section Controller (SCR), Chief Controller (CHC), Dy.CEE (TRD), Dy.CE (Track), Dy.CSTE

1. PERMISSION DETAILS:
   - Schedule ID          : {block['schedule_id']} (AI Optimized Multi-Dept Shadow Block)
   - Corridor Section     : {block['section']} ({block['line']} Line)
   - Kilometer Chainage   : KM {block['km_range']}
   - Sanctioned Window    : {block['start_time']} hrs to {block['end_time']} hrs IST
   - Total Net Duration   : {block['duration_min']} Minutes (0 secondary delay to Rajdhani/Vande Bharat)

2. CO-LOCATED REQUISITIONS (SHADOW BUNDLED):
{tasks_text}

3. DEPARTMENTS INVOLVED   : {depts}
4. POWER BLOCK (OHE)      : {'MANDATORY 25 kV AC Isolation Granted (TRD Staff on Site)' if block['power_block_required'] else 'Not Required'}
5. S&T DISCONNECTION      : {'Disconnection memo accepted by Station Master' if block['disconnection_required'] else 'Not Required'}
6. ROLLING ASSETS / GANG  : {machines}

7. SPECIAL CAUTION INSTRUCTIONS:
   - Ensure 10-minute headway clearance buffer before commercial train path opens.
   - All work to cease 15 min prior to block expiry; track fit certificate to be issued.

                                                      By Order &ndash; CHIEF CONTROLLER (CHC)
========================================================================================
    """
    return {
        "schedule_id": schedule_id,
        "memo_formatted_text": memo_text.strip(),
        "block_details": block
    }


@app.post("/api/upload/csv")
async def upload_custom_csv(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files supported")

    upload_dir = os.path.join(ROOT_DIR, "data", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.filename)

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    try:
        run_inference(input_csv=file_path)
        scheduler.solve_schedule()
        return {"status": "SUCCESS", "message": f"Uploaded {file.filename}, ML risk scored & block schedule updated!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


# ==============================================================================
# MULTI-DEPARTMENT PORTAL SERVING & DEMAND QUEUE LIFECYCLE
# ==============================================================================

@app.get("/tms", response_class=HTMLResponse)
def serve_tms_portal():
    tms_file = os.path.join(frontend_dir, "tms.html")
    if os.path.exists(tms_file):
        return FileResponse(tms_file)
    return HTMLResponse("<h1>Track Management System (TMS) Portal</h1>")


@app.get("/tdms", response_class=HTMLResponse)
def serve_tdms_portal():
    tdms_file = os.path.join(frontend_dir, "tdms.html")
    if os.path.exists(tdms_file):
        return FileResponse(tdms_file)
    return HTMLResponse("<h1>Traction Distribution Management System (TDMS) Portal</h1>")


@app.get("/smms", response_class=HTMLResponse)
def serve_smms_portal():
    smms_file = os.path.join(frontend_dir, "smms.html")
    if os.path.exists(smms_file):
        return FileResponse(smms_file)
    return HTMLResponse("<h1>Signal Maintenance Management System (SMMS) Portal</h1>")


DEMANDS_FILE = sim_state.DEMANDS_FILE

# Thin aliases over the shared, lock-guarded primitives in sim_state, so the API
# handlers and the background simulator thread can never interleave a read and a
# write on the same file.
_read_demands = sim_state.read_demands
_save_demands = sim_state.write_demands


class DemandRequest(BaseModel):
    department: str                     # "ENGINEERING_TRACK" | "TRACTION_DISTRIBUTION_OHE" | "SIGNAL_AND_TELECOM"
    defect_category: str                # e.g. "Rail Flaw (USFD)", "Contact Wire Wear", "Point Machine Sluggish"
    section_from: str                   # Station code, e.g. "ALJN"
    section_to: str                     # Station code, e.g. "TDL"
    line: str = "DN"                    # "UP" | "DN"
    km_start: float = 0.0
    km_end: float = 0.0
    machine_required: str = "NONE"      # "CSM_TAMPING", "BCM", "TOWER_WAGON", "MANUAL_GANG", "NONE"
    power_block_required: bool = False
    disconnection_required: bool = False
    gang_crew: str = "Standard Field Crew"
    duration_requested_min: int = 180
    priority: str = "CRITICAL"          # "CRITICAL" | "HIGH" | "MEDIUM"
    description: str = ""


# Machines that must never work near live 25 kV OHE without an isolation permit.
# The dataset labels these CSM / TAMPING / BCM, so all three spellings are
# covered here (CONTEXT.md section 6.6 safety precedence guardrail).
POWER_BLOCK_MACHINES = {"BCM", "CSM", "TAMPING", "CSM_TAMPING"}


def _create_pending_demand(department: str, defect_category: str, section_from: str,
                           section_to: str, line: str, km_start: float, km_end: float,
                           machine_required: str, power_block_required: bool,
                           disconnection_required: bool, gang_crew: str,
                           duration_requested_min: int, priority: str,
                           description: str, asset_id: str = "") -> dict:
    """
    Builds and queues one OCC demand.

    Single implementation shared by the manual /api/demand/raise endpoint and by
    worker-report approval, so an approved field report produces exactly the same
    record shape the old manual form did - which is why nothing downstream (the
    bundling engine, the OCC console, the sanction memo generator) needed to
    change.
    """
    with sim_state.demands_lock:
        demands = sim_state.read_demands_unlocked()

        dept_prefix = sim_state.DEPT_PREFIX.get(department, "DMD")
        dept_label = sim_state.DEPT_LABEL.get(department, department)
        demand_id = f"DMD-{dept_prefix}-{len(demands) + 101}"

        # Auto-enforce safety rules
        pwr = power_block_required
        if department == "TRACTION_DISTRIBUTION_OHE" or machine_required in POWER_BLOCK_MACHINES:
            pwr = True

        disc = disconnection_required
        if department == "SIGNAL_AND_TELECOM":
            disc = True

        new_demand = {
            "demand_id": demand_id,
            "department": department,
            "department_label": dept_label,
            "asset_id": asset_id,
            "defect_category": defect_category,
            "section_from": section_from.upper(),
            "section_to": section_to.upper(),
            "line": line.upper(),
            "km_start": km_start,
            "km_end": km_end if km_end > km_start else km_start + 1.0,
            "machine_required": machine_required,
            "power_block_required": pwr,
            "disconnection_required": disc,
            "gang_crew": gang_crew,
            "duration_requested_min": duration_requested_min,
            "priority": priority,
            "description": description or f"{defect_category} on {section_from}-{section_to} ({line})",
            "status": "PENDING_SANCTION",
            "raised_at": pd.Timestamp.now().isoformat(),
            "raised_at_sim": sim_now_iso(),
            "sanctioned_window": None,
            "sanction_memo_id": None,
            "window_start_sim": None,
            "window_end_sim": None,
            "window_day_label": None
        }

        demands.append(new_demand)
        sim_state.write_demands_unlocked(demands)

    return new_demand


@app.post("/api/demand/raise")
def raise_demand(req: DemandRequest):
    """Manual override path. No portal UI calls this any more, but it still works."""
    new_demand = _create_pending_demand(
        department=req.department,
        defect_category=req.defect_category,
        section_from=req.section_from,
        section_to=req.section_to,
        line=req.line,
        km_start=req.km_start,
        km_end=req.km_end,
        machine_required=req.machine_required,
        power_block_required=req.power_block_required,
        disconnection_required=req.disconnection_required,
        gang_crew=req.gang_crew,
        duration_requested_min=req.duration_requested_min,
        priority=req.priority,
        description=req.description
    )

    return {
        "status": "SUCCESS",
        "message": f"Demand {new_demand['demand_id']} submitted to Central OCC queue.",
        "demand": new_demand
    }


@app.get("/api/demand/pending")
def get_pending_demands():
    demands = _read_demands()
    pending = [d for d in demands if d.get("status") == "PENDING_SANCTION"]
    total_unbundled_min = sum(d.get("duration_requested_min", 0) for d in pending)
    return {
        "total_pending": len(pending),
        "total_unbundled_hours": round(total_unbundled_min / 60.0, 1),
        "demands": pending
    }


@app.get("/api/demand/status/{department}")
def get_department_demands(department: str):
    dept_norm = department.upper().strip()
    demands = _read_demands()
    if dept_norm != "ALL":
        filtered = [d for d in demands if d.get("department") == dept_norm]
    else:
        filtered = demands

    return {
        "department": dept_norm,
        "total": len(filtered),
        "demands": list(reversed(filtered))
    }


@app.get("/api/demand/history")
def get_all_demands():
    demands = _read_demands()
    return {
        "total": len(demands),
        "demands": list(reversed(demands))
    }


@app.post("/api/demand/clear")
def clear_demands():
    _save_demands([])
    return {"status": "SUCCESS", "message": "Pending demands queue reset."}


@app.post("/api/demand/bundle_and_sanction")
def bundle_and_sanction_demands():
    demands = _read_demands()
    pending = [d for d in demands if d.get("status") == "PENDING_SANCTION"]

    if not pending:
        # Re-solve base schedule if nothing pending
        sched = scheduler.solve_schedule()
        return {
            "status": "NO_PENDING",
            "message": "No pending departmental demands in queue.",
            "sanctioned_count": 0,
            "updated_schedule": sched
        }

    preds_path = os.path.join(ROOT_DIR, "data", "processed", "ml_predictions.csv")
    df_p = pd.read_csv(preds_path) if os.path.exists(preds_path) else pd.DataFrame()

    # Convert pending demands into urgent high-priority prediction records
    urgent_records = []
    for d in pending:
        rec = {
            "task_id": d["demand_id"],
            "asset_id": f"ASSET-{d['department'][:3]}-{d['section_from']}",
            "department": d["department"],
            "section_from": d["section_from"],
            "section_to": d["section_to"],
            "km_start": d["km_start"],
            "km_end": d["km_end"],
            "line": d["line"],
            "description": f"URGENT: {d['defect_category']} - {d['description']}",
            "machine_required": d["machine_required"],
            "power_block_required": d["power_block_required"],
            "disconnection_required": d["disconnection_required"],
            "estimated_duration_min": d["duration_requested_min"],
            "failure_probability": 0.95 if d["priority"] == "CRITICAL" else 0.75,
            "failure_percentage": 95.0 if d["priority"] == "CRITICAL" else 75.0,
            "priority_tier": d["priority"],
            "predicted_rul_days": 2 if d["priority"] == "CRITICAL" else 7,
            "predicted_duration_min": d["duration_requested_min"],
            "composite_criticality_score": 95.0 if d["priority"] == "CRITICAL" else 80.0
        }
        urgent_records.append(rec)

    # Prepend urgent demands to backlog
    df_temp = pd.concat([pd.DataFrame(urgent_records), df_p], ignore_index=True)
    temp_preds_path = os.path.join(ROOT_DIR, "data", "processed", "temp_demand_preds.csv")
    df_temp.to_csv(temp_preds_path, index=False)

    # Solve optimal shadow block schedule with OR-Tools. The freshly raised
    # demands are flagged so the solver always evaluates them instead of letting
    # the criticality cut-off discard them before they are ever considered.
    dyn_scheduler = ORToolsBlockScheduler(
        predictions_csv=temp_preds_path,
        priority_task_ids={d["demand_id"] for d in pending}
    )
    _sanction_moment = sim_now()
    resolved_schedule = dyn_scheduler.solve_schedule(
        now_min_of_day=_sanction_moment.hour * 60 + _sanction_moment.minute
    )

    # Match each demand with its assigned block window
    scheduled_blocks = resolved_schedule.get("scheduled_blocks", [])
    sanctioned_demands = []

    deferred_demands = []
    sanction_moment = _sanction_moment

    # Re-read under the lock: solving takes seconds, during which the background
    # generator may have queued more reports. Only the demands we actually solved
    # for are touched here.
    pending_ids = {d["demand_id"] for d in pending}
    with sim_state.demands_lock:
        demands = sim_state.read_demands_unlocked()

        for d in demands:
            if d.get("demand_id") not in pending_ids or d.get("status") != "PENDING_SANCTION":
                continue

            d_id = d["demand_id"]
            matched_block = None

            # Look for the block containing this task, or one covering the same
            # section and line that this work can ride along with.
            for b in scheduled_blocks:
                same_section = (b.get("section") == f"{d['section_from']} - {d['section_to']}"
                                and b.get("line") == d["line"])
                if d_id in b.get("tasks", []) or same_section:
                    matched_block = b
                    break

            if matched_block:
                # Resolve the bare "HH:MM" window into absolute simulated
                # datetimes so the lifecycle engine survives the simulated day
                # wrapping, and so a window already past today is honestly
                # labelled as tomorrow's block rather than silently expiring.
                start_dt, end_dt = resolve_window(
                    matched_block["start_time"], matched_block["end_time"], sanction_moment
                )
                is_tomorrow = start_dt.date() > sanction_moment.date()

                d["status"] = "APPROVED_SHADOW_BLOCK"
                d["sanctioned_window"] = f"{matched_block['start_time']} - {matched_block['end_time']} IST"
                d["sanction_memo_id"] = matched_block["schedule_id"]
                d["window_start_sim"] = start_dt.isoformat()
                d["window_end_sim"] = end_dt.isoformat()
                d["window_day_label"] = "TOMORROW" if is_tomorrow else "TODAY"
                sanctioned_demands.append(d)
            else:
                # No slot on this section could host it. Say so, rather than
                # handing back some other block's window.
                d["status"] = "DEFERRED_NEXT_CYCLE"
                d["deferral_reason"] = (
                    f"No conflict-free maintenance window available on "
                    f"{d['section_from']} - {d['section_to']} ({d['line']}) within the 24h horizon."
                )
                deferred_demands.append(d)

        sim_state.write_demands_unlocked(demands)

    for d in sanctioned_demands:
        sim_state.emit_event(
            kind="DEMAND_SANCTIONED", department=d.get("department", "ALL"), severity="success",
            title=f"Block sanctioned: {d['demand_id']}",
            message=(f"{d.get('defect_category')} on {d.get('section_from')} - {d.get('section_to')} "
                     f"({d.get('line')}) sanctioned for {d['sanctioned_window']} "
                     f"[{d['window_day_label']}] under {d['sanction_memo_id']}."),
            ref_id=d["demand_id"])
    for d in deferred_demands:
        sim_state.emit_event(
            kind="DEMAND_DEFERRED", department=d.get("department", "ALL"), severity="warning",
            title=f"Demand deferred: {d['demand_id']}",
            message=d.get("deferral_reason", "Deferred to next planning cycle."),
            ref_id=d["demand_id"])

    # Also persist to master optimized_schedule.json
    sched_path = os.path.join(ROOT_DIR, "data", "processed", "optimized_schedule.json")
    with open(sched_path, "w") as f:
        json.dump(resolved_schedule, f, indent=2)

    message = (f"Successfully auto-bundled and sanctioned {len(sanctioned_demands)} "
               f"departmental demands into unified shadow block windows!")
    if deferred_demands:
        message += (f" {len(deferred_demands)} deferred - no conflict-free window "
                    f"available on their section within the 24h horizon.")

    return {
        "status": "SUCCESS",
        "message": message,
        "sanctioned_count": len(sanctioned_demands),
        "sanctioned_demands": sanctioned_demands,
        "deferred_count": len(deferred_demands),
        "deferred_demands": deferred_demands,
        "updated_schedule": resolved_schedule
    }



# ==============================================================================
# LIVE SIMULATOR: VIRTUAL CLOCK, WORKER FIELD REPORTS, EVENTS & EXECUTION BOARD
# ==============================================================================

@app.get("/api/clock/now")
def get_sim_clock():
    """The accelerated corridor clock every screen shares."""
    return {
        "sim_time": sim_now_iso(),
        "real_time": pd.Timestamp.now().isoformat(),
        "multiplier": clock_multiplier()
    }


def _filter_by_department(records: list, department: str) -> list:
    dept = (department or "ALL").upper().strip()
    if dept == "ALL":
        return records
    return [r for r in records if r.get("department") == dept]


@app.get("/api/worker_requests/pending")
def get_pending_worker_requests(department: str = "ALL"):
    """Field reports awaiting the department officer's review."""
    requests = [r for r in sim_state.read_worker_requests() if r.get("status") == "PENDING_REVIEW"]
    filtered = _filter_by_department(requests, department)
    filtered.sort(key=lambda r: r.get("submitted_at", ""), reverse=True)
    return {
        "department": (department or "ALL").upper(),
        "total": len(filtered),
        "requests": filtered
    }


@app.get("/api/worker_requests/history")
def get_worker_request_history(department: str = "ALL", limit: int = 15):
    """Recently reviewed (approved or rejected) field reports."""
    requests = [
        r for r in sim_state.read_worker_requests()
        if r.get("status") in ("APPROVED_FORWARDED", "REJECTED")
    ]
    filtered = _filter_by_department(requests, department)
    filtered.sort(key=lambda r: r.get("reviewed_at") or "", reverse=True)
    return {
        "department": (department or "ALL").upper(),
        "total": len(filtered),
        "requests": filtered[:limit]
    }


class ReviewRequest(BaseModel):
    reason: str = ""
    reviewed_by: str = "Department Officer"


@app.post("/api/worker_requests/{request_id}/approve")
def approve_worker_request(request_id: str, req: ReviewRequest = None):
    """
    Officer approves a field report, forwarding it to the Central OCC queue.

    The whole find-and-mutate runs inside one lock hold so the generator thread
    cannot append a new report between the read and the write.
    """
    reviewed_by = req.reviewed_by if req else "Department Officer"

    with sim_state.worker_requests_lock:
        requests = sim_state.read_worker_requests_unlocked()
        match = next((r for r in requests if r.get("request_id") == request_id), None)

        if match is None:
            raise HTTPException(status_code=404, detail=f"Field report {request_id} not found")
        if match.get("status") != "PENDING_REVIEW":
            raise HTTPException(
                status_code=409,
                detail=f"Field report {request_id} is already {match.get('status')}"
            )

        match["status"] = "APPROVED_FORWARDED"
        match["review_note"] = (req.reason if req and req.reason
                                else "Evidence verified; forwarded to Central OCC for block sanction.")
        match["reviewed_at"] = sim_now_iso()
        match["reviewed_by"] = reviewed_by
        approved = dict(match)
        sim_state.write_worker_requests_unlocked(requests)

    demand = _create_pending_demand(
        department=approved["department"],
        defect_category=approved["defect_category"],
        section_from=approved["section_from"],
        section_to=approved["section_to"],
        line=approved["line"],
        km_start=approved["km_start"],
        km_end=approved["km_end"],
        machine_required=approved["machine_required"],
        power_block_required=approved["power_block_required"],
        disconnection_required=approved["disconnection_required"],
        gang_crew=approved["gang_crew"],
        duration_requested_min=approved["duration_requested_min"],
        priority=approved["priority"],
        description=approved["description"],
        asset_id=approved.get("asset_id", "")
    )

    sim_state.emit_event(
        kind="REPORT_APPROVED", department=approved["department"], severity="info",
        title=f"Report approved -> {demand['demand_id']}",
        message=(f"{reviewed_by} approved {approved['request_id']} "
                 f"({approved['defect_category']}). Forwarded to Central OCC for sanction."),
        ref_id=demand["demand_id"])

    return {
        "status": "SUCCESS",
        "message": f"Field report {request_id} approved and forwarded as {demand['demand_id']}.",
        "request": approved,
        "demand": demand
    }


@app.post("/api/worker_requests/{request_id}/reject")
def reject_worker_request(request_id: str, req: ReviewRequest = None):
    """Officer rejects a field report. It never reaches the OCC."""
    reviewed_by = req.reviewed_by if req else "Department Officer"
    reason = (req.reason if req and req.reason else "Not actionable / insufficient evidence")

    with sim_state.worker_requests_lock:
        requests = sim_state.read_worker_requests_unlocked()
        match = next((r for r in requests if r.get("request_id") == request_id), None)

        if match is None:
            raise HTTPException(status_code=404, detail=f"Field report {request_id} not found")
        if match.get("status") != "PENDING_REVIEW":
            raise HTTPException(
                status_code=409,
                detail=f"Field report {request_id} is already {match.get('status')}"
            )

        match["status"] = "REJECTED"
        match["review_note"] = reason
        match["reviewed_at"] = sim_now_iso()
        match["reviewed_by"] = reviewed_by
        rejected = dict(match)
        sim_state.write_worker_requests_unlocked(requests)

    sim_state.emit_event(
        kind="REPORT_REJECTED", department=rejected["department"], severity="warning",
        title=f"Report rejected: {request_id}",
        message=f"{reviewed_by} rejected {rejected['defect_category']} - {reason}",
        ref_id=request_id)

    return {
        "status": "SUCCESS",
        "message": f"Field report {request_id} rejected.",
        "request": rejected
    }


@app.post("/api/worker_requests/clear")
def clear_worker_requests():
    sim_state.write_worker_requests([])
    return {"status": "SUCCESS", "message": "Worker field report queue reset."}


@app.post("/api/simulator/reset")
def reset_simulator():
    """Clean slate before a demo run: field reports, OCC demands and notifications."""
    sim_state.write_worker_requests([])
    sim_state.write_demands([])
    sim_state.clear_events()
    return {"status": "SUCCESS",
            "message": "Simulator reset: reports, demands and notifications cleared."}


@app.get("/api/events/feed")
def get_event_feed(department: str = "ALL", after_seq: int = 0, limit: int = 30):
    """
    Notification feed backing the toasts on the OCC desk and the portals.

    `after_seq` is a high-water mark: a page passes back the highest sequence it
    has already shown, so it only ever toasts events it has not seen.
    """
    events = sim_state.read_events()
    dept = (department or "ALL").upper().strip()
    if dept != "ALL":
        events = [e for e in events if e.get("department") in (dept, "ALL")]

    fresh = [e for e in events if e.get("seq", 0) > after_seq]
    latest_seq = events[-1]["seq"] if events else 0

    return {
        "department": dept,
        "latest_seq": latest_seq,
        "events": fresh[-limit:]
    }


def _block_exec_state(block: dict, now):
    """
    Derives live execution state for a scheduled block against the sim clock.

    Blocks in optimized_schedule.json are a recurring daily plan, so their window
    is resolved against the CURRENT simulated day rather than rolled forward.
    """
    from datetime import timedelta
    from src.simulator.virtual_clock import parse_hhmm

    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start_min = parse_hhmm(block.get("start_time", "00:00"))
    end_min = parse_hhmm(block.get("end_time", "00:00"))
    if end_min <= start_min:
        end_min += 1440

    start_dt = day_start + timedelta(minutes=start_min)
    end_dt = day_start + timedelta(minutes=end_min)

    if now >= end_dt:
        return "COMPLETED", 100.0
    if now >= start_dt:
        total = (end_dt - start_dt).total_seconds()
        pct = (now - start_dt).total_seconds() / total * 100.0 if total > 0 else 0.0
        return "IN_PROGRESS", round(max(0.0, min(100.0, pct)), 1)
    return "SCHEDULED", 0.0


@app.get("/api/live/board")
def get_live_board():
    """
    Live execution board: what the corridor is doing right now.

    Combines the optimised daily block plan (derived state) with the demands the
    departments actually raised (persisted lifecycle state), so the OCC can watch
    work start, finish and occasionally get withdrawn.
    """
    now = sim_now()

    sched_path = os.path.join(ROOT_DIR, "data", "processed", "optimized_schedule.json")
    blocks = []
    if os.path.exists(sched_path):
        with open(sched_path, "r") as f:
            for b in json.load(f).get("scheduled_blocks", []):
                exec_status, progress = _block_exec_state(b, now)
                blocks.append({
                    "schedule_id": b.get("schedule_id"),
                    "section": b.get("section"),
                    "line": b.get("line"),
                    "start_time": b.get("start_time"),
                    "end_time": b.get("end_time"),
                    "duration_min": b.get("duration_min"),
                    "departments": b.get("departments", []),
                    "is_multi_department": b.get("is_multi_department", False),
                    "task_count": b.get("task_count", 0),
                    "exec_status": exec_status,
                    "progress_pct": progress
                })

    demands = sim_state.read_demands()
    tracked = []
    for d in demands:
        if d.get("status") == "PENDING_SANCTION":
            continue
        entry = block_lifecycle.live_state(d, now)
        entry.update({
            "demand_id": d.get("demand_id"),
            "department": d.get("department"),
            "department_label": d.get("department_label"),
            "defect_category": d.get("defect_category"),
            "section": f"{d.get('section_from')} - {d.get('section_to')}",
            "line": d.get("line"),
            "priority": d.get("priority"),
            "sanctioned_window": d.get("sanctioned_window"),
            "sanction_memo_id": d.get("sanction_memo_id"),
            "cancellation_reason": d.get("cancellation_reason"),
            "deferral_reason": d.get("deferral_reason")
        })
        tracked.append(entry)

    counts = {}
    for t in tracked:
        counts[t["status"]] = counts.get(t["status"], 0) + 1

    return {
        "sim_time": now.isoformat(),
        "multiplier": clock_multiplier(),
        "blocks": blocks,
        "demands": tracked,
        "status_counts": counts
    }
