# CONTEXT.md — Long-Term Architecture & Memory

> This file is the durable architectural memory of the project: what the system is, how it is shaped, and the rules that must not be broken when extending it. It is not a changelog (see `PROGRESS.md`) and not a tutorial (see `DOCUMENTATION.md`).

---

## 1. Project Vision

The **Indian Railways AI-Powered Automatic Block Planning System** is an intelligent scheduling and optimization platform built for the Smart India Hackathon (SIH 2024).

### Core Purpose
- **The Problem:** Indian Railways infrastructure maintenance across Civil (Engineering / TMS), Electrical (Traction Distribution / TDMS) and S&T (Signalling & Telecom / SMMS) is managed in departmental silos via manual Block Demand Management System (BDMS) requests. Independent maintenance blocks cause excessive track downtime, conflict with commercial train operations, and degrade line capacity.
- **The Solution:** An integrated system modelling the 440 KM New Delhi – Kanpur Central (NDLS–CNB) high-density trunk corridor. It unifies multi-department defect logs, applies machine learning (XGBoost + Random Forest) for asset criticality, remaining life and duration estimation, uses mathematical optimization (Google OR-Tools CP-SAT) to generate conflict-free multi-department "shadow blocks", and serves a four-screen operations network driven by a live accelerated corridor simulator.
- **Scope beyond planning:** the system does not stop at producing a schedule. It simulates the corridor generating new maintenance evidence, routes that evidence through department officer review, bundles the resulting requisitions, and walks each sanctioned block through real execution to completion or withdrawal.
- **Source Control Repository:** [`https://github.com/srivastava-himanshu382/ABMaS`](https://github.com/srivastava-himanshu382/ABMaS) (branch `main`)

### The Four Screens
| Screen | Route | Role |
| :--- | :--- | :--- |
| Central Operations Control Center (OCC) | `/` | Chief Section Controller: aggregates raised requisitions, bundles and sanctions, watches execution |
| Track Management System (TMS) | `/tms` | Civil Engineering officer: triages P-Way field reports, requests blocks |
| Traction Distribution Management System (TDMS) | `/tdms` | TRD officer: triages OHE reports, holds 25 kV isolation permits |
| Signal Maintenance Management System (SMMS) | `/smms` | S&T officer: triages signalling reports, issues S&T/T-351 disconnection notices |

---

## 2. Tech Stack (100% Free & Open-Source)

- **Language & Runtime:** Python 3.13 (`py -3.13`); 3.10+ supported
- **Backend Framework:** FastAPI (`fastapi>=0.110.0`), Uvicorn (`uvicorn>=0.28.0`), Pydantic (`pydantic>=2.6.0`)
- **Data Engineering:** pandas (`>=2.0.0`), numpy (`>=1.24.0`), scipy (`>=1.11.0`)
- **Machine Learning:**
  - XGBoost (`xgboost>=2.0.0`) for failure risk classification and Remaining Useful Life regression, with a scikit-learn `GradientBoosting*` fallback when XGBoost is absent
  - Scikit-Learn (`scikit-learn>=1.3.0`) for the Random Forest duration model and `StandardScaler`
  - SHAP (`shap>=0.43.0`) for TreeExplainer attribution, lazily initialised and failure-tolerant
  - Joblib (`joblib>=1.3.0`) for model serialization
- **Mathematical Optimization:** Google OR-Tools (`ortools>=9.8.0`) CP-SAT, with a greedy first-fit fallback when OR-Tools is absent
- **Supporting:** matplotlib (`>=3.7.0`, used only by `scripts/generate_attachments.py`), httpx (`>=0.25.0`, FastAPI `TestClient`), python-multipart (`>=0.0.9`, CSV upload)
- **Frontend Architecture:** Vanilla HTML5 + CSS3 + ES6+ JavaScript. Zero build step, zero npm. Plotly.js `2.35.2` and Leaflet.js `1.9.4` via CDN with SRI hashes; Google Fonts for Inter and JetBrains Mono
- **Geospatial Corridor Map:** an independent in-repo service — `src/map_service/` (read models, served at `/api/map/*`) plus `src/frontend/js/corridor_map.js` (drop-in Leaflet module). Renders UP and DN as two distinct rails via a zoom-reactive parallel offset computed from per-vertex bearings, and is mounted identically on the OCC desk and all three department portals
- **Live Corridor Simulator:** `src/simulator/` — a stateless 80× accelerated clock, a daemon field-report generator grounded in real backlog rows, a lock-ordered JSON state layer with a sequenced event log, and a block lifecycle engine
- **Basemap Tiles (no API key):** ESRI World Imagery (max zoom 18), CartoDB Dark Matter (max zoom 19)
- **Design System:** Warm Industrial Control-Room aesthetic (`occ_redesign.css`), 4-tier material depth hierarchy (Level 0 canvas `#EFECE3`, Level 1 consoles `#F7F5EE`, Level 2 cards `#FFFFFF`, Level 3 overlays `#FFFFFF`), tactile switches, tabular numerals, and dark-terminal digital sanction memos across all 4 screens
- **Two-Tier Hybrid Engine:** Statistical ML (XGBoost risk classification + RUL regression) feeds into a Deterministic RDSO Engineering Priority Engine (`src/generator/rdso_formulas.py` composite criticality), which sets constraint weights for Google OR-Tools CP-SAT
- **Offline Multi-Device Networking:** Binds to `0.0.0.0:8000`, enabling multi-laptop demonstrations over local Wi-Fi / Ethernet with zero internet or cloud dependencies

**Environment verified against:** Python 3.13.5, fastapi 0.120.4, uvicorn 0.38.0, pydantic 2.12.3, pandas 2.3.1, numpy 2.3.1, scikit-learn 1.9.0, xgboost 3.4.1, ortools 9.15.6755, shap 0.52.0, joblib 1.5.3, scipy 1.18.1, httpx 0.28.1.

---

## 3. Folder Structure & Module Boundaries

```
Railways/
├── .gitignore                          # Bytecode, venvs, temp_*.csv, worker_requests.json, sim_events.json
├── CONTEXT.md                          # Long-term architectural memory & constraints (this file)
├── DOCUMENTATION.md                    # Comprehensive technical handbook for developers
├── LICENSE                             # MIT Open-Source License
├── PROGRESS.md                         # Phase tracker, status & verification commands
├── README.md                           # GitHub landing documentation with visual walkthrough
├── requirements.txt                    # 14 production Python dependencies
├── run_system.py                       # Bootstrap: py -3.13 delegation, pipeline, Uvicorn on 0.0.0.0:8000
├── data.txt                            # LEGACY prototype scratch (Day 1) — never imported or executed
├── model.txt                           # LEGACY prototype scratch (Day 2-4) — never imported or executed
├── data/
│   ├── topology/
│   │   ├── ndls_cnb_corridor.json      # 10 stations w/ GPS anchors, chainages, speed limits, machine fleet
│   │   └── station_yards.json          # IRSEM reference yard interlocking layouts (all 10 stations)
│   ├── raw/
│   │   ├── ndls_cnb_real_timetable.csv # 29 trains, 290 station-stops across 24 h
│   │   └── temp_disrupted_timetable.csv# EPHEMERAL: delay simulation (gitignored)
│   ├── processed/
│   │   ├── tms_track_defects.csv       # 850 Civil/Track assets    (seed 42)
│   │   ├── tdms_ohe_defects.csv        # 550 Electrical/OHE assets (seed 43)
│   │   ├── smms_signal_defects.csv     # 450 S&T assets            (seed 44)
│   │   ├── unified_maintenance_backlog.csv # 1,850 merged multi-dept requisitions
│   │   ├── ml_predictions.csv          # 1,850 rows x 71 cols: risk, tier, RUL, duration, criticality
│   │   ├── optimized_schedule.json     # OR-Tools CP-SAT solved block schedule
│   │   ├── pending_demands.json        # LIVE: OCC demand queue + full block lifecycle state
│   │   ├── worker_requests.json        # LIVE: field reports (gitignored, regenerated each run)
│   │   ├── sim_events.json             # LIVE: sequenced notification log, capped 200 (gitignored)
│   │   ├── temp_demand_preds.csv       # EPHEMERAL: backlog + urgent demands for CP-SAT (gitignored)
│   │   └── temp_emergency_preds.csv    # EPHEMERAL: backlog + emergency defect (gitignored)
│   ├── attachments/                    # Field evidence, served statically at /attachments/*
│   │   ├── track/  ohe/  signal/       #   site_photo_1.png, site_photo_2.png, inspection_report.pdf
│   └── uploads/                        # User-uploaded custom CSV maintenance logs
├── docs/
│   └── assets/                         # 15 high-resolution UI captures referenced by README.md
├── scripts/
│   └── generate_attachments.py         # One-off matplotlib generator for data/attachments/ (not runtime)
├── src/
│   ├── __init__.py
│   ├── api/
│   │   ├── __init__.py
│   │   ├── main.py                     # FastAPI app: 31 endpoints, 4 portals, CORS, /static + /attachments
│   │   └── map_router.py               # /api/map/* transport shell over the Corridor Map Service
│   ├── frontend/
│   │   ├── index.html                  # Central OCC control-room board (SPA, 6 tabs)
│   │   ├── tms.html  tdms.html  smms.html
│   │   ├── css/
│   │   │   ├── style.css               # Base design tokens + OCC control-room token layer
│   │   │   ├── occ_redesign.css        # Warm industrial redesign: 4-tier surface hierarchy, tactile buttons, sanction memo modal
│   │   │   └── corridor_map.css        # Map rails, markers, hover cards, toolbar, legend
│   │   └── js/
│   │       ├── app.js                  # OCC coordinator: tabs, KPIs, both boards, XAI, memos, bundling
│   │       ├── sim_clock.js            # Shared accelerated clock + notification toast engine
│   │       ├── portal_review.js        # Shared review console (queue, evidence, approve/reject)
│   │       ├── corridor_map.js         # Drop-in dual-track Leaflet map module (UP/DN, layers, trains)
│   │       ├── block_request.js        # Inspect -> prefilled requisition -> Request Block
│   │       ├── tms_portal.js  tdms_portal.js  smms_portal.js
│   │       ├── marey_chart.js          # 24 h time-distance string chart (Plotly.js)
│   │       ├── gantt_chart.js          # Shadow bundling comparison chart (Plotly.js)
│   │       ├── network_map.js          # CTC schematic track board with UP/DN parallel lines
│   │       ├── yard_schematic.js       # SVG yard interlocking schematic & point inspector
│   │       └── simulator_ui.js         # What-If perturbation controller (backup demo path)
│   ├── generator/
│   │   ├── __init__.py
│   │   ├── rdso_formulas.py            # Official RDSO/IRPWM/ACTM/IRSEM engineering equations
│   │   ├── timetable_builder.py        # 29-train corridor timetable generator
│   │   ├── generate_tms_data.py        generate_tdms_data.py       generate_smms_data.py
│   │   └── generate_all.py             # Master synthesis pipeline + unified backlog compilation
│   ├── ml_engine/
│   │   ├── __init__.py
│   │   ├── feature_pipeline.py         # 18-feature extractor & StandardScaler
│   │   ├── train_models.py             # Deterministic training (risk, RUL, duration)
│   │   ├── explainability.py           # SHAP TreeExplainer + rule-based controller cards
│   │   ├── predict.py                  # Batch inference pipeline
│   │   └── saved_models/
│   │       ├── risk_classifier.joblib      rul_regressor.joblib
│   │       ├── duration_estimator.joblib   scaler.joblib
│   ├── optimizer/
│   │   ├── __init__.py
│   │   ├── slot_finder.py              # Headway scanner (>=45 min usable, 10 min buffer) -> 87 slots
│   │   ├── bundling_engine.py          # Spatial partition clustering -> 494 candidate bundles
│   │   ├── ortools_scheduler.py        # CP-SAT assignment model + greedy fallback
│   │   └── multi_horizon.py            # 30-day strategic & 7-day tactical planners
│   ├── map_service/                    # Corridor Map Service — geospatial READ MODELS, no state mutation
│   │   ├── __init__.py
│   │   ├── geometry.py                 # Single authority: chainage (KM) <-> WGS-84, bearings, sections
│   │   ├── layers.py                   # issues | demands | blocks | powercuts | routines | assets | health
│   │   └── trains.py                   # Live train positions interpolated from the timetable
│   └── simulator/
│       ├── __init__.py
│       ├── virtual_clock.py            # Stateless 80x accelerated clock (24 h in ~18 real min)
│       ├── sim_state.py                # Lock-ordered JSON persistence & sequenced event log
│       ├── fault_generator.py          # Daemon thread generating field reports from real asset rows
│       ├── block_lifecycle.py          # APPROVED -> IN_PROGRESS -> COMPLETED / CANCELLED
│       └── disruption_engine.py        # Sub-second train delay & emergency defect rescheduler
└── tests/                              # 72 tests
    ├── test_data_generator.py          #  7 — RDSO formulas and dataset synthesizers
    ├── test_system_integration.py      # 12 — ML, optimizer, speed, yard API, demand lifecycle
    ├── test_realtime_simulator.py      # 24 — clock, generator, review workflow, lifecycle, events
    └── test_map_service.py             # 29 — geometry, layers, trains, /api/map/*, block-request overrides
```

### Module Dependency Direction
Dependencies flow strictly one way. Nothing lower imports anything higher.

```
generator  ->  (writes CSV/JSON only; imports nothing from the project except rdso_formulas)
ml_engine  ->  generator.rdso_formulas
optimizer  ->  (reads ml_predictions.csv and the timetable; imports nothing upward)
simulator  ->  optimizer.slot_finder (candidate pool restriction only)
map_service->  simulator.sim_state, simulator.block_lifecycle, simulator.virtual_clock
api        ->  optimizer, ml_engine, simulator, map_service
frontend   ->  api (over HTTP only)
```

`map_service` reads simulator state but **never writes it**. `api` is the only layer permitted to mutate simulator state, apart from the generator daemon and the lifecycle tick that it starts.

---

## 4. Data Models & Schema Overview

### 4.1 Corridor Topology (`data/topology/ndls_cnb_corridor.json`)
- **Top level:** `corridor_name`, `zone`, `total_distance_km` (440.0), `route_class` (`Group A (130-160 kmph)`), `electrification` (`25 kV AC 50 Hz OHE`), `signalling_type` (`Automatic Block Signalling (ABS) with Electronic Interlocking (EI)`), `tracks`, `stations[]`, `machine_fleet{}`.
- **Station record:** `code`, `name`, `km`, `lat`, `lng`, `division`, `platforms`, `speed_limit_kmph`, `depots[]`.
- **Stations (10, ordered by chainage):** `NDLS` (0.0 km, 28.6431 °N, 77.2197 °E), `GZB` (25.0), `DER` (37.0), `KRJ` (83.0), `ALJN` (131.0), `TDL` (209.0), `FZD` (226.0), `ETW` (301.0), `PHD` (357.0), `CNB` (440.0 km, 26.4547 °N, 80.3507 °E).
- **Machine fleet:** `tamping_machines` 2, `bcm_machines` 1, `tower_wagons` 3, `usfd_testing_trolleys` 4, `signal_testing_gangs` 5.
- **Optional upgrade key:** a `shape_points` array of `{km, lat, lng}` is preferred by `map_service.geometry` over the station anchors when present. This is the supported path to a real surveyed alignment; every consumer picks it up for free.

### 4.2 Station Yard Interlocking (`data/topology/station_yards.json`)
Array of 10 objects, one per station.
- **Header:** `station_code`, `station_name`, `km`, `division`, `interlocking_type`, `layout_type`, `layout_source`, `platform_count`, `track_count`, `speed_limit_kmph`.
- `tracks[]`: `{ id, label, type (mainline|platform|loop|branch|siding), y, is_main }`
- `platforms[]`: `{ number, y, x_start, x_end, side }`
- `points[]`: `{ id (e.g. "Pt-101A"), name, from_track, to_track, x1, y1, x2, y2, type (turnout|crossover|trailing) }`
- `signals[]`: `{ id, type (HOME|STARTER|ADV_STARTER), x, y, direction (UP|DN), label }`
- `ohe_masts[]`: `{ id, km, x, y, wear_pct, status }`

`GET /api/station/yard/{code}` enriches each point at request time by joining it against a real `POINT_MACHINE` row for that station, adding `asset_id`, `health_index`, `priority_tier`, `failure_probability_pct`, `throw_time_sec`, `motor_current_amps`, `insulation_mohm` and `predicted_rul_days`. Where the layout declares more points than the station has assets, healthy defaults fill in.

### 4.3 Timetable (`data/raw/ndls_cnb_real_timetable.csv`)
- **Columns:** `train_number`, `train_name`, `train_type`, `priority_class`, `delay_penalty_weight`, `direction`, `station`, `km_location`, `arrival_time`, `departure_time`, `arrival_min_of_day`, `departure_min_of_day`, `is_halt`.
- **Shape:** 290 rows, 29 distinct trains — 16 DN, 13 UP.
- **Type mix:** 9 Superfast, 7 Freight, 6 Rajdhani, 2 Shatabdi, 2 Vande Bharat, 2 Express, 1 Passenger.
- **Priority classes:** 1 premium (penalty weight 95–100), 2 superfast (60–70), 3 mail/express/passenger (30–45), 4 freight (15).

### 4.4 Unified Backlog & ML Predictions (`data/processed/ml_predictions.csv`)
1,850 rows × 71 columns. The file is sparse by design: each department fills its own diagnostic columns and leaves the others empty, so most rows carry `NaN` in most fields.
- **Identity & location:** `task_id`, `asset_id`, `department` (`ENGINEERING_TRACK` | `TRACTION_DISTRIBUTION_OHE` | `SIGNAL_AND_TELECOM`), `section_from`, `section_to`, `km_start`, `km_end`, `line` (`UP` | `DN` | `YARD`), `station`, `description`.
- **Work requirements:** `machine_required`, `power_block_required`, `disconnection_required`.
- **ML outputs:**
  - `failure_probability` (0.0–1.0) and `failure_percentage` (0–100)
  - `priority_tier`: `CRITICAL` ≥ 75%, `HIGH` 50–74%, `MEDIUM` 25–49%, `LOW` < 25%
  - `predicted_rul_days` (1–365)
  - `predicted_duration_min` (30–300)
  - `composite_criticality_score` (0.0–100.0)
- **Current distribution:** 1,079 LOW, 489 CRITICAL, 176 MEDIUM, 106 HIGH. By department: 850 track, 550 OHE, 450 S&T. By line: 868 UP, 821 DN, 161 YARD.
- **Sorted** by `composite_criticality_score` descending.

> **The `YARD` line and self-referential sections are real, not a bug.** S&T assets are station-based, so `section_from == section_to` and `line == "YARD"` for 161 rows. The fault generator excludes them from its candidate pool (no slot can host them), and the UI renders them as "`<STN>` Station Yard" rather than a nonsensical section.

### 4.5 Optimized Block Schedule (`data/processed/optimized_schedule.json`)
- **Top level:** `status` (`OPTIMAL` | `FEASIBLE`), `solver`, `corridor`, `horizon_hours`, `metrics{}`, `scheduled_blocks[]`, `deferred_blocks_count`.
- **`metrics`:** `total_blocks_scheduled`, `total_tasks_completed`, `multi_department_bundling_rate_pct`, `total_possession_hours`, `unbundled_baseline_hours`, `downtime_saved_hours`, `downtime_reduction_pct`, `passenger_train_punctuality_impact_min`, `safety_clearance_violations`.
- **Block item:** `schedule_id`, `bundle_id`, `section`, `line`, `km_range`, `start_time`, `end_time`, `duration_min`, `unbundled_duration_min`, `downtime_saved_min`, `departments[]`, `is_multi_department`, `task_count`, `tasks[]`, `descriptions[]`, `power_block_required`, `disconnection_required`, `machines[]`, `criticality_score`, `is_night_window`, `status`.
- **`end_time` may exceed 24 h** (e.g. `"25:30"`), because it is computed as `start_min + duration` without wrapping. `virtual_clock.parse_hhmm` returns the raw unwrapped minute count and callers decide how to roll it.

### 4.6 OCC Demand Queue (`data/processed/pending_demands.json`)
`{ "demands": [ … ] }`. This file is the block lifecycle's system of record.
- **Identity:** `demand_id` (`DMD-{TMS|TDMS|SMMS}-{n}`), `department`, `department_label`, `asset_id`, `defect_category`.
- **Location & work:** `section_from`, `section_to`, `line`, `km_start`, `km_end`, `machine_required`, `power_block_required`, `disconnection_required`, `gang_crew`, `duration_requested_min`, `priority`, `description`.
- **Lifecycle:** `status`, `raised_at` (real), `raised_at_sim`, `sanctioned_window`, `sanction_memo_id`, `window_start_sim`, `window_end_sim`, `window_day_label` (`TODAY` | `TOMORROW`), plus `started_at`, `completed_at`, `cancelled_at`, `cancellation_reason`, `deferral_reason` as they occur.
- **Statuses:** `PENDING_SANCTION` → `APPROVED_SHADOW_BLOCK` → `IN_PROGRESS` → `COMPLETED`, with `CANCELLED` and `DEFERRED_NEXT_CYCLE` as terminal alternatives.

### 4.7 Worker Field Reports (`data/processed/worker_requests.json`)
`{ "requests": [ … ] }`. Regenerated on every run; gitignored.
- `request_id` (`WREQ-{TRK|OHE|SIG}-{hex8}`), `department`, `department_label`, `asset_id`, `defect_category`, `section_from`, `section_to`, `section_label`, `line`, `km_start`, `km_end`, `machine_required`, `power_block_required`, `disconnection_required`, `gang_crew`, `duration_requested_min`, `priority`, `description`, `failure_percentage`, `attachments[]`, `submitted_by`, `submitted_at`, `status`, `review_note`, `reviewed_at`, `reviewed_by`.
- `attachments[]`: `{ type ("image"|"pdf"), filename, url }` pointing into `/attachments/{track|ohe|signal}/`.
- **Statuses:** `PENDING_REVIEW` → `APPROVED_FORWARDED` | `REJECTED`.

### 4.8 Event Log (`data/processed/sim_events.json`)
`{ "events": [ … ] }`, capped at the most recent 200. Gitignored.
- `seq` (monotonic integer, the frontend's high-water mark), `event_id`, `kind`, `department`, `severity` (`info` | `success` | `warning` | `danger`), `title`, `message`, `ref_id`, `sim_time`.
- **Eight kinds:** `REPORT_SUBMITTED`, `REPORT_APPROVED`, `REPORT_REJECTED`, `DEMAND_SANCTIONED`, `DEMAND_DEFERRED`, `BLOCK_STARTED`, `BLOCK_COMPLETED`, `BLOCK_CANCELLED`.

### 4.9 Map Feature Shape (`src/map_service/layers.py`)
Every layer emits the same shape, so `corridor_map.js` renders all of them generically:

```jsonc
{
  "id": "stable identifier",
  "layer": "issues | demands | blocks | powercuts | routines | assets | health | trains",
  "line": "UP | DN | YARD",
  "km_start": 0.0, "km_end": 0.0,
  "lat": 0.0, "lng": 0.0, "bearing": 0.0,          // anchor: midpoint of the chainage range
  "path": [{ "lat": 0, "lng": 0, "bearing": 0 }],  // spans only
  "severity": "CRITICAL | HIGH | MEDIUM | LOW",     // drives marker colour, uniformly
  "title": "…", "subtitle": "…",
  "detail": { }                                      // everything the hover card and inspect form need
}
```

**Screen presets (`PORTAL_LAYER_PRESETS`):**

| Department | Layers |
| :--- | :--- |
| `ENGINEERING_TRACK` | `issues`, `blocks`, `routines` |
| `TRACTION_DISTRIBUTION_OHE` | `issues`, `assets`, `powercuts` |
| `SIGNAL_AND_TELECOM` | `issues`, `health` |
| `ALL` (OCC master desk) | `demands`, `blocks` |

`demands` and `blocks` filter on **disjoint status sets**, so a record is never plotted twice: `PENDING_SANCTION` belongs to `demands`, `APPROVED_SHADOW_BLOCK`/`IN_PROGRESS` to `blocks`.

### 4.10 Corridor Geometry Document (`GET /api/map/geometry`)
`corridor_name`, `zone`, `total_distance_km`, `electrification`, `signalling_type`, `tracks`, `track_sides` (`{DN: 1.0, UP: -1.0}`), `centreline[{km, lat, lng, bearing}]` (10 vertices), `stations[]` (with `bearing` added), `sections[]` (9 entries of `{section, from, to, km_start, km_end, length_km}`).

Cacheable by the client: it changes only when the topology file does.

---

## 5. Engineering Standards & Mathematical Formulations

### 5.1 Track Geometry Index (TGI) — RDSO Lucknow
$$\text{TGI} = \frac{2 \times \text{UI} + \text{TI} + \text{GI} + 6 \times \text{AL}}{10}$$
Clipped to $[0, 100]$. Classification: $\ge 80$ `GOOD` | $50$–$79$ `AVERAGE` | $< 50$ `POOR` (mandates maintenance or TSR).

### 5.2 Contact Wire Wear — ACTM
$$\text{Wear \%} = \frac{12.24 - d_{\text{measured}}}{12.24 - 8.25} \times 100$$
For 107 mm² hard-drawn grooved copper contact wire; clipped to $[0, 100]$. Classification: $\ge 85\%$ `CONDEMN_RENEW` | $\ge 65\%$ `CRITICAL` | $\ge 40\%$ `WORN` | $< 40\%$ **`GOOD`**.

### 5.3 Point Machine Health Index — IRSEM
Normalised penalties, then weighted. This is **not** a raw-offset penalty sum:
$$p_{\text{throw}} = \mathrm{clip}\!\left(\tfrac{t - 4.0}{2.0}, 0, 1\right), \quad
p_{\text{current}} = \mathrm{clip}\!\left(\tfrac{I - 1.8}{1.7}, 0, 1\right), \quad
p_{\text{insul}} = \mathrm{clip}\!\left(\tfrac{10.0 - \min(R, 10.0)}{10.0}, 0, 1\right)$$
$$\text{Health Index} = 100 - \left(30\,p_{\text{throw}} + 40\,p_{\text{current}} + 30\,p_{\text{insul}}\right)$$
Motor current carries the heaviest weight: a friction spike means mechanical binding or ballast jamming. Tier: $< 35$ `CRITICAL` | $< 55$ `HIGH` | $< 75$ `MEDIUM` | else `LOW`.

Reference bands: throw time 4.0–5.0 s normal, $> 5.8$ s critical; peak current 1.8–2.2 A normal, $> 3.2$ A critical; insulation $\ge 10\,\text{M}\Omega$ good, $< 1.0\,\text{M}\Omega$ condemning.

### 5.4 Composite Asset Criticality Score
$$\text{Score} = \mathrm{clip}\!\left(35 P_{\text{fail}} + 25 \cdot \tfrac{365 - \text{RUL}}{365} + 20 W_{\text{route}} + 20 (C - 1) + \text{TSR}_{\text{pen}},\ 0,\ 100\right)$$
where $W_{\text{route}}$ derives from the **route class string**, not a numeric weight — `A` 1.0, `B` 0.85, `C` 0.70, `D` 0.50, unknown 0.75 — $C$ is the compounding factor (default 1.0), and $\text{TSR}_{\text{pen}} = 15$ when a temporary speed restriction is active.

### 5.5 Slot Discovery
For each of the 9 sections × 2 lines, sweeping a cursor across 1,440 minutes over sorted train occupancy intervals $[a_i, b_i]$:
$$\text{usable}_i = a_i - \text{cursor} - 10, \qquad \text{cursor} \leftarrow \max(\text{cursor},\ b_i + 10)$$
A slot spanning $[\text{cursor},\ a_i - 10]$ is emitted when $\text{usable}_i \ge 45$ minutes. **87 feasible slots** result. A slot is a night window when it starts before 05:30 or after 22:00.

### 5.6 Bundling
Partitioned by `(section_from, line)`, companions within **3.0 km**, at most **4 tasks** per bundle:
$$D_b^{\text{bundled}} = \max_{\tau \in T_b} d_\tau, \qquad D_b^{\text{unbundled}} = \sum_{\tau \in T_b} d_\tau, \qquad \text{Saved}_b = D_b^{\text{unbundled}} - D_b^{\text{bundled}}$$

> There is **no additive handover buffer** at the bundling stage. Bundled duration is exactly the maximum of the members, because the departments work concurrently inside one possession.

### 5.7 Google OR-Tools CP-SAT Formulation
**Decision variable:** $x_{b,s} \in \{0,1\}$ — bundle $b$ into slot $s$. Bundles truncated to 20 by criticality rank (priority-carrying bundles admitted first); 87 slots.

**Objective:**
$$\max \sum_{b,s} \Big( 10\,\text{Criticality}_b + 500\,\mathbb{I}_{\text{multi}}(b) + 300\,\mathbb{I}_{\text{night}}(s) + 2000\,\mathbb{I}_{\text{priority}}(b) + 800\,\mathbb{I}_{\text{upcoming}}(s) - 2 D_b^{\text{bundled}} \Big) x_{b,s}$$

**Hard constraints:**
1. At most one slot per bundle: $\sum_s x_{b,s} \le 1$
2. At most one bundle per slot: $\sum_b x_{b,s} \le 1$
3. Feasibility pinning: $x_{b,s} = 0$ unless section origin and line match and $D_s \ge D_b^{\text{bundled}}$
4. Machine fleet per slot: tamping/CSM $\le 2$, tower wagons $\le 3$
5. The 10-minute headway clearance is already baked into every slot's bounds by §5.5

**Solver budget:** 5 seconds. Status reported as `OPTIMAL` or `FEASIBLE`.

**Two objective terms that are easy to miss and load-bearing:**
- **Priority bonus (2000):** a formally raised departmental demand must outrank an unraised backlog item competing for the same slot. Without it, the new demand loses every contested slot on raw criticality and is falsely reported deferred.
- **Upcoming bonus (800):** a *soft* preference for slots still ahead on the operating clock, so an afternoon demand is offered tonight's window rather than this morning's. Deliberately soft — the model must never become infeasible late in the day.

### 5.8 Map Geometry
$$\theta = \operatorname{atan2}\!\big(\sin\Delta\lambda\cos\phi_2,\ \cos\phi_1\sin\phi_2 - \sin\phi_1\cos\phi_2\cos\Delta\lambda\big)$$
$$m_{\text{px}} = \frac{156543.03392 \cdot \cos\phi}{2^{z}}, \qquad o = \mathrm{clip}\!\left(6 \cdot m_{\text{px}},\ 3\text{ m},\ 5000\text{ m}\right)$$
Rails sit at $\theta \pm 90°$ from the centreline by $o$ metres. Chainage is located by binary search over the centreline and linearly interpolated; out-of-range values **clamp rather than raise**.

### 5.9 Virtual Clock
$$t_{\text{sim}} = \text{epoch}_{05{:}00} + \big((t_{\text{real}} - t_{\text{boot}}) \times 80\big) \bmod 86400$$
Pure function of real elapsed time. 24 simulated hours pass in ~18 real minutes.

---

## 6. Coding Guardrails & Non-Negotiable Rules

### 6.1 Environment & Dependencies
1. **Zero external paid dependencies.** Never introduce proprietary solvers (Gurobi, CPLEX) or paid APIs. Everything must run locally on free, open-source Python libraries and keyless tile servers.
2. **Python environment rule.** On this system the default interpreter lacks the project packages; always execute with `py -3.13 <script>`, or `python run_system.py`, which re-spawns itself under `py -3.13` on `ImportError`.
3. **Every heavy optional dependency degrades gracefully.** OR-Tools missing → greedy first-fit fallback. XGBoost missing → scikit-learn `GradientBoosting*`. SHAP missing or failing to build → rule-based cards only. A demo must never die because one library is absent.

### 6.2 API & Serialization
4. **Decoupled REST architecture.** The FastAPI backend must remain completely decoupled from the frontend. Endpoints stay stateless with respect to HTTP (all state lives in `src/simulator/`), and return clean JSON.
5. **Never let `NaN` reach the response.** The backlog is sparse by design, and Starlette refuses to serialise `NaN`/`inf`. Route payloads through `_scrub()` in `layers.py` or `df.replace({np.nan: None})` in `main.py`. Numpy scalars must be unwrapped too — `NpEncoder` in `ortools_scheduler.py` handles the schedule file.
6. **One construction path per record type.** `_create_pending_demand()` is the *only* way an OCC demand is built, whether raised manually or produced by approving a field report. That is why nothing downstream needed to change when the report workflow was added. Do not add a second path.
7. **Extend endpoints with optional fields, not new endpoints.** The block-request form adjusts a requisition through optional overrides on the existing approve endpoint. The plain approve button sends none of them and behaves identically.

### 6.3 Performance
8. **Spatial partitioning in bundling.** Never perform $O(N^2)$ comparisons across the whole backlog. Always partition by `(section_from, line)` first, which keeps clustering sub-second at 1,850 rows.
9. **Truncate solver input, but never silently drop a raised demand.** Bundles are cut to 20 by criticality rank; any bundle carrying a priority task is admitted first. A demand may still lose to a genuine constraint — that is an honest deferral. Losing to truncation is a bug.
10. **Lazy-load anything slow at import.** SHAP `TreeExplainer` is built on first use via `get_explainability_engine()`, never at module import. Server boot must stay instant.

### 6.4 Concurrency & State (the simulator)
11. **Hold the lock across the whole read-modify-write.** Use the `sim_state.*_unlocked()` primitives inside a single `with` block. Never read, release, then write — the daemon thread can append in between.
12. **Lock acquisition order is always `worker_requests_lock` → `demands_lock` → `events_lock`.** One order everywhere makes lock-ordering deadlock structurally impossible.
13. **Emit events outside the mutation section** where practical. Collect transitions under the lock, then emit.
14. **`RAILWAY_SIM_AUTOSTART=0` must be set before importing `src.api.main`** in any test or script that does not want the live daemon mutating state underneath it. Every test module does this.
15. **Re-read under the lock after any long operation.** CP-SAT solving takes seconds during which the generator may queue more reports; the sanction handler re-reads and touches only the demands it actually solved for.

### 6.5 Map Service Purity
16. **`map_service` is a read model. It never mutates simulator state.** A map refresh must be incapable of disturbing a demo.
17. **`geometry.py` is the single authority on chainage → WGS-84.** Everything that places something on the map goes through `position_at_km` / `path_between_km`, so the same chainage always resolves to the same point on every screen.
18. **Never emit pre-offset UP/DN coordinates from the API.** Return the centreline plus a per-vertex bearing; the parallel offset is a zoom-reactive screen-space decision made client-side. Baking metres into the API freezes that decision at the wrong end.
19. **Out-of-range chainage clamps; it does not raise.** A bad KM value must degrade to the corridor endpoint, never blank the map.
20. **A failing layer is reported, not fatal.** `build_layers()` returns an empty list plus an `errors` entry for that layer. One bad layer must never blank the map.
21. **Severity drives marker colour uniformly across every layer.** The glyph identifies the layer. Do not introduce per-layer colour schemes for markers.
22. **Layers must filter on disjoint status sets** where they describe the same underlying record, so nothing is plotted twice.

### 6.6 Domain Safety
23. **Safety precedence guardrail.** In 25 kV electrified territory, any heavy track machine (`BCM`, `CSM`, `TAMPING`, `CSM_TAMPING`) or track renewal within 2.75 m of live OHE must set `power_block_required = True`. Every `TRACTION_DISTRIBUTION_OHE` demand forces it unconditionally. Every `SIGNAL_AND_TELECOM` demand forces `disconnection_required = True` (Form S&T/T-351). These are enforced in `_create_pending_demand`, not in the UI, and are covered by `test_demand_safety_rule_enforcement`.
24. **The 10-minute headway clearance is non-negotiable** and is applied on both sides of every commercial train path during slot discovery. `safety_clearance_violations` is 0 by construction; it must stay that way.
25. **Never fabricate a window.** A demand with no feasible slot becomes `DEFERRED_NEXT_CYCLE` with an explicit reason. Never hand it another block's window.
26. **Resolve bare clock strings to absolute simulated datetimes at sanction time.** The simulated day wraps, so a block sanctioned at 03:00 for an 01:20 window belongs to tomorrow. `resolve_window` does this and the record is honestly labelled `TODAY` or `TOMORROW`.

### 6.7 Data Realism & Determinism
27. **Deterministic random seeds.** Any script that synthesises data or trains models must set explicit seeds: `np.random.seed()` and `random.seed()` per generator (42 TMS, 43 TDMS, 44 SMMS), and `random_state=42` on every split and estimator.
28. **Generated content must be grounded in real rows.** The fault generator builds every report from an actual `ml_predictions.csv` row, carrying forward tier, criticality, machine and safety flags rather than randomising them. A generated fault must be indistinguishable from a genuine backlog item.
29. **Never generate work at a location that cannot be scheduled.** The candidate pool is restricted to `(section_from, line)` pairs the slot finder can host — excluding `YARD` lines, `ALJN – TDL`, and terminal `CNB`. Every approved report must be able to reach a genuine window.
30. **Sample uniformly, not by criticality.** The dataset already skews hard toward CRITICAL and LOW; weighting would flatten the priority mix. Uniform sampling over real rows preserves the natural spread for free.
31. **Keep derived text consistent with recomputed values.** Descriptions baked in at generation time carry a stale tier; `_normalise_description` resyncs it so a review card never contradicts its own severity badge.
32. **Model withdrawal conservatively.** A block cancellation must read as a notable event, not the corridor's normal state: at most one per 90 simulated minutes, 30% probability, never the last remaining block, never one already under way.

### 6.8 Frontend
33. **Zero build step.** No bundler, no npm, no virtual DOM. Any file under `src/frontend/` must remain directly editable and reloadable during a demo. External libraries load from CDN with SRI hashes.
34. **Frontend design aesthetic.** Maintain the warm industrial control-room aesthetic (`occ_redesign.css`): a 4-tier material depth hierarchy (Level 0 canvas `#EFECE3`, Level 1 consoles `#F7F5EE`, Level 2 cards `#FFFFFF`, Level 3 elevated overlays `#FFFFFF`), 1 px borders, zero generic gradients, tactile switches, high-contrast typography with tabular numerals (`font-feature-settings: "tnum"`) so clocks, timestamps and train numbers never jitter, and dark-terminal digital sanction memos. **Never use default browser alerts in production flows.**
35. **Unified Design System Across Consoles.** All four screens (`index.html`, `tms.html`, `tdms.html`, `smms.html`) link `occ_redesign.css` to share the same surface tokens, Level 0–3 material depth hierarchy, tactile buttons, and the interactive digital Sanction Memo modal (`sanction_memo_modal`).
36. **Keyed DOM reconciliation for any polled list.** `reconcileKeyed()` matches nodes by stable ID so only genuine changes touch the DOM. Wholesale repaints make arrivals invisible and cause animation classes to replay on every poll.
37. **All motion is guarded by `@media (prefers-reduced-motion: reduce)`.** No exceptions.
38. **Move markers, never recreate them.** Train markers update via `setLatLng` so a 2-second poll reads as continuous motion.
39. **Share, don't duplicate.** The review console, the clock, the notification engine and the corridor map exist once each and are configured per screen. Three near-identical copies is the failure mode this structure exists to prevent.
40. **Station yard schematics (Option C standard).** Prominent stroke widths — 3.5 px solid navy `#0f2b5c` for mainlines, 2.5 px `#2563eb` for platform loops, 2.0 px `#475569` for branches, dashed for sidings. Authentic IRSEM point numbering (`Pt-101A`, `Pt-301A`) with beacons coloured by **ML priority tier**. Always attribute layouts transparently as *Standard IRSEM Reference Layout based on Official Station Infrastructure Data*.
41. **Modal stacking guardrail.** Leaflet map elements and canvas layers must remain isolated from modals. Modal dialogs (`yard-modal`, `disruption-modal`, `block-request-modal`, memo and attachment modals) enforce `z-index: 2000+` with a clean backdrop, preventing tile or marker bleed-through **without re-parenting DOM elements**.
42. **Call `CorridorMap.invalidateAll()` on tab switch.** Leaflet measures a hidden container as zero-size and renders grey.

### 6.9 Documentation Hygiene
43. **`data.txt` and `model.txt` are legacy prototype scratch files.** They are never imported, executed or tested, and their column vocabulary has no relationship to the 18-feature pipeline in use. Do not treat them as documentation of current behaviour, and do not wire them into anything.
44. **Numbers in documentation must be re-derived, not copied forward.** Test counts, metrics, endpoint counts and dataset shapes drift. Verify against a run before writing them down.

### 6.10 Decision Engine & Multi-Device Operations
45. **Two-Tier Hybrid Decision Pipeline:** XGBoost models asset condition and predicts continuous Remaining Useful Life (RUL), which then feeds into the deterministic RDSO composite criticality formula (`src/generator/rdso_formulas.py`), which in turn sets the objective weights for Google OR-Tools CP-SAT. Do not bypass the deterministic RDSO formula when adding new risk factors.
46. **Offline Multi-Device LAN Deployment:** The server binds `0.0.0.0:8000` to allow multi-laptop demonstration over local Wi-Fi or Ethernet switches without an internet connection. All API endpoints and asset requests must remain relative or host-inferred so client laptops never fail on hardcoded `localhost` URLs.

---

## 7. Known Structural Constraints

These are properties of the current data, not bugs. Code depends on them.

| Constraint | Consequence |
| :--- | :--- |
| `ALJN – TDL` never opens a 45-minute headway gap | No block can be scheduled there; the fault generator excludes it |
| `CNB` is the terminal station | No section starts at CNB; excluded from the candidate pool |
| 161 S&T assets sit on `line = "YARD"` | Not schedulable as corridor blocks; rendered as station yards |
| Every window ≥ 200 min starts between 06:00 and 12:00 | The clock epoch is pinned to 05:00 so the usable band is ahead of a fresh demo |
| The corridor has 10 surveyed anchors and no shape points | Alignment between stations is a straight chord until `shape_points` is supplied |
| `end_time` in the schedule may exceed 24:00 | Callers must handle unwrapped minute counts from `parse_hhmm` |
| The backlog CSV is sparse across departments | Every response path must scrub `NaN` before serialization |
