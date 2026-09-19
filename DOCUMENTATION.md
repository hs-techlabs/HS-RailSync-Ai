# Indian Railways AI Automatic Block Planning System
## Comprehensive Developer & Technical Architecture Handbook

> **Target Audience:** Software engineers, machine learning practitioners, operations research specialists, and railway systems engineers intending to understand, maintain, extend, or deploy this platform.

> **Repository:** [`srivastava-himanshu382/ABMaS`](https://github.com/srivastava-himanshu382/ABMaS) (branch `main`)
> **Verified against commit:** `bc594e7` + the uncommitted Phase 15 OCC redesign + Phase 16 Visual Design System overhaul working tree.
> **Test status:** 72 unit and integration tests, all passing (typically 5-9 s).

---

## Table of Contents
1. [Executive Summary & Domain Primer](#1-executive-summary--domain-primer)
2. [High-Level System Architecture](#2-high-level-system-architecture)
3. [Repository Directory Blueprint](#3-repository-directory-blueprint)
4. [Deep-Dive Module & File-by-File Breakdown](#4-deep-dive-module--file-by-file-breakdown)
   - [4.1 Synthetic Data & RDSO Generator Engine (`src/generator/`)](#41-synthetic-data--rdso-generator-engine-srcgenerator)
   - [4.2 Predictive Machine Learning & XAI Engine (`src/ml_engine/`)](#42-predictive-machine-learning--xai-engine-srcml_engine)
   - [4.3 Mathematical Optimization & Scheduling Engine (`src/optimizer/`)](#43-mathematical-optimization--scheduling-engine-srcoptimizer)
   - [4.4 Live Corridor Simulator (`src/simulator/`)](#44-live-corridor-simulator-srcsimulator)
   - [4.5 Corridor Map Service (`src/map_service/`)](#45-corridor-map-service-srcmap_service)
   - [4.6 REST API Layer (`src/api/`)](#46-rest-api-layer-srcapi)
   - [4.7 Operations Control Center & Department Portals (`src/frontend/`)](#47-operations-control-center--department-portals-srcfrontend)
   - [4.8 Automated Test Suite (`tests/`)](#48-automated-test-suite-tests)
   - [4.9 Bootstrap, Tooling & Legacy Artefacts](#49-bootstrap-tooling--legacy-artefacts)
5. [Mathematical Formulations & Algorithmic Details](#5-mathematical-formulations--algorithmic-details)
6. [API Route Specifications & Data Contracts](#6-api-route-specifications--data-contracts)
7. [End-to-End Workflow: Report to Executed Block](#7-end-to-end-workflow-report-to-executed-block)
8. [Frontend Architecture, Map & SVG Yard Mathematics](#8-frontend-architecture-map--svg-yard-mathematics)
9. [Concurrency, State & Determinism Model](#9-concurrency-state--determinism-model)
10. [Developer Extensibility Guide & Recipes](#10-developer-extensibility-guide--recipes)
11. [Operational Runbook & Troubleshooting](#11-operational-runbook--troubleshooting)
12. [Visual Design System & UI Polish](#12-visual-design-system--ui-polish)

---

## 1. Executive Summary & Domain Primer

### 1.1 The Operational Problem
Indian Railways (IR) operates one of the densest railway networks in the world. High-density corridors — such as the **440 KM New Delhi to Kanpur Central (NDLS–CNB)** trunk route — run at very high line-capacity utilisation, carrying premium passenger trains (Rajdhani, Vande Bharat, Shatabdi), superfast and mail/express services, a passenger service, and heavy freight rakes.

Infrastructure maintenance across Indian Railways is historically divided into three departmental silos:
1. **Civil Engineering (Track / TMS):** Track renewals, deep screening by Ballast Cleaning Machines (BCM), mechanised tamping by Continuous Action Tamping Machines (CSM), rail grinding, and Ultrasonic Flaw Detection (USFD).
2. **Electrical Traction (TRD / TDMS):** 25 kV AC Overhead Equipment (OHE) contact wire wear monitoring, neutral section overhauls, Auto Tension Device (ATD) adjustments, and isolator maintenance.
3. **Signalling & Telecommunication (S&T / SMMS):** Electronic Interlocking (EI), point machine throw-time and motor current diagnostics, track circuit health, and axle counter synchronisation.

Each department independently requests corridor shutdown windows through the **Block Demand Management System (BDMS)**. This causes:
- **Excessive track downtime:** multiple isolated closures for adjacent assets on the same track.
- **Compounding traffic delays:** fragmented closures break train headways, causing cascaded signal stops.
- **Coordination friction:** manual inter-departmental negotiation leads to rejected block demands and deferred maintenance.

### 1.2 The Solution
This system replaces fragmented manual requests with an automated, data-driven pipeline that spans the entire lifecycle of a maintenance block:

- **Digital twin ingestion:** models corridor topology (10 stations with surveyed GPS anchors, chainages, speed limits, depot machinery) and yard interlocking layouts.
- **Machine learning asset scoring:** gradient-boosted decision trees evaluate asset failure probability, Remaining Useful Life (RUL) and required possession duration, with SHAP-based explanations.
- **Google OR-Tools CP-SAT optimisation:** constraint programming clusters multi-department tasks geographically and assigns them into natural headway gaps between scheduled trains ("shadow blocks").
- **A live corridor simulator:** an accelerated clock (80× real time), a field-report generator grounded in real backlog rows, and a block lifecycle engine that walks sanctioned work through execution.
- **A four-screen operations network:** three department portals where officers triage field evidence, plus a Central Operations Control Center (OCC) that bundles and sanctions.
- **A reusable geospatial corridor map:** one Leaflet module rendering UP and DN as two distinct rails, with six live feature layers and moving trains, mounted identically on all four screens.
- **Dynamic disruption resilience:** re-optimises corridor maintenance in well under a second when trains run late or emergency defects occur.

---

## 2. High-Level System Architecture

The software is decoupled into seven layers. Data flows downward; nothing below the API layer knows the frontend exists.

```
+---------------------------------------------------------------------------------------------------+
|                                      DATA & SYNTHESIS LAYER                                       |
|  - RDSO / IRPWM / ACTM / IRSEM formulas ......................... generator/rdso_formulas.py      |
|  - Corridor timetable engine (29 trains, 290 station-stops) ..... generator/timetable_builder.py   |
|  - Synthetic telemetry synthesizers (850 / 550 / 450 assets) .... generator/generate_*_data.py     |
|  - Static master topologies ..................... ndls_cnb_corridor.json, station_yards.json       |
|  - Canned field evidence (photos + inspection PDFs) ............. scripts/generate_attachments.py  |
+-------------------------------------------------+-------------------------------------------------+
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                    PREDICTIVE & XAI ML ENGINE                                     |
|  - 18-feature standardized pipeline + StandardScaler ............ ml_engine/feature_pipeline.py    |
|  - XGBoost failure classifier   ROC-AUC 0.9751 / 91.1% accuracy . saved_models/risk_classifier     |
|  - XGBoost RUL regressor        RMSE 67.6 days .................. saved_models/rul_regressor       |
|  - Random Forest duration model RMSE 12.25 min .................. saved_models/duration_estimator  |
|  - SHAP TreeExplainer + rule-based controller cards ............. ml_engine/explainability.py      |
+-------------------------------------------------+-------------------------------------------------+
                                                  v
+---------------------------------------------------------------------------------------------------+
|                            DETERMINISTIC RDSO PRIORITY SCORING ENGINE                             |
|  - IRPWM Para 607 Track Geometry Index (TGI) .................... generator/rdso_formulas.py      |
|  - ACTM Para 20325 Contact Wire Wear & ATD limits ............... generator/rdso_formulas.py      |
|  - IRSEM Para 700 Point Machine Throw Diagnostics ............... generator/rdso_formulas.py      |
|  - Composite Criticality: 35*P(fail) + 25*RUL + 20*Route + 10*Comp + 15*TSR (0-100 codal score)    |
+-------------------------------------------------+-------------------------------------------------+
                                                  v
+---------------------------------------------------------------------------------------------------+
|                               MATHEMATICAL OPTIMIZATION ENGINE                                    |
|  - Headway gap scanner -> 87 feasible slots ..................... optimizer/slot_finder.py         |
|  - Spatial partition clustering ->  494 candidate bundles ....... optimizer/bundling_engine.py     |
|  - OR-Tools CP-SAT assignment model (+ greedy fallback) ......... optimizer/ortools_scheduler.py   |
|  - 30-day strategic & 7-day tactical planners ................... optimizer/multi_horizon.py       |
+-------------------------------------------------+-------------------------------------------------+
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                     LIVE CORRIDOR SIMULATOR                                       |
|  - Stateless 80x accelerated clock (24 h in ~18 real min) ....... simulator/virtual_clock.py       |
|  - Lock-ordered JSON persistence + sequenced event log .......... simulator/sim_state.py           |
|  - Daemon field-report generator (grounded in real rows) ........ simulator/fault_generator.py     |
|  - APPROVED -> IN_PROGRESS -> COMPLETED / CANCELLED ............. simulator/block_lifecycle.py     |
|  - Sub-second delay & emergency defect rescheduler .............. simulator/disruption_engine.py   |
+-------------------------------------------------+-------------------------------------------------+
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                     CORRIDOR MAP SERVICE                                          |
|  - Single authority: chainage (KM) <-> WGS-84, bearings ......... map_service/geometry.py          |
|  - Six pure read-model layers, one feature shape ................ map_service/layers.py            |
|  - Live train interpolation against the sim clock ............... map_service/trains.py            |
+-------------------------------------------------+-------------------------------------------------+
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                    RESTFUL API LAYER (FASTAPI)                                    |
|  - 31 JSON endpoints + 4 HTML page routes ....................... api/main.py                      |
|  - /api/map/* transport shell ................................... api/map_router.py                |
|  - Static mounts: /static (frontend), /attachments (evidence)                                     |
|  - Lazy SHAP engine loading (zero startup delay)                                                   |
+-------------------------------------------------+-------------------------------------------------+
                                                  v
+---------------------------------------------------------------------------------------------------+
|                       OPERATIONS CONTROL CENTER (OCC) + 3 DEPARTMENT PORTALS                      |
|  - OCC control-room board: 50/50 INCOMING / IN EXECUTION split .. index.html, app.js, style.css    |
|  - Shared review console (queue, evidence, approve/reject) ...... portal_review.js                 |
|  - Drop-in dual-track corridor map (all four screens) ........... corridor_map.js                  |
|  - Inspect -> prefilled requisition -> Request Block ............ block_request.js                 |
|  - Shared accelerated clock + notification toasts ............... sim_clock.js                     |
|  - Marey string chart / Gantt bundling chart .................... marey_chart.js, gantt_chart.js   |
|  - CTC schematic board / IRSEM yard interlocking SVG ............ network_map.js, yard_schematic.js|
|  - What-If disruption simulator (backup demo path) .............. simulator_ui.js                  |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. Repository Directory Blueprint

```
Railways/
├── .gitignore                          # Bytecode, venvs, ephemeral CSVs, live simulator state
├── CONTEXT.md                          # Long-term architectural invariants & non-negotiable rules
├── DOCUMENTATION.md                    # Comprehensive technical handbook (this file)
├── LICENSE                             # MIT Open-Source License
├── PROGRESS.md                         # Phase tracker & verification commands
├── README.md                           # GitHub landing documentation with visual walkthrough
├── requirements.txt                    # 14 Python dependencies
├── run_system.py                       # Bootstrap: dependency check, pipeline, Uvicorn on 0.0.0.0:8000
├── data.txt                            # LEGACY prototype scratch (Day 1 dataset exercise) — unused
├── model.txt                           # LEGACY prototype scratch (Day 2-4 RF exercise) — unused
│
├── data/
│   ├── topology/
│   │   ├── ndls_cnb_corridor.json      # 10 stations w/ GPS, chainages, speed limits, machine fleet
│   │   └── station_yards.json          # IRSEM reference yard interlocking layouts (all 10 stations)
│   ├── raw/
│   │   ├── ndls_cnb_real_timetable.csv # 29 trains, 290 station-stops across 24 h
│   │   └── temp_disrupted_timetable.csv# EPHEMERAL: delay-simulation timetable (gitignored)
│   ├── processed/
│   │   ├── tms_track_defects.csv       # 850 Civil/Track assets    (seed 42)
│   │   ├── tdms_ohe_defects.csv        # 550 Electrical/OHE assets (seed 43)
│   │   ├── smms_signal_defects.csv     # 450 S&T assets            (seed 44)
│   │   ├── unified_maintenance_backlog.csv # 1,850 merged multi-dept requisitions
│   │   ├── ml_predictions.csv          # 1,850 rows x 71 cols: risk, tier, RUL, duration, criticality
│   │   ├── optimized_schedule.json     # CP-SAT solved corridor block schedule
│   │   ├── pending_demands.json        # LIVE: OCC demand queue + full lifecycle state
│   │   ├── worker_requests.json        # LIVE: field reports awaiting/after officer review (gitignored)
│   │   ├── sim_events.json             # LIVE: sequenced notification event log (gitignored)
│   │   ├── temp_demand_preds.csv       # EPHEMERAL: backlog + urgent demands fed to CP-SAT (gitignored)
│   │   └── temp_emergency_preds.csv    # EPHEMERAL: backlog + emergency defect (gitignored)
│   ├── attachments/                    # Field evidence served at /attachments/*
│   │   ├── track/                      #   site_photo_1.png, site_photo_2.png, inspection_report.pdf
│   │   ├── ohe/                        #   same three files, OHE-styled
│   │   └── signal/                     #   same three files, S&T-styled
│   └── uploads/                        # User-uploaded custom CSV maintenance logs
│
├── docs/
│   └── assets/                         # High-resolution UI captures for the README
│       ├── occ_demand_queue.png            gis_satellite_radar.png     gis_station_popup.png
│       ├── gis_dark_mode.png               marey_diagram.png           gantt_bundling.png
│       ├── ctc_topology_map.png            yard_interlocking.png       xai_waterfall.png
│       ├── tms_portal.png                  tdms_portal.png             smms_portal.png
│       ├── whatif_simulator.png            what_if_simulator_clean_modal.png
│       └── yard_interlocking_clean_modal.png
│
├── scripts/
│   └── generate_attachments.py         # One-off matplotlib generator for data/attachments/
│
├── src/
│   ├── __init__.py
│   ├── api/
│   │   ├── __init__.py
│   │   ├── main.py                     # FastAPI app: 31 endpoints, 4 portals, CORS, static mounts
│   │   └── map_router.py               # /api/map/* transport shell over the map service
│   ├── frontend/
│   │   ├── index.html                  # Central OCC control-room board (SPA, 6 tabs)
│   │   ├── tms.html                     tdms.html                       smms.html
│   │   ├── css/
│   │   │   ├── style.css               # Base design tokens, portal branding, OCC control-room layer
│   │   │   ├── occ_redesign.css        # Warm Industrial design system, visual overhaul layer
│   │   │   └── corridor_map.css        # Map rails, markers, hover cards, toolbar, legend
│   │   └── js/
│   │       ├── app.js                  # OCC coordinator: tabs, KPIs, boards, XAI, memos, bundling
│   │       ├── sim_clock.js            # Shared accelerated clock + notification toasts
│   │       ├── portal_review.js        # Shared review console (queue, evidence, approve/reject)
│   │       ├── corridor_map.js         # Drop-in dual-track Leaflet map module
│   │       ├── block_request.js        # Inspect -> prefilled requisition -> Request Block
│   │       ├── tms_portal.js            tdms_portal.js                  smms_portal.js
│   │       ├── marey_chart.js          # 24 h time-distance string chart (Plotly.js)
│   │       ├── gantt_chart.js          # Shadow bundling comparison chart (Plotly.js)
│   │       ├── network_map.js          # CTC schematic track board
│   │       ├── yard_schematic.js       # Programmatic SVG yard interlocking renderer
│   │       └── simulator_ui.js         # What-If perturbation modal controller
│   ├── generator/
│   │   ├── __init__.py                  rdso_formulas.py                timetable_builder.py
│   │   ├── generate_tms_data.py         generate_tdms_data.py           generate_smms_data.py
│   │   └── generate_all.py
│   ├── ml_engine/
│   │   ├── __init__.py                  feature_pipeline.py             train_models.py
│   │   ├── explainability.py            predict.py
│   │   └── saved_models/
│   │       ├── risk_classifier.joblib       rul_regressor.joblib
│   │       ├── duration_estimator.joblib    scaler.joblib
│   ├── optimizer/
│   │   ├── __init__.py                  slot_finder.py                  bundling_engine.py
│   │   ├── ortools_scheduler.py         multi_horizon.py
│   ├── map_service/                    # Geospatial read models — never mutates state
│   │   ├── __init__.py                  geometry.py                     layers.py
│   │   └── trains.py
│   └── simulator/
│       ├── __init__.py                  virtual_clock.py                sim_state.py
│       ├── fault_generator.py           block_lifecycle.py              disruption_engine.py
│
└── tests/                              # 72 tests total
    ├── test_data_generator.py          #  7 — RDSO formulas & dataset synthesizers
    ├── test_system_integration.py      # 12 — ML, optimizer, speed, yard API, demand lifecycle
    ├── test_realtime_simulator.py      # 24 — clock, generator, review workflow, lifecycle, events
    └── test_map_service.py             # 29 — geometry, layers, trains, /api/map/*, overrides
```

---

## 4. Deep-Dive Module & File-by-File Breakdown

---

### 4.1 Synthetic Data & RDSO Generator Engine (`src/generator/`)

#### `rdso_formulas.py`
Implements the engineering equations mandated by Indian Railways manuals. Every public function is unit-tested in `tests/test_data_generator.py`.

| Function | Standard | Purpose |
| :--- | :--- | :--- |
| `calculate_tgi(ui, ti, gi, al)` | RDSO Lucknow | Track Geometry Index, clipped to 0–100 |
| `classify_tgi(tgi)` | RDSO | `GOOD` (≥80), `AVERAGE` (50–79), `POOR` (<50) |
| `calculate_rail_thermal_stress(rail_temp_c, destressing_temp_c=40.0)` | IRPWM Ch. 7 | Thermal delta, buckling risk band, and a `maintenance_permitted` flag |
| `calculate_wire_wear_percentage(measured, nominal=12.24, condemning=8.25)` | ACTM | Wear consumed as a percentage of the condemning margin |
| `classify_wire_wear(pct)` | ACTM | `CONDEMN_RENEW` (≥85), `CRITICAL` (≥65), `WORN` (≥40), `GOOD` (<40) |
| `calculate_point_machine_health(throw, current, insulation)` | IRSEM | Weighted 0–100 health index, priority tier, and human-readable defect reasons |
| `calculate_composite_criticality(failure_prob, rul_days, route_class, compounding_factor, tsr_active)` | Composite | 0–100 priority score consumed by the CP-SAT objective |

Two details that differ from a naive reading and matter when extending:
- **Point machine health uses normalised penalties, not raw offsets.** Each of throw time, motor current and insulation resistance is clipped to a 0–1 penalty and then weighted 30 / 40 / 30. Motor current is the heaviest single factor.
- **`calculate_composite_criticality` takes a route *class* string, not a numeric weight.** `A` → 1.0, `B` → 0.85, `C` → 0.70, `D` → 0.50, with 0.75 for anything unrecognised. TSR adds a flat +15. The TSR argument is parsed defensively so `NaN`, `"True"`, `1` and `1.0` all resolve correctly — this is what `test_safe_criticality_calculation` guards.

#### `timetable_builder.py`
Generates the master corridor timetable from a hand-curated catalogue of real Indian Railways services.

- **29 trains, 290 station-stop rows, 24 hours.** 16 DN services (New Delhi → Kanpur) and 13 UP services (Kanpur → New Delhi).
- **Composition by type:** 9 Superfast, 7 Freight, 6 Rajdhani, 2 Shatabdi, 2 Vande Bharat, 2 Express, 1 Passenger.
- **Four priority classes** with delay penalty weights: class 1 premium (weight 95–100: Rajdhani, Vande Bharat, Shatabdi), class 2 superfast (60–70), class 3 mail/express/passenger (30–45), class 4 freight (15).
- Named services include `22436` Vande Bharat, `12424` Dibrugarh Rajdhani, `12302` Howrah Rajdhani, `12314` Sealdah Rajdhani, `12004` Lucknow Swarna Shatabdi, `12566` Bihar Sampark Kranti, `12418` Prayagraj Express, `14218` Unchahar Express, plus freight paths `CONT-DN-01`, `COAL-DN-02`, `GOODS-UP-03` and others.
- Station chainages and minimum dwell times are defined by `get_station_chainages()`; running times derive from each service's average speed and halt pattern.
- Output: `data/raw/ndls_cnb_real_timetable.csv`.

#### `generate_tms_data.py` — 850 Civil/Track assets (seed 42)
Track Geometry Index components, rail wear, cumulative gross million tonnes (GMT), rail age, sleeper condition, ballast deficiency, 7-day rainfall, rail temperature, and USFD flaw status (`IMR` immediate removal, `OBS` under observation, `CLEAR`). Assigns machinery: `CSM`, `TAMPING`, `BCM`, `UNIMAT` or `MANUAL_GANG`.

#### `generate_tdms_data.py` — 550 Electrical/OHE assets (seed 43)
Contact wire diameter and derived wear percentage, height and stagger deviations, ATD counterweight position and status, cantilever insulator condition, and pantograph spark counts. Sets `tower_wagon_required`, which `generate_all.py` maps to `machine_required = "TOWER_WAGON"`.

#### `generate_smms_data.py` — 450 S&T assets (seed 44)
Station-based assets across four types: `POINT_MACHINE`, `TRACK_CIRCUIT`, `AXLE_COUNTER`, `EI_SYSTEM`. Records throw time, motor peak current, total stroke cycles and cable insulation resistance. Because these assets are station-based, their `section_from` and `section_to` are the same station code and their `line` is `YARD` for 161 of the rows — a detail the fault generator and the map both handle explicitly.

#### `generate_all.py`
Master orchestrator. Builds the timetable, generates all three department datasets at 850 / 550 / 450 samples, then compiles the unified backlog. During unification it applies the safety and normalisation rules:

- **`power_block_required` for track work** is set where the machine is `BCM`, `CSM` or `TAMPING`, or where ground-truth failure is flagged. This is the codified 25 kV safety precedence rule.
- **S&T rows** get `section_from = section_to = station`, a 100 m chainage span, `machine_required = "NONE"` and `power_block_required = False`.
- **Human-readable descriptions** are composed per department and embed the tier at generation time (later resynced by the fault generator — see §4.4).

Output: `data/processed/unified_maintenance_backlog.csv`, 1,850 rows.

---

### 4.2 Predictive Machine Learning & XAI Engine (`src/ml_engine/`)

#### `feature_pipeline.py`
Extracts an **18-dimensional feature vector** from any raw or unified maintenance record. Missing department-specific columns fall back to domain defaults through `_get_series`, which is what lets one model serve all three departments.

| # | Feature | Source column | Default | Domain |
| :-- | :--- | :--- | :--- | :--- |
| 1 | `rail_age_years` | `rail_age_years` | 5.0 | Track |
| 2 | `cumulative_gmt` | `cumulative_gmt` | 100.0 | Track |
| 3 | `tgi_composite` | `tgi_composite` | 80.0 | Track |
| 4 | `rail_temp_delta` | `abs(rail_temperature_c - 40.0)` | 40.0 | Track |
| 5 | `rainfall_mm` | `rainfall_mm_7day` | 0.0 | Track |
| 6 | `wire_wear_percentage` | `wire_wear_percentage` | 20.0 | OHE |
| 7 | `atd_deviation_mm` | `abs(atd_position_mm - 500.0)` | 500.0 | OHE |
| 8 | `pantograph_sparks` | `pantograph_spark_count_30d` | 0.0 | OHE |
| 9 | `point_throw_time_sec` | `point_throw_time_sec` | 4.2 | S&T |
| 10 | `motor_current_amps` | `motor_peak_current_amps` | 1.9 | S&T |
| 11 | `insulation_res_megohm` | `insulation_resistance_megohm` | 15.0 | S&T |
| 12 | `stroke_cycles` | `total_stroke_cycles` | 5000.0 | S&T |
| 13 | `days_since_last_maint` | `days_since_last_maintenance` | 30.0 | Common |
| 14 | `is_track_dept` | one-hot on `department` | 0 | Common |
| 15 | `is_ohe_dept` | one-hot on `department` | 0 | Common |
| 16 | `is_signal_dept` | one-hot on `department` | 0 | Common |
| 17 | `is_high_speed_section` | `max_speed_kmph >= 160` | 130.0 | Common |
| 18 | `has_active_tsr` | `speed_restriction_active` | 0 | Common |

Note that features 4 and 7 are **derived deltas**, not raw readings: rail temperature becomes its absolute deviation from the 40 °C destressing temperature, and ATD position becomes its deviation from the 500 mm mechanical midpoint. Both directions of deviation are defects, so the absolute value is the signal.

A `StandardScaler` fitted on the full 1,850-row corpus is persisted to `saved_models/scaler.joblib` and reused at inference.

#### `train_models.py`
Trains and persists three models with a deterministic 80/20 stratified split (`random_state=42`, 1,480 train / 370 test). Class balance is 621 positives out of 1,850 (33.6%).

**1. Failure risk classifier — `saved_models/risk_classifier.joblib`**
```python
XGBClassifier(n_estimators=150, max_depth=5, learning_rate=0.08,
              subsample=0.85, colsample_bytree=0.85,
              random_state=42, eval_metric="logloss")
```
Target: `ground_truth_failure` (binary). Measured performance:

| Metric | Value |
| :--- | :--- |
| ROC-AUC | 0.9751 |
| Accuracy | 91.1% |
| Precision | 0.864 |
| Recall | 0.871 |
| F1 | 0.868 |

**2. Remaining Useful Life regressor — `saved_models/rul_regressor.joblib`**
```python
XGBRegressor(n_estimators=150, max_depth=5, learning_rate=0.08, random_state=42)
```
Target: `ground_truth_rul_days`. RMSE 67.63 days, MAE 39.64 days.

**3. Block duration estimator — `saved_models/duration_estimator.joblib`**
```python
RandomForestRegressor(n_estimators=100, max_depth=8, random_state=42)
```
Target is **computed deterministically inside the training script**, not read from the dataset. Base duration comes from the machine and department (BCM 240 min, CSM/TAMPING 180, OHE/tower wagon 150, S&T 60, otherwise 120), then adjusted by track geometry, wire wear and section length, and clipped to 30–300 minutes. RMSE 12.25 min, MAE 7.06 min.

**Graceful degradation:** if `xgboost` is not importable, the classifier and RUL regressor silently fall back to scikit-learn `GradientBoostingClassifier` / `GradientBoostingRegressor` with matching hyperparameters. The pipeline still runs end to end; only the reported model name changes.

#### `predict.py`
Batch inference. Reads `unified_maintenance_backlog.csv`, extracts and scales features, then writes `ml_predictions.csv` (1,850 rows × 71 columns) with:
- `failure_probability` (0–1) and `failure_percentage` (0–100)
- `priority_tier` thresholded on the percentage: `CRITICAL` ≥ 75, `HIGH` ≥ 50, `MEDIUM` ≥ 25, `LOW` below
- `predicted_rul_days`, clipped to 1–365
- `predicted_duration_min`, clipped to 30–300
- `composite_criticality_score`, computed per row through `calculate_composite_criticality`

Rows are sorted by criticality descending. Current tier distribution: 1,079 LOW, 489 CRITICAL, 176 MEDIUM, 106 HIGH.

#### `explainability.py`
`ExplainabilityEngine` loads the classifier and scaler, and attempts to build a `shap.TreeExplainer`. Two behaviours worth knowing:

- **SHAP is optional and failure-tolerant.** If `shap` is missing, or `TreeExplainer` construction raises, `self.explainer` stays `None` and the engine still works.
- **The controller card is rule-based, not SHAP-derived.** `explain_asset()` returns the model's probability and tier, but the `primary_risk_drivers` list is generated by department-specific domain rules — USFD `IMR` status, TGI below 55, cumulative tonnage past the 500 GMT codal limit, wire wear past 70%, ATD at its mechanical limit, throw time over 5.5 s, motor current over 3.0 A. When no rule fires it reports a routine cycle. This is deliberate: the cards must read as an inspector would write them, and they must never be empty.

The engine is **lazily constructed** by `get_explainability_engine()` in `src/api/main.py`, so server boot never pays the SHAP initialisation cost.

---

### 4.3 Mathematical Optimization & Scheduling Engine (`src/optimizer/`)

#### `slot_finder.py`
`find_available_corridor_slots(timetable_csv=None, min_block_duration_min=45, night_window_bonus=True)` scans the 24-hour timetable for train-free windows.

- Walks the 9 corridor sections × 2 lines (UP, DN).
- Groups timetable rows by train to derive each service's entry and exit minute in the section, rolling forward past midnight where needed.
- Sweeps a timeline cursor across 1,440 minutes. For each gap, **usable duration = gap − 10 minutes** of safety clearance, and the cursor advances to `train_end + 10`. A slot qualifies only if the usable duration is at least 45 minutes.
- Marks a slot as a **night window** when it starts before 05:30 or after 22:00, and scores it 95 (night), 90 (final gap to midnight) or 75 (daytime).
- **Produces 87 feasible slots** on the current timetable.

Two consequences the rest of the system depends on: `ALJN – TDL` never opens a 45-minute gap, and `CNB` is terminal so no section starts there. The fault generator restricts its candidate pool accordingly (§4.4).

#### `bundling_engine.py`
`cluster_maintenance_tasks(df_predictions, max_km_radius=3.0)` performs spatial clustering.

- Sorts by criticality, then **partitions by `(section_from, line)`** so clustering never degrades to an O(N²) sweep of the whole backlog.
- Within a partition, each unassigned task seeds a bundle and absorbs companions whose chainage ranges are within 3.0 km, preferring cross-department companions, capped at **4 tasks per bundle**.
- Bundled duration is the **maximum** of the member durations — departments work concurrently inside one possession. There is no added handover buffer at this stage.
- Unbundled baseline is the **sum** of member durations; the difference is the recorded saving.
- Merges `power_block_required` and `disconnection_required` with a logical OR across members, and collects the union of required machines.
- Produces **494 candidate bundles** from the 1,850-row backlog, sorted by summed criticality.

#### `ortools_scheduler.py`
`ORToolsBlockScheduler` formulates block assignment as a CP-SAT problem.

**Constructor:** `ORToolsBlockScheduler(timetable_csv=None, predictions_csv=None, priority_task_ids=None)`. The `priority_task_ids` set is what makes freshly raised departmental demands survive truncation — see below.

**Bundle admission (`_select_top_bundles`).** CP-SAT does not need all 494 candidates, so they are truncated to `max_blocks` (default 20) by criticality rank. A single new demand scores ~95 while the cut-off sits above 350, so plain truncation would discard it before the solver ever looked at it and then report it "deferred" without a window having been considered. Any bundle carrying a priority task is therefore admitted first, with the remainder filling the headroom.

**Decision variables:** `X[b, s] ∈ {0,1}` — bundle `b` assigned to slot `s`, over 20 bundles × 87 slots.

**Hard constraints:**
1. At most one slot per bundle: `Σ_s X[b,s] ≤ 1`
2. At most one bundle per slot: `Σ_b X[b,s] ≤ 1`
3. Feasibility pinning: `X[b,s] = 0` unless the section origin matches, the line matches, and `slot.duration_min ≥ bundle.bundled_duration_min`
4. Machine fleet capacity per slot: tamping/CSM machines ≤ 2, tower wagons ≤ 3

**Objective coefficient** for each `(b, s)` pair:

```
coef =  round(criticality_b × 10)
      + 500   if bundle b is multi-department
      + 300   if slot s is a night window
      + 2000  if bundle b carries a formally raised priority task
      + 800   if now_min_of_day is given and slot s starts at or after it
      -   2 × bundled_duration_min
```

The last two terms deserve emphasis because they are absent from any naive reading of the model:
- The **priority bonus (2000)** means a demand a department has formally raised outranks an unraised backlog item competing for the same slot. Without it the new demand loses every contested slot on raw criticality.
- The **upcoming-window bonus (800)** is a *soft* preference for slots still ahead on the operating clock, so a demand raised in the afternoon is offered tonight's window rather than this morning's. It is deliberately soft: the model can never become infeasible late in the day.

**Solver settings:** `max_time_in_seconds = 5.0`. Status is reported as `OPTIMAL` or `FEASIBLE`.

**Greedy fallback.** If `ortools` is not importable, `_solve_greedy()` runs a first-fit heuristic over the same bundles and slots and returns an identically shaped payload with `solver: "Greedy Heuristic Fallback"`. Nothing downstream needs to change.

**Benchmark on the current backlog:**

| Metric | Value |
| :--- | :--- |
| Status | OPTIMAL |
| Blocks scheduled | 6 |
| Tasks completed | 33 |
| Multi-department bundling rate | 100.0% |
| Total possession | 21.07 hours |
| Unbundled baseline | 99.10 hours |
| Downtime saved | 78.03 hours |
| Downtime reduction | 78.7% |
| Deferred bundles | 14 |
| Passenger punctuality impact | 0 min |

Output is persisted to `data/processed/optimized_schedule.json` through a custom `NpEncoder` that serialises NumPy scalar types.

#### `multi_horizon.py`
Two planners, both reading `ml_predictions.csv`.

- **`generate_monthly_strategic_plan()`** selects heavy-renewal candidates (RUL ≤ 60 days, or tier CRITICAL/HIGH), takes the top 40, and allocates them across four weeks by RUL urgency (≤10 d → Week 1, ≤22 d → Week 2, ≤38 d → Week 3, else Week 4), rebalancing to the least-loaded week once any week reaches 12 projects. Returns `weekly_allocations` plus a `resource_projection` of tamping, tower wagon and BCM machine-days.
- **`generate_weekly_tactical_plan()`** takes the top 35 CRITICAL/HIGH/MEDIUM tasks and round-robins them across Monday–Sunday, assigning every third task to the night window (01:00–04:30) and the rest to the mid-day window (11:00–13:30). Gangs are named `Gang A`–`Gang F` per originating depot. Returns `schedule_matrix` keyed by day name plus a `coordination_kpi` block.

> **Naming note:** the weekly function is `generate_weekly_tactical_plan`, not `..._matrix`. `src/api/main.py` imports it under that exact name.

---

### 4.4 Live Corridor Simulator (`src/simulator/`)

This package is what turns a static dataset into a live workflow. It is the newest and least self-evident subsystem, so it is documented in depth.

#### `virtual_clock.py` — the shared accelerated clock
Every screen and every backend component reads simulated time from here.

- **Stateless by construction.** `sim_now()` is a pure function of real elapsed time since process start. No thread, no persisted counter, nothing to desynchronise.
- **`MULTIPLIER = 80.0`** — one real second is 80 simulated seconds, so 24 simulated hours pass in about 18 real minutes. The simulated day wraps at 24 h, so a long demo never runs out of day.
- **The epoch is pinned to 05:00 at import time**, and this is not arbitrary. On this timetable every train-free window long enough to host a real maintenance block (≥ 200 min) starts between 06:00 and 12:00; the corridor has no long night or afternoon gaps. Booting at 05:00 leaves the entire usable band ahead of the clock, so a report approved in the first minute of a demo gets a window later the same simulated day and starts executing within a couple of real minutes.

Helper functions:
- `parse_hhmm(hhmm)` returns raw minutes-of-day **without wrapping**, because the scheduler computes end times as `start + duration` and may legitimately emit `"25:30"`.
- `next_occurrence(hhmm, after=None)` resolves a bare clock string to the next absolute datetime at or after a reference point.
- `resolve_window(start_hhmm, end_hhmm, after=None)` resolves a window pair, guaranteeing the end follows the start even across midnight.

#### `sim_state.py` — locks, persistence and the event log
The single owner of all mutable simulator state, so the daemon thread and the request handlers never import each other.

**Three JSON stores**, each a `{key: [...]}` document:

| File | Key | Contents |
| :--- | :--- | :--- |
| `data/processed/worker_requests.json` | `requests` | Field reports and their review outcome |
| `data/processed/pending_demands.json` | `demands` | OCC demand queue and full block lifecycle state |
| `data/processed/sim_events.json` | `events` | Sequenced notification log, capped at 200 |

**Two concurrency rules, and they are absolute:**
1. Every multi-step read-modify-write holds its lock for the *whole* operation. Never read, release, then write — the background thread can append in between. The `*_unlocked()` primitives exist precisely so a caller can hold one `with` block across an entire sequence.
2. When more than one lock is needed the acquisition order is always **`worker_requests_lock` → `demands_lock` → `events_lock`**. One order everywhere means no lock-ordering deadlock is possible.

**Shared department identity** (`DEPT_PREFIX`, `DEPT_LABEL`) lives here so demand IDs, display labels and event routing can never drift apart across the generator, the lifecycle engine and the API.

**Event log.** `emit_event(kind, title, message, department, severity, ref_id)` appends one record carrying a monotonically increasing `seq`. The frontend uses `seq` as a high-water mark so each page only toasts events it has not already shown. Eight event kinds are defined:

`REPORT_SUBMITTED`, `REPORT_APPROVED`, `REPORT_REJECTED`, `DEMAND_SANCTIONED`, `DEMAND_DEFERRED`, `BLOCK_STARTED`, `BLOCK_COMPLETED`, `BLOCK_CANCELLED`.

#### `fault_generator.py` — the field-report daemon
Manufactures worker-submitted field reports so the corridor keeps producing new maintenance evidence for as long as the server is up.

**Grounded, not invented.** Every report is built from a real row of `ml_predictions.csv` — the same file the ML engine and the scheduler consume. Priority tier, criticality, machine requirement, safety flags and location are carried forward rather than randomised, so a generated fault is indistinguishable from a genuine backlog item.

**Candidate pool restriction (`_load_schedulable_combos`).** The pool is filtered to `(section_from, line)` pairs the slot finder can actually host a block on. Without this filter the generator would happily raise reports against the 161 `YARD`-line signal assets, against `ALJN – TDL` which never opens a gap, and against terminal `CNB` — producing demands the solver can never place. Restricting the pool up front means every report an officer approves can reach a genuine sanctioned window.

**Selection policy (`_pick_candidate`).** Uniform sampling over real rows, deliberately *not* criticality-weighted: the dataset already skews hard toward CRITICAL and LOW, so weighting would make almost every report CRITICAL and flatten the priority mix. Assets already open (pending review, or pending/approved/in-progress as a demand) are excluded. Spatial de-clustering enforces **8 km minimum separation per department** — two track faults should not pile onto the same kilometre, but a track fault and an OHE fault sitting close together is exactly the co-located scenario the bundler exists to solve, so cross-department proximity is left alone. Spacing is a preference, never a blocker: if no well-spaced candidate is found, the first candidate is used rather than stopping generation.

**Report construction.** `_derive_defect_category` maps each department's own diagnostic columns to a human-readable label (USFD status and TGI category for track, wire and ATD status for OHE, asset type for S&T). `_normalise_description` rewrites the tier embedded in the dataset's pre-baked description text, because that text was written at generation time while `priority_tier` was recomputed later by ML inference — 260 of 450 signal rows carry a stale `Tier: LOW` while the model now says `HIGH`, and left alone the review card would visibly contradict its own severity badge. Each report attaches 1–2 site photos plus an inspection PDF from `data/attachments/{track,ohe,signal}/`.

**Pacing.** Each department is due once 25–40 simulated minutes have passed since its own most recent report, derived by scanning existing records rather than holding separate scheduler state — so a restart resumes correctly. The loop sleeps 20–40 real seconds, which is the same interval at 80×. Cold start emits immediately so queues are never empty.

**Daemon control.** `start()` is guarded by a module-level flag so re-importing never spawns a second generator. `src/api/main.py` calls it on boot **unless `RAILWAY_SIM_AUTOSTART=0`** — which every test module sets before importing the API, so the daemon never mutates state underneath an assertion.

#### `block_lifecycle.py` — sanctioned blocks under execution
Walks approved demands through real execution as the clock advances:

```
APPROVED_SHADOW_BLOCK ──(clock reaches window start)──> IN_PROGRESS
                      ──(clock passes window end)─────> COMPLETED
                      ──(control office withdrawal)───> CANCELLED
```

**Withdrawal policy.** Cancellation mirrors a real control office: a sanctioned block is withdrawn because a late-running superfast needs the path, a machine is unavailable, or the weather turns. Seven reason strings model these. It is deliberately conservative so a withdrawal reads as a notable event rather than the normal state of the corridor:

| Guard | Value | Rationale |
| :--- | :--- | :--- |
| `MIN_CANCEL_GAP_SIM_MIN` | 90 | At most one withdrawal per 90 simulated minutes |
| `CANCEL_PROBABILITY` | 0.30 | And even then, only sometimes |
| `MIN_UPCOMING_TO_CANCEL` | 2 | Never withdraw the last remaining block |
| `MIN_LEAD_SIM_MIN` | 20 | Give a block a chance to actually start |

Work already under way is never un-sanctioned.

**`live_state(demand, now)`** derives display-time execution state — progress percentage through the window, and minutes until start — and is pure: it persists nothing. Both `/api/live/board` and the map's `blocks` layer call it, which is why the map and the OCC execution board can never disagree about whether a block is running.

`_sim_minutes_since` accounts for the simulated day wrapping, so elapsed-time comparisons stay correct across midnight.

#### `disruption_engine.py` — What-If perturbation solver
- **`simulate_train_delay(train_number, delay_minutes)`** shifts the named train's arrival and departure minutes, rewrites the formatted time strings, saves `data/raw/temp_disrupted_timetable.csv`, and re-solves against that timetable. Returns `solver_time_seconds`, a resolution summary and the full updated schedule. Returns an `error` key if the train number is not on the corridor.
- **`simulate_emergency_defect(section, line, km, department)`** synthesises a maximum-criticality (100.0) emergency record with a 90-minute duration, prepends it to the backlog as `data/processed/temp_emergency_preds.csv`, and re-solves so the emergency lands in the nearest feasible slot while passenger paths stay intact.

Both complete in well under a second; `test_disruption_simulator_speed` asserts sub-second recovery.

---

### 4.5 Corridor Map Service (`src/map_service/`)

A self-contained geospatial service owning two things the rest of the system deliberately does not.

#### `geometry.py` — the single authority on "where is KM 173.5?"
Every map feature resolves its position through this module, so a track defect, an OHE mast and a sanctioned block at the same chainage always land on the same spot.

**Public surface:**

| Function | Returns |
| :--- | :--- |
| `haversine_m(lat1,lng1,lat2,lng2)` | Great-circle distance in metres |
| `bearing_deg(lat1,lng1,lat2,lng2)` | Initial bearing, degrees clockwise from true north |
| `destination_point(lat,lng,bearing,distance_m)` | The point that far along that bearing |
| `load_topology()` / `stations()` | Cached topology; stations ordered by chainage |
| `corridor_length_km()` | Total corridor length |
| `position_at_km(km)` | `{lat, lng, bearing, km}` — clamps out-of-range chainage rather than raising |
| `path_between_km(start, end)` | Span polyline including intermediate vertices |
| `offset_path(path, side, distance_m)` | A path shifted perpendicular by a signed distance |
| `sections()` / `section_km_range(from, to)` / `nearest_station(km)` | Section index helpers |
| `corridor_geometry()` | The full document served at `/api/map/geometry` |

**Two deliberate non-features**, both load-bearing:

1. **No parallel-offset coordinates are emitted.** UP/DN separation is a *visual* concern that must react to zoom — 5 metres of real track spacing is invisible at zoom 8 and correct at zoom 17 — so the offset is applied client-side against the centreline plus the per-vertex `bearing` this module supplies. Baking a fixed metre offset into the API would freeze that decision at the wrong end.
2. **No smoothing or curve fitting.** The corridor is stored as 10 surveyed station anchors, so between stations the alignment is a straight chord. `_load_centreline` prefers a `shape_points` array in the topology file when present — that is the upgrade path to a real surveyed alignment, and every consumer picks up the better geometry for free.

**Track side convention:** `DN_SIDE = +1.0` (right of the NDLS→CNB bearing), `UP_SIDE = -1.0` (left of it), which is how a CTC board reads.

#### `layers.py` — six pure read models, one feature shape
Every layer reads live simulator state or the ML backlog, resolves chainage through `geometry`, and returns features in one common shape that `corridor_map.js` renders generically:

```jsonc
{
  "id":       "stable identifier",
  "layer":    "which layer produced it",
  "line":     "UP" | "DN" | "YARD",
  "km_start": 0.0, "km_end": 0.0,
  "lat": 0.0, "lng": 0.0, "bearing": 0.0,   // anchor at the midpoint of the range
  "path":     [{ "lat": 0, "lng": 0, "bearing": 0 }],  // spans only
  "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "title":    "…", "subtitle": "…",
  "detail":   { }   // everything the hover card and the inspect form need
}
```

| Layer | Screen | Source | Notes |
| :--- | :--- | :--- | :--- |
| `issues` | TMS / TDMS / SMMS | Worker reports at `PENDING_REVIEW` | Carries the entire report in `detail`, attachments included, so the Inspect form opens with no round trip |
| `demands` | OCC | Demands at `PENDING_SANCTION` | Same records `/api/demand/pending` serves the INCOMING queue |
| `blocks` | TMS, OCC | Demands at `APPROVED_SHADOW_BLOCK` or `IN_PROGRESS` | Severity escalates to `CRITICAL` while running; merges `block_lifecycle.live_state` |
| `powercuts` | TDMS | `blocks` filtered on `power_block_required` | A power cut is a property of a block, not a separate record |
| `routines` | TMS | Backlog maintenance history | Periodicity 90 d track / 120 d OHE / 60 d S&T, 21-day horizon, limit 40, sorted by urgency |
| `assets` | TDMS | Backlog, ranked by criticality | Wear window `NOW` (RUL ≤ 30 d), `NEAR_TERM` (≤ 90 d), `PLANNED`; limit 60 |
| `health` | SMMS | Backlog S&T rows | One span per section; grade `CRITICAL` < 45, `HIGH` < 60, `MEDIUM` < 75, else `LOW` |

**`demands` and `blocks` filter on disjoint status sets**, so nothing is ever plotted twice: a report at `PENDING_REVIEW` is still the department's business and belongs on the portal maps; once raised it appears as a demand; once sanctioned it graduates to a block.

**Screen presets (`PORTAL_LAYER_PRESETS`):**

| Department | Layers |
| :--- | :--- |
| `ENGINEERING_TRACK` | `issues`, `blocks`, `routines` |
| `TRACTION_DISTRIBUTION_OHE` | `issues`, `assets`, `powercuts` |
| `SIGNAL_AND_TELECOM` | `issues`, `health` |
| `ALL` (OCC master desk) | `demands`, `blocks` |

The OCC preset is deliberately the narrowest of the four: the OCC deals in sanctioned work and the requisitions queued for sanction, never in the ground-level reports and condition readings the departments triage on their own portals.

**Failure isolation.** `build_layers()` catches per-layer exceptions and reports them as an `errors` entry with an empty feature list, rather than failing the whole response. One bad layer should never blank the map during a live demo.

**JSON safety.** `_scrub()` recursively converts `NaN`, `inf`, NumPy scalars and pandas `NaT` to `null`. The backlog CSV is sparse by design — each department fills its own diagnostic columns and leaves the others empty — so a row read through pandas carries `NaN` in most fields, and Starlette refuses to serialise that.

#### `trains.py` — live train positions
`live_trains()` interpolates all 29 timetabled trains between their bracketing stops against the accelerated clock. Each feature carries `km`, `lat`, `lng`, `bearing`, `heading`, `state`, `speed_kmph`, `from_station`, `next_station` and class metadata. Trains outside their running window are omitted. Because `corridor_map.js` moves markers with `setLatLng` rather than recreating them, a 2-second poll reads as continuous motion.

---

### 4.6 REST API Layer (`src/api/`)

#### `main.py`
FastAPI application (`title="Indian Railways AI Automatic Block Planning System"`, `version="1.0.0"`) exposing **31 JSON endpoints and 4 HTML page routes**.

**Application setup:**
- Permissive CORS (`allow_origins=["*"]`) for LAN field terminals.
- `/static` → `src/frontend/` (StaticFiles)
- `/attachments` → `data/attachments/` (StaticFiles) — nothing under `data/` was web-servable before this mount.
- `include_router(map_router)` mounts the Corridor Map Service at `/api/map/*`.
- Module-level singletons: `ORToolsBlockScheduler`, `DisruptionSimulator`, and a lazily built explainability engine.
- `fault_generator.start()` on import, gated by `RAILWAY_SIM_AUTOSTART`.

**Page routes:** `GET /` (OCC), `GET /tms`, `GET /tdms`, `GET /smms`.

**Corridor & schedule:**
- `GET /api/corridor/topology` — 10 stations, GPS anchors, machine fleet
- `GET /api/corridor/timetable` — all 290 station-stop rows, `NaN` scrubbed
- `GET /api/schedule/optimal` — CP-SAT daily schedule and metrics
- `GET /api/schedule/weekly` — 7-day tactical matrix and coordination KPIs
- `GET /api/schedule/monthly` — 30-day strategic macro plan

**Assets & explainability:**
- `GET /api/assets/health?department=&limit=100` — tier counts plus asset records; runs inference on demand if predictions are missing
- `GET /api/assets/explain/{asset_id}` — controller justification card, with a static fallback if the engine cannot load

**Station yard:**
- `GET /api/station/yard/{station_code}` — the IRSEM layout enriched at request time: each turnout is joined against a real S&T point machine record (throw time, motor current, insulation, health index, tier, predicted RUL), falling back to healthy defaults when the yard defines more points than the station has assets. Also returns any scheduled blocks touching that station.

**Demand queue (OCC):**
- `POST /api/demand/raise` — manual override path. No portal UI calls this any more, but it still works and is covered by tests.
- `GET /api/demand/pending` — pending demands plus `total_unbundled_hours`
- `GET /api/demand/status/{department}` — filtered by department code or `ALL`
- `GET /api/demand/history` — full audit trail, newest first
- `POST /api/demand/clear` — reset the queue
- `POST /api/demand/bundle_and_sanction` — the core OCC action, detailed below

**Live simulator:**
- `GET /api/clock/now` — simulated time, real time, multiplier
- `GET /api/worker_requests/pending?department=` — reports awaiting review
- `GET /api/worker_requests/history?department=&limit=15` — recently reviewed
- `POST /api/worker_requests/{id}/approve` — forwards to the OCC as a demand
- `POST /api/worker_requests/{id}/reject` — never reaches the OCC
- `POST /api/worker_requests/clear` — reset the report queue
- `POST /api/simulator/reset` — clean slate: reports, demands and notifications
- `GET /api/events/feed?department=&after_seq=0&limit=30` — notification feed
- `GET /api/live/board` — the live execution board

**Disruption & ingestion:**
- `POST /api/simulate/delay`, `POST /api/simulate/defect`
- `GET /api/memos/bdms/{schedule_id}` — formatted Block Sanction Memorandum
- `POST /api/upload/csv` — ingest a custom backlog, re-score and re-solve

**Corridor map (via `map_router.py`):**
- `GET /api/map/geometry`, `GET /api/map/layers?department=&layers_csv=`, `GET /api/map/trains`, `GET /api/map/presets`

##### `_create_pending_demand` — one shared construction path
Both the manual raise endpoint and worker-report approval call this single function, so an approved field report produces exactly the same record shape the manual form did. That is why nothing downstream — the bundling engine, the OCC console, the memo generator — needed to change when the report workflow was added.

It also enforces the **safety precedence rules** in one place:
- `power_block_required` is forced true for any `TRACTION_DISTRIBUTION_OHE` demand, or when the machine is in `{BCM, CSM, TAMPING, CSM_TAMPING}` (all three dataset spellings are covered).
- `disconnection_required` is forced true for any `SIGNAL_AND_TELECOM` demand.

Demand IDs are formed as `DMD-{TMS|TDMS|SMMS}-{n}`.

##### `POST /api/demand/bundle_and_sanction` — the OCC's core action
1. Reads pending demands. With none pending, re-solves the base schedule and returns `NO_PENDING`.
2. Converts each pending demand into an urgent prediction record (failure probability 0.95 / 0.75 and criticality 95 / 80 by priority) and prepends it to the ML backlog as `temp_demand_preds.csv`.
3. Instantiates a scheduler with `priority_task_ids` set to the pending demand IDs, and solves with `now_min_of_day` taken from the simulated clock.
4. **Re-reads demands under the lock**, because solving takes seconds during which the generator may have queued more reports. Only the demands actually solved for are touched.
5. Matches each demand to a block that either lists its task ID or covers the same section and line, then resolves the bare `"HH:MM"` window into absolute simulated datetimes via `resolve_window`, so the lifecycle engine survives the simulated day wrapping and a window already past today is honestly labelled `TOMORROW` rather than silently expiring.
6. Unmatched demands become `DEFERRED_NEXT_CYCLE` with an explicit reason, rather than being handed some other block's window.
7. Emits `DEMAND_SANCTIONED` / `DEMAND_DEFERRED` events and persists the new schedule to `optimized_schedule.json`.

##### `ReviewRequest` overrides
Approval accepts an optional body where every field past `reviewed_by` is an officer edit made on the block-request form: `duration_requested_min`, `priority`, `machine_required`, `gang_crew`, `description`, `power_block_required`, `disconnection_required`. They are all optional on purpose — the plain approve button in `portal_review.js` sends none of them and behaves exactly as before, while the map's Inspect → Request Block form can adjust the requisition without needing a second endpoint. Officer edits win; untouched fields fall back to what the field report said.

##### `GET /api/live/board`
Combines two different kinds of state:
- **Blocks** from `optimized_schedule.json`, whose execution status is *derived* per request by `_block_exec_state` against the current simulated day (these are a recurring daily plan, so their window is resolved against today rather than rolled forward).
- **Demands** from the persisted queue, whose lifecycle status is *stored* and advanced by `block_lifecycle.tick()`.

Returns both plus `status_counts`.

---

### 4.7 Operations Control Center & Department Portals (`src/frontend/`)

#### `index.html` + `app.js` + the OCC layer of `style.css`
The Central OCC screen was rebuilt (Phase 15) for a control room under sustained load.

**Layout, top to bottom:**

| Band | Height | Contents |
| :--- | :--- | :--- |
| Header | 44 px | IR crest, title, corridor tag, accelerated clock, TMS/TDMS/SMMS chips, simulator and reset icons |
| KPI line | 26 px | Downtime saved, bundled rate, punctuality, critical count, optimiser status |
| Operations board | 50/50 split | `INCOMING` and `IN EXECUTION`, each scrolling independently |
| Tabs | 46 px | Six panes with keyboard shortcuts `[1]`–`[6]` |

**The fixed 50/50 split** is the central design decision: a burst of arrivals can never push the execution board off screen. Below 1180 px the split collapses to a single column with each half capped at 60 vh.

**Keyed DOM reconciliation (`reconcileKeyed`)** underpins both boards. They previously repainted wholesale on every 5-second poll, which is why arrivals were invisible and why an animation class alone would have replayed on every poll. Nodes are now matched by demand ID, so only genuine changes touch the DOM — which is what makes entry, progress and withdrawal animations meaningful.

**Motion on live change**, all guarded by `@media (prefers-reduced-motion: reduce)`: arriving demands slide in with a department accent flash and an amber wash that fades to rest; the count numeral pops; blocks entering execution animate in and then pulse; progress bars animate their width; withdrawals shake and reveal their reason.

**Six tabs:**
1. **Marey** — 24-hour time-distance string chart
2. **Gantt** — multi-department shadow bundling and savings
3. **Network** — corridor map, with a toggle between the geospatial Corridor Map and the CTC schematic board
4. **Assets** — ML risk table with live search and SHAP-style XAI cards
5. **Horizon** — weekly tactical matrix and monthly strategic plan
6. **Memo** — BDMS sanction memorandum viewer and printer

**Polling:** `/api/demand/pending` and `/api/live/board` every 5 s; the clock and notification feed every 5 s via `sim_clock.js`; map layers every 5 s and trains every 2 s via `corridor_map.js`.

**Boot sequence** (`DOMContentLoaded`): clock → keyboard shortcuts → notifications → corridor map → topology → schedule → assets → pending demands → execution board → weekly horizon.

#### `sim_clock.js` — shared clock and notifications
Loaded by all four screens so every one reads the same corridor clock and event stream.

- The clock **polls every 5 s but renders every second**, interpolating locally with the server's multiplier. Polling alone would make the badge jump about 6.7 simulated minutes at a time instead of ticking.
- `initNotifications(department, onEvents)` polls `/api/events/feed` with a `seq` high-water mark and raises toasts, so each page only ever surfaces events it has not already shown.
- `showToast(severity, title, message, icon)` renders into a lazily created toast stack.

#### `portal_review.js` — shared review console & digital sanction memo
The three portals differ only in department code, accent colour and a couple of table columns, so the entire worker-report review workflow lives here once: pending queue, evidence lightbox, approve/reject, and recently-reviewed history. Each portal calls `initPortalReview({department, prefix, onChange})` and keeps only its own requisitions table and memo code.

**Six demand statuses** are rendered with distinct badges: `PENDING_SANCTION`, `APPROVED_SHADOW_BLOCK`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` (withdrawn by control), `DEFERRED_NEXT_CYCLE` (no window available, shown with its reason).

**Digital Block Sanction Memorandum Modal (`openSanctionMemoModal`):**
Directly bound to the interactive "Sanction Memo" button rendered for every approved or in-progress corridor block across the departmental tables. Generates an authentic, dark-terminal styled BDMS Block Sanction Memorandum (BDMS Form IR-BLK-104) complete with:
- Unique Sanction Reference Number (`SAN-NDLS-CNB-...`)
- Circular red Section Controller seal (`SANCTIONED · CHIEF CONTROLLER OCC`)
- Machine fleet allocation (BCM, CSM, Tower Wagons)
- Traction 25 kV AC isolation permit numbers and S&T/T-351 disconnection slips
- Timetable protection boundaries and speed restriction clearances
- One-click native print and document export formatting

#### `corridor_map.js` — the drop-in dual-track map
One implementation shared by all four screens:

```javascript
CorridorMap.mount("#corridor-map", {
    department: "ENGINEERING_TRACK",
    layers: ["issues", "blocks", "routines"],
    onInspect: openBlockRequestForm
});
```

**Mount options:** `department` (default `"ALL"`), `layers` (`null` → the server-side preset), `basemap` (`"satellite"` | `"dark"`), `pollMs` (5000), `trainPollMs` (2000), `tall`, `showTrains`, `onInspect`.

**Module API:** `CorridorMap.mount()`, `CorridorMap.instances`, `CorridorMap.invalidateAll()`. State is held per instance, so more than one map can live on a page.

**Basemaps** (no API key required): ESRI World Imagery (max zoom 18) and CartoDB Dark Matter (max zoom 19).

**Rail styling** is matched to the CTC schematic legend in `network_map.js` so the two views of the corridor never disagree: DN `#2563eb` (to Kanpur), UP `#4f46e5` (to New Delhi).

**Severity drives marker colour uniformly** across every layer — `CRITICAL` `#dc2626`, `HIGH` `#d97706`, `MEDIUM` `#2563eb`, `LOW` `#059669` — so the glyph is what identifies the layer, not the colour. A dashed span marks work as *proposed* rather than committed: an unsanctioned requisition, or an isolation riding on one.

**Layer glyphs:** `issues` `!`, `demands` `D`, `blocks` `B`, `powercuts` `P`, `routines` `R`, `assets` `W`, `health` `H`, `trains` `T`.

Only `issues` and `demands` expose a popup action (`Inspect & Raise Block` and `Show in queue`). The page supplies the handler through `onInspect`; a layer absent from `ACTION_LABEL` gets no action bar.

#### `block_request.js` — Inspect → prefilled requisition → Request Block
An officer clicks Inspect on a reported issue and gets a fully prefilled block requisition: everything the field report already stated is filled in, the site evidence is attached, and the only required action at the end is the **Request Block** button.

**Nothing is fetched.** The map's issue feature already carries the entire worker request in `detail` — attachments included — so the form opens instantly from data in hand. On submit it posts to the existing `POST /api/worker_requests/{id}/approve`, with any officer edit travelling as an optional override on that same request. This flow and the plain approve button therefore share one endpoint and produce identical demand records. The modal shell is injected once at runtime, so any page can adopt the flow with no HTML changes.

#### The three department portals
Each portal page loads `sim_clock.js`, `portal_review.js`, `corridor_map.js`, `block_request.js` and its own controller, and lays out: a corridor map card, a review queue, a requisitions table, a reviewed-history card, plus memo and attachment modals.

| Portal | Route | Department code | Accent | Map layers | Distinctive column |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TMS (IRCEP Civil) | `/tms` | `ENGINEERING_TRACK` | Steel Blue `#1e40af` | `issues`, `blocks`, `routines` | P-Way gang / machine |
| TDMS (RailSaver TRD) | `/tdms` | `TRACTION_DISTRIBUTION_OHE` | High-Voltage Amber `#b45309` | `issues`, `assets`, `powercuts` | 25 kV isolation permit |
| SMMS (IR S&T) | `/smms` | `SIGNAL_AND_TELECOM` | Forest Emerald `#047857` | `issues`, `health` | S&T/T-351 disconnection notice |

#### `style.css`
The foundational CSS layer, providing base tokens and structural styling for all four screens. Retained as the ground layer; the visual overhaul is applied additively through `occ_redesign.css` (see below and §12).

**Base tokens (`:root`, top of file)** — the shared design system used by all four screens:
- Surfaces: `#f8fafc` base, `#ffffff` cards, `#f1f5f9` sub-panels, `#e2e8f0` hover, `#cbd5e1` active
- Borders: `#e2e8f0` default, `#edf2f7` subtle, `#cbd5e1` medium, `#2563eb` focus
- Text: `#0f172a` primary, `#334155` secondary, `#64748b` muted, `#94a3b8` subtle
- Department signatures with matching background and border tints: Track `#1e40af`, OHE `#b45309`, S&T `#047857`, AI bundle `#6366f1`
- Semantic tones: emerald `#059669`, amber `#d97706`, crimson `#dc2626`, blue `#2563eb`, indigo `#4f46e5`, slate `#475569`
- Typography: Inter and JetBrains Mono, with tabular numerals so clocks, timestamps, train numbers and coordinates never jitter
- Radii `4/6/8/12/16 px`, zero gradients

**OCC control-room tokens (`--occ-*`, near the end of the file)** — a *narrower, higher-contrast* layer applied only to the OCC landing screen, added because `#f8fafc` ground against `#ffffff` cards with `#e2e8f0` borders gave almost no separation and nothing announced itself:
- `--occ-ground: #e9eef5`, `--occ-rule: #cbd5e1`, `--occ-edge: #94a3b8`, `--occ-body: #475569`
- `--occ-header-h: 44px`, `--occ-kpi-h: 26px`, `--occ-tabs-h: 46px`

Because this is an additive layer rather than an edit to the base tokens, the three department portals keep the original palette and needed no rework.

#### `occ_redesign.css` — Warm Industrial + Editorial Operations Design System
The complete visual overhaul layer (Phase 16), loaded *after* `style.css` and `corridor_map.css` to override the default tokens while preserving structural CSS. See §12 for the full design philosophy, token reference and theming details.

**Scope of the overhaul:**
- Replaces the generic cool-blue dark-mode palette with a warm limestone/paper canvas (`#F3F0E7`), deep graphite inks (`#242424`), and a muted railway mustard accent (`#C69A2B`).
- Flattens previously bulbous cards (16 px radii) to sharp engineered panels (2–8 px radii).
- Introduces a five-tier surface hierarchy: canvas → panel → card → hover → inset.
- Adds Inter (sans-serif) and JetBrains Mono (monospace) typographic stacks.
- Implements calm semantic department colours: Track/Civil slate-blue, OHE warm amber, S&T muted sage, AI/Bundle muted plum.
- Provides tactile physical shadows (no glowing halos) and precise micro-border system.
- Themes Plotly Gantt and Marey charts to match the warm editorial aesthetic.
- Adds a toast notification system with severity-keyed styling (info/success/warning/danger).

#### `marey_chart.js`
24-hour time-distance string chart in Plotly.js: 29 train trajectories with type-based colour coding, shaded maintenance block rectangles with schedule badges, a vertical scrubber marking the live corridor time, and category filter chips (`ALL`, premium, express).

#### `gantt_chart.js`
Renders bundled possession bars with stacked sub-department tasks, plus `renderComparisonCard(metrics)`, which contrasts the unbundled baseline (99.1 h) against bundled execution (21.07 h) to show 78.03 hours recovered.

#### `network_map.js`
CTC schematic track board: double-track UP/DN lines with station nodes, chainages and speed limits, pulsing crimson badges on active blocks, and an inspector drawer offering `inspectStation`, `inspectSection`, `inspectBlock` and a jump into the simulator. Reached from the Network tab's **Schematic Board** toggle.

#### `yard_schematic.js`
Programmatic SVG renderer for IRSEM station yard interlocking.

- ViewBox width 1060 px; height `max(track_y, 260) + 65 px`.
- Track strokes: mainline `#0f2b5c` at 3.5 px, platform/loop `#2563eb` at 2.5 px, branch `#475569` at 2.0 px, sidings dashed `6,4`.
- **Point beacons are coloured by the ML priority tier** of the joined point machine — `CRITICAL` `#dc2626`, `HIGH` `#d97706`, `MEDIUM` `#2563eb`, `LOW` `#059669` — not by a raw health threshold.
- Interactive route switching: clicking a turnout toggles `NORMAL` (navy, 2.5 px) and `REVERSE` (indigo `#6366f1`, 3.5 px).
- Layer toggles for points, signals and OHE masts; pan and zoom controls; and a point inspector showing throw time, motor current, insulation resistance and predicted RUL with a jump into the XAI card.

#### `simulator_ui.js`
What-If modal controller, retained as a backup demo path. Switches between train-delay and emergency-defect modes and offers three one-click presets:

| Preset | Action |
| :--- | :--- |
| `FOG_RAJDHANI` | +45 min on `12424` Dibrugarh Rajdhani |
| `RAIL_FRACTURE` | Emergency track defect, `TDL – FZD` DN line |
| `OHE_SNAG` | Emergency OHE defect, `GZB – DER` UP line |

---

### 4.8 Automated Test Suite (`tests/`)

**72 tests, all passing (typically 5-9 s).** Every module sets `RAILWAY_SIM_AUTOSTART=0` before importing the API so the background generator never mutates state underneath an assertion.

#### `test_data_generator.py` — 7 tests
`TestRDSOFormulas`: TGI formula and boundaries, ACTM wire wear, IRSEM point machine health.
`TestDataGenerators`: timetable generation (29 trains, chronological arrivals), and TMS, TDMS and SMMS dataset integrity.

#### `test_system_integration.py` — 12 tests
Feature pipeline dimensionality; criticality scoring with `NaN` and TSR handling; slot finder headway rules; bundling engine clustering and concurrent duration; multi-horizon planners; sub-second disruption recovery; yard topology for all 10 stations; the yard API; safety rule enforcement; the full demand lifecycle including CP-SAT shadow bundling; the three portal pages returning HTML; and demand history plus queue clearing.

#### `test_realtime_simulator.py` — 24 tests
- **`TestVirtualClock`** (4): acceleration and monotonicity, `parse_hhmm` past midnight, `next_occurrence` rolling to tomorrow, windows crossing midnight.
- **`TestFaultGenerator`** (5): the pool excludes unschedulable locations, cold start emits one report per department, per-department self-throttling, report shape and attachments, description tier resync.
- **`TestReviewWorkflow`** (8): clock endpoint, department filtering, approval creating a matching OCC demand, rejection never reaching the OCC, double review rejected with 409, unknown request returning 404, and the two auto-enforced safety rules.
- **`TestBlockLifecycle`** (4): a block starts and completes on its own time, progress reported mid-window, the lone block is never withdrawn, and withdrawal only hits blocks that have not started.
- **`TestEventFeed`** (2): the feed is sequenced and filterable; the live board reports execution state.
- **`TestAttachmentServing`** (1): attachments are web-servable.

#### `test_map_service.py` — 29 tests
- **`TestCorridorGeometry`** (7): station chainage resolves to that station, midpoints fall between bracketing stations, out-of-range chainage clamps rather than raising, yard sections resolve to a stub span, paths include intermediate vertices, offsets move rails apart by the requested distance, and the geometry document is complete and ordered.
- **`TestMapLayers`** (12): every layer yields renderable features, all layers are JSON-serialisable, the department filter never leaks another department, powercuts are a strict subset of blocks, the OCC preset carries no ground-level layer, a demand is on exactly one of the two OCC layers, demands carry what the popup shows, issues carry what the block-request form needs, health covers sections and breaks down by system, routines are sorted by urgency, assets only surface work needing attention, and an unknown layer is reported rather than raised.
- **`TestTrainPositions`** (3): trains sit on the corridor and carry a line, a train is placed between its own stops, and a train outside its window is not running.
- **`TestMapAPI`** (5): geometry, layers per portal preset, an explicit layer list, trains, and presets listing every layer.
- **`TestBlockRequestOverrides`** (2): overrides are applied to the resulting demand, and omitting them preserves the reported values.

> **One test self-skips by design.** Both override tests *consume* a pending `ENGINEERING_TRACK` field report by approving it, and `_a_pending_report()` calls `skipTest` when the queue is empty. With the daemon disabled (`RAILWAY_SIM_AUTOSTART=0`) and fewer than two pending track reports, the suite reports `OK (skipped=1)`. That is a healthy result, not a failure. To run both, replenish the queue first:
> ```powershell
> py -3.13 -c "import os; os.environ['RAILWAY_SIM_AUTOSTART']='0'; from src.simulator import fault_generator; print(len(fault_generator.tick_reports()), 'reports generated')"
> ```

---

### 4.9 Bootstrap, Tooling & Legacy Artefacts

#### `run_system.py`
Single-command launcher.

1. **Interpreter guard.** Attempts to import `uvicorn`, `fastapi`, `pandas`, `xgboost` and `ortools`. On `ImportError` it re-spawns itself under `py -3.13`, and only prints instructions if that also fails.
2. **Step 1/4** — synthesise datasets if `unified_maintenance_backlog.csv` is missing.
3. **Step 2/4** — train models if `risk_classifier.joblib` is missing.
4. **Step 3/4** — run inference if `ml_predictions.csv` is missing.
5. **Step 4/4** — always solve the CP-SAT schedule.
6. Discover the LAN IP via a UDP socket trick, print all four portal URLs, and start Uvicorn on `0.0.0.0:8000` with `reload=False`.

> It does **not** run the test suite. Run tests explicitly (§11.1).

#### `scripts/generate_attachments.py`
A one-off matplotlib generator, **not part of the running application**. Produces per department two stylised site-photo PNGs and a one-page PDF inspection report into `data/attachments/{track,ohe,signal}/`. Reports are worded generically because the fault generator attaches them at random rather than tying them to a specific asset. Matplotlib infers PDF from the file extension, so no extra PDF library is needed.

```powershell
py -3.13 scripts/generate_attachments.py
```

#### `data.txt` and `model.txt` — legacy prototype scratch
Two plain-text files at the repository root holding the original "Day 1–Day 4" learning exercises: a 500-row random asset generator and a `RandomForestClassifier` with a four-tier priority function. **Neither is imported, executed or tested by any part of the system**, and their column vocabulary (`age`, `condition`, `previous_failure`) has no relationship to the 18-feature pipeline in use. They are retained only as provenance. Do not treat them as documentation of current behaviour.

#### `requirements.txt`
14 pinned-minimum dependencies: `fastapi`, `uvicorn`, `pydantic`, `pandas`, `numpy`, `scikit-learn`, `xgboost`, `ortools`, `joblib`, `shap`, `matplotlib`, `scipy`, `httpx`, `python-multipart`.

`matplotlib` is required by `scripts/generate_attachments.py`; `httpx` by the FastAPI `TestClient`; `python-multipart` by the CSV upload endpoint.

---

## 5. Mathematical Formulations & Algorithmic Details

### 5.1 Track Geometry Index — RDSO Lucknow
$$\text{TGI} = \frac{2 \cdot \text{UI} + \text{TI} + \text{GI} + 6 \cdot \text{AL}}{10}$$

Clipped to $[0, 100]$. UI is the unevenness index, TI the twist index over a 3.6 m base, GI the gauge index against the 1676 mm standard, and AL the alignment index. Classification: `GOOD` $\ge 80$, `AVERAGE` $50$–$79$, `POOR` $< 50$ (mandates maintenance or a temporary speed restriction).

### 5.2 Contact Wire Wear — ACTM
$$\text{Wear \%} = \frac{d_{\text{nominal}} - d_{\text{measured}}}{d_{\text{nominal}} - d_{\text{condemning}}} \times 100 = \frac{12.24 - d}{12.24 - 8.25} \times 100$$

For standard 107 mm² hard-drawn grooved copper contact wire, clipped to $[0, 100]$. Classification: `CONDEMN_RENEW` $\ge 85\%$, `CRITICAL` $\ge 65\%$, `WORN` $\ge 40\%$, `GOOD` $< 40\%$.

### 5.3 Point Machine Health Index — IRSEM
Each parameter becomes a normalised penalty in $[0, 1]$, then the penalties are weighted:

$$p_{\text{throw}} = \mathrm{clip}\!\left(\frac{t - 4.0}{2.0},\, 0,\, 1\right) \qquad
p_{\text{current}} = \mathrm{clip}\!\left(\frac{I - 1.8}{1.7},\, 0,\, 1\right) \qquad
p_{\text{insul}} = \mathrm{clip}\!\left(\frac{10.0 - \min(R,\, 10.0)}{10.0},\, 0,\, 1\right)$$

$$\text{Health Index} = 100 - \left(30 \cdot p_{\text{throw}} + 40 \cdot p_{\text{current}} + 30 \cdot p_{\text{insul}}\right)$$

Motor current carries the greatest weight because a friction spike indicates mechanical binding or ballast jamming. Tier: `CRITICAL` $< 35$, `HIGH` $< 55$, `MEDIUM` $< 75$, else `LOW`.

Reference bands: throw time 4.0–5.0 s normal and $> 5.8$ s critical; peak current 1.8–2.2 A normal and $> 3.2$ A critical; insulation resistance $\ge 10\,\text{M}\Omega$ good and $< 1.0\,\text{M}\Omega$ condemning. Defect reason strings fire at $> 5.5\text{ s}$, $> 3.0\text{ A}$ and $< 2.0\,\text{M}\Omega$.

### 5.4 Composite Asset Criticality Score & Two-Tier Hybrid Decision Rationale

A central engineering design decision in this platform is the **Two-Tier Hybrid Architecture**, bridging statistical machine learning and deterministic regulatory safety:

1. **Tier 1 — Empirical Condition & RUL Forecasting (XGBoost):**
   Physical degradation in high-speed electrified corridors is non-linear and coupled. For example, a rail temperature spike $\Delta T > 20^\circ\text{C}$ is tolerable under low GMT traffic, but when combined with cumulative GMT $> 80$ and a 3 mm track twist, rail buckling hazard increases exponentially. Purely additive rule-based scoring engines cannot capture these non-linear cross-department splits without hundreds of brittle, fragile `if/else` statements. Furthermore, static rule engines cannot forecast continuous Remaining Useful Life ($\text{RUL}$ in days) needed for 30-day/60-day strategic horizon bundling. Hence, XGBoost provides data-driven condition estimation and regression.

2. **Tier 2 — Deterministic RDSO Priority Engine:**
   Railway safety regulators (such as the Commissioner of Railway Safety - CRS, and RDSO) strictly prohibit un-audited "black-box" decision making for corridor traffic shutdowns. The output of XGBoost ($P_{\text{fail}}$ and continuous $\text{RUL}$) is therefore mapped into the deterministic **Composite Criticality Formula**:

$$\text{Score} = \mathrm{clip}\!\left(35 P_{\text{fail}} + 25 \cdot \frac{365 - \text{RUL}}{365} + 20 W_{\text{route}} + 20\left(C - 1\right) + \text{TSR}_{\text{pen}},\ 0,\ 100\right)$$

where:
- $P_{\text{fail}} \in [0, 1]$ is the XGBoost-predicted probability of failure within 30 days.
- $\text{RUL}$ is the XGBoost-predicted Remaining Useful Life in days (clipped to $[0, 365]$).
- $W_{\text{route}}$ is the Indian Railways route classification weight (`Class A` trunk: 1.0, `Class B`: 0.85, `Class C`: 0.70, `Class D`: 0.50, default: 0.75).
- $C$ is the compounding risk factor ($C \ge 1.0$, scaling adjacent asset defects).
- $\text{TSR}_{\text{pen}} = 15$ if an active Temporary Speed Restriction is already throttling commercial traffic, otherwise 0.

This formulation guarantees 100% deterministic auditability: every point added to the priority score maps directly to an explicit engineering condition or codal threshold, before passing to the Google OR-Tools CP-SAT optimizer.

### 5.5 Slot Discovery
For each section $(f, t)$ and line $\ell$, with commercial train occupancy intervals $[a_i, b_i]$ sorted by start:

$$\text{usable}_i = a_i - \text{cursor} - 10, \qquad
\text{cursor} \leftarrow \max(\text{cursor},\, b_i + 10)$$

A slot is emitted when $\text{usable}_i \ge 45$ minutes, spanning $[\text{cursor},\ a_i - 10]$. The 10-minute term is the safety clearance headway applied on both sides of every commercial path.

### 5.6 Bundling
For a candidate bundle $b$ with member tasks $T_b$ (at most 4, within 3.0 km, on the same section origin and line):

$$D_b^{\text{bundled}} = \max_{\tau \in T_b} d_\tau \qquad
D_b^{\text{unbundled}} = \sum_{\tau \in T_b} d_\tau \qquad
\text{Saved}_b = D_b^{\text{unbundled}} - D_b^{\text{bundled}}$$

$$\text{Criticality}_b = \sum_{\tau \in T_b} \text{criticality}_\tau, \qquad
\text{PowerBlock}_b = \bigvee_{\tau \in T_b} \text{powerBlock}_\tau$$

### 5.7 CP-SAT Assignment Model

**Decision variable**
$$x_{b,s} \in \{0, 1\} \quad \forall b \in B,\ \forall s \in S \qquad |B| \le 20,\ |S| = 87$$

**Objective**
$$\max \sum_{b \in B} \sum_{s \in S} \Big( 10\,\text{Criticality}_b + 500\,\mathbb{I}_{\text{multi}}(b) + 300\,\mathbb{I}_{\text{night}}(s) + 2000\,\mathbb{I}_{\text{priority}}(b) + 800\,\mathbb{I}_{\text{upcoming}}(s) - 2 D_b^{\text{bundled}} \Big)\, x_{b,s}$$

**Subject to**
$$\sum_{s \in S} x_{b,s} \le 1 \quad \forall b \in B \qquad \text{(at most one slot per bundle)}$$
$$\sum_{b \in B} x_{b,s} \le 1 \quad \forall s \in S \qquad \text{(at most one bundle per slot)}$$
$$\sum_{b \in B_{\text{tamp}}} x_{b,s} \le 2, \quad \sum_{b \in B_{\text{tw}}} x_{b,s} \le 3 \quad \forall s \in S \qquad \text{(machine fleet)}$$
$$x_{b,s} = 0 \quad \text{if } \text{sec}(b) \ne \text{sec}(s) \ \lor\ \text{line}(b) \ne \text{line}(s) \ \lor\ D_b^{\text{bundled}} > D_s$$

where $\mathbb{I}_{\text{upcoming}}(s) = 1$ iff a current minute-of-day was supplied and $s$ starts at or after it.

### 5.8 Map Geometry
**Chainage to position.** Given the ordered centreline vertices $\{(k_i, \phi_i, \lambda_i)\}$, a chainage $k$ is located by binary search for its bracketing pair, then linearly interpolated; out-of-range values clamp to the endpoints.

**Bearing** between consecutive vertices:
$$\theta = \operatorname{atan2}\!\big(\sin\Delta\lambda\cos\phi_2,\ \cos\phi_1\sin\phi_2 - \sin\phi_1\cos\phi_2\cos\Delta\lambda\big)$$

**Parallel rail offset**, computed client-side per render:
$$m_{\text{px}} = \frac{156543.03392 \cdot \cos\phi}{2^{z}}, \qquad
o = \mathrm{clip}\!\left(6 \cdot m_{\text{px}},\ 3\text{ m},\ 5000\text{ m}\right)$$

Each rail is then placed at $\theta \pm 90°$ from the centreline by $o$ metres. The 5 km ceiling has to clear a whole-corridor view (about 770 m/px at zoom 7.5) or the two rails collapse into one line at exactly the zoom the operator opens the map at — the thing this map exists to avoid. That much apparent separation is a deliberate schematic exaggeration; by zoom 13 the clamp is no longer binding and the spacing is real.

---

## 6. API Route Specifications & Data Contracts

### 6.1 Page routes

| Method | Endpoint | Serves |
| :--- | :--- | :--- |
| `GET` | `/` | Central OCC Master Desk |
| `GET` | `/tms` | Track Management System portal |
| `GET` | `/tdms` | Traction Distribution Management System portal |
| `GET` | `/smms` | Signal Maintenance Management System portal |
| — | `/static/*` | Frontend assets |
| — | `/attachments/*` | Field evidence photos and PDFs |
| `GET` | `/docs`, `/redoc`, `/openapi.json` | FastAPI interactive documentation |

### 6.2 Corridor, schedule and assets

| Method | Endpoint | Key response fields |
| :--- | :--- | :--- |
| `GET` | `/api/corridor/topology` | `corridor_name`, `zone`, `total_distance_km`, `route_class`, `electrification`, `signalling_type`, `tracks`, `stations[]`, `machine_fleet{}` |
| `GET` | `/api/corridor/timetable` | Array of 290 rows: `train_number`, `train_name`, `train_type`, `priority_class`, `delay_penalty_weight`, `direction`, `station`, `km_location`, `arrival_time`, `departure_time`, `arrival_min_of_day`, `departure_min_of_day`, `is_halt` |
| `GET` | `/api/schedule/optimal` | `status`, `solver`, `corridor`, `horizon_hours`, `metrics{}`, `scheduled_blocks[]`, `deferred_blocks_count` |
| `GET` | `/api/schedule/weekly` | `horizon`, `active_corridor`, `schedule_matrix{Monday:[…]}`, `coordination_kpi{}` |
| `GET` | `/api/schedule/monthly` | `horizon`, `total_renewal_projects`, `weekly_allocations{Week_1:[…]}`, `resource_projection{}` |
| `GET` | `/api/assets/health?department=&limit=100` | `total_assets`, `critical_count`, `high_count`, `medium_count`, `low_count`, `assets[]` |
| `GET` | `/api/assets/explain/{asset_id}` | `asset_id`, `department`, `failure_probability_pct`, `priority_tier`, `primary_risk_drivers[]`, `recommended_action` |
| `GET` | `/api/station/yard/{station_code}` | `station_code`, `station_name`, `km`, `division`, `interlocking_type`, `layout_type`, `layout_source`, `platform_count`, `track_count`, `speed_limit_kmph`, `tracks[]`, `platforms[]`, `points[]` (health-enriched), `signals[]`, `ohe_masts[]`, `total_signal_assets`, `point_machines_count`, `track_circuits_count`, `active_blocks[]` |
| `GET` | `/api/memos/bdms/{schedule_id}` | `schedule_id`, `memo_formatted_text`, `block_details` |
| `POST` | `/api/upload/csv` | Form-data `file` → `status`, `message` |

`GET /api/schedule/optimal` `metrics` object:

| Field | Meaning |
| :--- | :--- |
| `total_blocks_scheduled` | Blocks the solver placed |
| `total_tasks_completed` | Member tasks across those blocks |
| `multi_department_bundling_rate_pct` | Share of blocks spanning more than one department |
| `total_possession_hours` | Corridor time actually consumed |
| `unbundled_baseline_hours` | Time the same work would consume unbundled |
| `downtime_saved_hours` | Difference |
| `downtime_reduction_pct` | Saving as a percentage of the baseline |
| `passenger_train_punctuality_impact_min` | Always 0 by construction — slots are train-free |
| `safety_clearance_violations` | Always 0 by construction — the 10-minute buffer is applied in slot discovery |

### 6.3 Demand queue

| Method | Endpoint | Contract |
| :--- | :--- | :--- |
| `POST` | `/api/demand/raise` | Body `DemandRequest` → `status`, `message`, `demand` |
| `GET` | `/api/demand/pending` | `total_pending`, `total_unbundled_hours`, `demands[]` |
| `GET` | `/api/demand/status/{department}` | `department`, `total`, `demands[]` (newest first) |
| `GET` | `/api/demand/history` | `total`, `demands[]` |
| `POST` | `/api/demand/clear` | `status`, `message` |
| `POST` | `/api/demand/bundle_and_sanction` | `status`, `message`, `sanctioned_count`, `sanctioned_demands[]`, `deferred_count`, `deferred_demands[]`, `updated_schedule` |

`DemandRequest` body:

```jsonc
{
  "department": "ENGINEERING_TRACK",     // | TRACTION_DISTRIBUTION_OHE | SIGNAL_AND_TELECOM
  "defect_category": "Rail Flaw (USFD)",
  "section_from": "ALJN", "section_to": "TDL",
  "line": "DN",                           // UP | DN
  "km_start": 131.0, "km_end": 135.0,
  "machine_required": "CSM_TAMPING",      // CSM_TAMPING | BCM | TOWER_WAGON | MANUAL_GANG | NONE
  "power_block_required": false,          // auto-forced true for OHE / heavy machines
  "disconnection_required": false,        // auto-forced true for S&T
  "gang_crew": "Standard Field Crew",
  "duration_requested_min": 180,
  "priority": "CRITICAL",                 // CRITICAL | HIGH | MEDIUM
  "description": ""
}
```

**Demand record statuses:** `PENDING_SANCTION` → `APPROVED_SHADOW_BLOCK` → `IN_PROGRESS` → `COMPLETED`, with `CANCELLED` and `DEFERRED_NEXT_CYCLE` as terminal alternatives.

### 6.4 Live simulator

| Method | Endpoint | Contract |
| :--- | :--- | :--- |
| `GET` | `/api/clock/now` | `sim_time`, `real_time`, `multiplier` |
| `GET` | `/api/worker_requests/pending?department=ALL` | `department`, `total`, `requests[]` |
| `GET` | `/api/worker_requests/history?department=ALL&limit=15` | `department`, `total`, `requests[]` |
| `POST` | `/api/worker_requests/{id}/approve` | Body `ReviewRequest` (all fields optional) → `status`, `message`, `request`, `demand`. `404` unknown, `409` already reviewed |
| `POST` | `/api/worker_requests/{id}/reject` | Body `ReviewRequest` → `status`, `message`, `request` |
| `POST` | `/api/worker_requests/clear` | `status`, `message` |
| `POST` | `/api/simulator/reset` | Clears reports, demands and notifications |
| `GET` | `/api/events/feed?department=ALL&after_seq=0&limit=30` | `department`, `latest_seq`, `events[]` |
| `GET` | `/api/live/board` | `sim_time`, `multiplier`, `blocks[]`, `demands[]`, `status_counts{}` |
| `POST` | `/api/simulate/delay` | Body `{train_number, delay_minutes}` → `disruption_type`, `train_name`, `delay_injected_min`, `solver_time_seconds`, `resolution_summary`, `updated_schedule` |
| `POST` | `/api/simulate/defect` | Body `{section, line, km, department}` → `disruption_type`, `location`, `solver_time_seconds`, `resolution_summary`, `updated_schedule` |

`ReviewRequest` body — every field is optional:

```jsonc
{
  "reason": "", "reviewed_by": "Department Officer",
  "duration_requested_min": null, "priority": null,
  "machine_required": null, "gang_crew": null, "description": null,
  "power_block_required": null, "disconnection_required": null
}
```

**Worker report statuses:** `PENDING_REVIEW` → `APPROVED_FORWARDED` or `REJECTED`.

### 6.5 Corridor Map Service

| Method | Endpoint | Contract |
| :--- | :--- | :--- |
| `GET` | `/api/map/geometry` | `corridor_name`, `zone`, `total_distance_km`, `electrification`, `signalling_type`, `tracks`, `track_sides{DN:1.0, UP:-1.0}`, `centreline[{km,lat,lng,bearing}]`, `stations[]`, `sections[]`. Cacheable — changes only when the topology file does. `404` if topology is missing |
| `GET` | `/api/map/layers?department=ALL&layers_csv=` | `department`, `sim_time`, `layers{name: [feature]}`, `counts{}`, optional `errors{}`. Omitting `layers_csv` uses the department preset |
| `GET` | `/api/map/trains` | `total`, `trains[]` |
| `GET` | `/api/map/presets` | `presets{department: [layer]}`, `available_layers[]` |

---

## 7. End-to-End Workflow: Report to Executed Block

The system runs two cadences at once.

**Cadence 1 — batch macro run.** The full 1,850-asset backlog is scored, bundled and solved, producing the daily block plan plus the 30-day and 7-day horizons. This is what `run_system.py` performs at boot.

**Cadence 2 — event-driven dispatch.** The live path, which is what a demo actually exercises:

```
 1. GENERATE     fault_generator daemon wakes every 20-40 real seconds.
                 Each department is due once 25-40 sim-minutes have passed
                 since its own last report. Picks a real backlog row from a
                 schedulable location, attaches site photos + inspection PDF.
                 -> worker_requests.json, status PENDING_REVIEW
                 -> event REPORT_SUBMITTED  ->  toast on the owning portal

 2. SURFACE      The report appears in two places at once, from one source:
                 - the portal's review queue      (/api/worker_requests/pending)
                 - the portal's corridor map      (issues layer)

 3. TRIAGE       The department officer reviews the evidence and either:
                 (a) clicks Approve in the review console, or
                 (b) clicks Inspect on the map marker, gets a fully prefilled
                     requisition, optionally edits it, and clicks Request Block.
                 Both paths POST the same approve endpoint and produce an
                 identical demand record.
                 -> status APPROVED_FORWARDED
                 -> event REPORT_APPROVED

 4. QUEUE        _create_pending_demand builds the OCC demand, auto-enforcing
                 25 kV isolation for OHE/heavy machines and S&T/T-351
                 disconnection for signalling work.
                 -> pending_demands.json, status PENDING_SANCTION
                 -> appears in the OCC INCOMING column (animated arrival)
                 -> appears on the OCC map (demands layer)

 5. SANCTION     The controller presses AUTO-BUNDLE & SANCTION.
                 Pending demands are injected as priority tasks, CP-SAT solves
                 against 87 slots, co-located multi-department demands merge
                 into one shadow block, and each window is resolved to an
                 absolute simulated datetime labelled TODAY or TOMORROW.
                 -> status APPROVED_SHADOW_BLOCK (or DEFERRED_NEXT_CYCLE
                    with an explicit reason)
                 -> events DEMAND_SANCTIONED / DEMAND_DEFERRED
                 -> block appears on every map (blocks layer, powercuts if
                    it carries an isolation)

 6. EXECUTE      block_lifecycle.tick() runs on every simulator beat.
                 When the clock reaches the window start the block goes
                 IN_PROGRESS and its progress bar animates; at the window end
                 it goes COMPLETED. Occasionally, and never for work already
                 under way, control withdraws an upcoming block with a reason.
                 -> events BLOCK_STARTED / BLOCK_COMPLETED / BLOCK_CANCELLED
                 -> OCC IN EXECUTION column and the map update together,
                    because both read block_lifecycle.live_state()

 7. DOCUMENT     GET /api/memos/bdms/{schedule_id} renders the formal Block
                 Sanction Memorandum: memo reference, section and chainage,
                 sanctioned window, bundled requisitions, departments, power
                 block and disconnection status, machines, caution orders.
```

`POST /api/simulator/reset` returns the whole pipeline to a clean slate before a demo run.

---

## 8. Frontend Architecture, Map & SVG Yard Mathematics

### 8.1 Zero-build architecture
Vanilla HTML5, CSS3 and ES6+ JavaScript. No bundler, no npm dependency tree, no virtual DOM. Three libraries load from CDN: Plotly.js `2.35.2`, Leaflet.js `1.9.4` (with subresource-integrity hashes), and Google Fonts for Inter and JetBrains Mono. Everything else is first-party and served from `/static`.

The consequence worth stating: any file under `src/frontend/` can be edited and reloaded in the browser with no build step, which is why the whole UI is directly hackable during a demo.

### 8.2 Corridor map rendering
Covered mathematically in §5.8. Implementation points:

- The API returns the **centreline plus a per-vertex bearing**, never pre-offset coordinates.
- Rails are recomputed on every render against the current zoom, so the pair stays visually distinct at corridor scale and converges on real spacing when zoomed into a section.
- **Station beacons sit on the centreline**, bridging the pair.
- **Train markers are moved, never recreated** (`setLatLng`), so a 2-second poll reads as continuous motion rather than teleportation.
- Features are indexed by ID per instance (`featureIndex`), which is how the popup Inspect bridge (`CorridorMap._inspect`) hands the full feature to the page's `onInspect` handler.

### 8.3 SVG yard coordinate mapping
- ViewBox: width 1060 px, height `max(track_y, 260) + 65 px`.
- A 20 px grid pattern backs the canvas; platform slabs carry a soft drop-shadow filter.
- Tracks are drawn as horizontal lines from x=80 to x=980 at each track's declared `y`, labelled at x=70.
- Turnouts are diagonal lines from $(x_1, y_1)$ to $(x_2, y_2)$ with a hinge beacon at the origin and an IRSEM identity badge (`Pt-101A`) at the midpoint.
- Signals render as a 16 px mast with an aspect head; OHE masts as a dashed 12 px stem coloured by wear status.
- Route position state is held in `switchPositions` keyed by point ID.

### 8.4 Modal stacking
Leaflet manages its own internal z-index across `.leaflet-pane`, `.leaflet-top` and `.leaflet-bottom`. Interactive modals (`yard-modal`, `disruption-modal`, `block-request-modal`, memo and attachment modals) enforce `z-index: 2000+` with a backdrop blur, which guarantees isolation without re-parenting DOM elements.

---

## 9. Concurrency, State & Determinism Model

### 9.1 What is mutable, and who mutates it

| State | File | Written by | Read by |
| :--- | :--- | :--- | :--- |
| Field reports | `worker_requests.json` | Generator daemon, approve/reject handlers | Portals, `issues` layer |
| OCC demands | `pending_demands.json` | `_create_pending_demand`, sanction handler, lifecycle tick | OCC board, `demands`/`blocks` layers |
| Event log | `sim_events.json` | `emit_event` from every transition | Toast pollers on all four screens |
| Block schedule | `optimized_schedule.json` | Scheduler, sanction handler, CSV upload | OCC charts, memos, live board |
| ML predictions | `ml_predictions.csv` | `predict.py`, CSV upload | Everything downstream |

`worker_requests.json` and `sim_events.json` are gitignored: they are regenerated on every run. So are the four ephemeral `temp_*.csv` files.

### 9.2 The two concurrency rules
Restated because they are the easiest thing to get wrong when extending the simulator:

1. **Hold the lock across the whole read-modify-write.** Use `sim_state.read_*_unlocked()` and `write_*_unlocked()` inside one `with` block. Never read, release, then write.
2. **Acquire in the order `worker_requests_lock` → `demands_lock` → `events_lock`.** One order everywhere means deadlock is structurally impossible.

Events are emitted *outside* the mutation lock where practical, which is why `block_lifecycle.tick()` collects transitions first and emits afterwards.

### 9.3 The `RAILWAY_SIM_AUTOSTART` switch
`src/api/main.py` starts the generator daemon on import unless this environment variable is `"0"`. Every test module sets it before importing the API. Any script that imports the API without wanting a live daemon must do the same:

```python
import os
os.environ["RAILWAY_SIM_AUTOSTART"] = "0"
from src.api.main import app
```

### 9.4 Determinism
- Dataset synthesis seeds `numpy` and `random` explicitly per generator: **42** for TMS, **43** for TDMS, **44** for SMMS.
- Model training seeds `numpy` and passes `random_state=42` to the split and every estimator.
- The duration target is computed deterministically from asset features rather than sampled.
- CP-SAT is deterministic for a fixed input under its 5-second budget.

What is deliberately *not* deterministic: the fault generator (candidate sampling, attachment choice, pacing jitter) and block withdrawal. These model a live corridor, and the clock epoch is wall-clock-relative.

---

## 10. Developer Extensibility Guide & Recipes

### 10.1 Add a new corridor station
1. Add the station to `data/topology/ndls_cnb_corridor.json`, GPS coordinates included — the map service resolves every feature through them:
   ```json
   {
     "code": "XYZ", "name": "New Station", "km": 175.5,
     "lat": 27.6100, "lng": 78.1500,
     "division": "PRAYAGRAJ", "platforms": 4,
     "speed_limit_kmph": 130,
     "depots": ["Civil P-Way Depot", "S&T Signal Depot"]
   }
   ```
2. Add a matching entry to `data/topology/station_yards.json` defining `tracks`, `platforms`, `points`, `signals` and `ohe_masts`.
3. Add the station code and its dwell time to `get_station_chainages()` in `src/generator/timetable_builder.py`, and add halts to the train templates that should stop there.
4. Add the code to the `stations` list in `src/optimizer/slot_finder.py`, which derives sections from that ordered list.
5. Regenerate and re-solve:
   ```powershell
   py -3.13 src/generator/generate_all.py
   py -3.13 src/ml_engine/predict.py
   py -3.13 src/optimizer/ortools_scheduler.py
   ```

`geometry.py` and every map layer pick the new station up automatically — no map code changes.

### 10.2 Improve corridor alignment accuracy
Add a `shape_points` array to `ndls_cnb_corridor.json`:

```json
"shape_points": [
  { "km": 0.0,  "lat": 28.6431, "lng": 77.2197 },
  { "km": 4.2,  "lat": 28.6520, "lng": 77.2600 }
]
```

`_load_centreline()` prefers it over the station anchors, and every consumer — feature anchoring, span paths, rail offsets, train interpolation — picks up the better geometry with no other change.

### 10.3 Add a machine fleet constraint
Constraints live inline in `solve_schedule()` in `src/optimizer/ortools_scheduler.py`, alongside the existing tamping and tower wagon limits:

```python
for s_idx, s in enumerate(available_slots):
    bcm_vars = [X[(b_idx, s_idx)] for b_idx, b in enumerate(top_bundles)
                if any("BCM" in m for m in b["machines_required"])]
    if bcm_vars:
        model.Add(sum(bcm_vars) <= 1)
```

Fleet sizes are declared in `data/topology/ndls_cnb_corridor.json` under `machine_fleet` (2 tamping, 1 BCM, 3 tower wagons, 4 USFD trolleys, 5 signal gangs). The solver currently enforces tamping and tower wagons only; the others are advisory. Wire a new one up here and add a test to `test_system_integration.py`.

### 10.4 Add a map layer
1. Write a builder in `src/map_service/layers.py` returning features in the common shape, anchoring through `_anchor()`:
   ```python
   def speed_restrictions_layer(department: str = "ALL") -> list:
       features = []
       for row in ...:
           anchor = _anchor(row["km_start"], row["km_end"], row["line"])
           features.append({
               "id": row["tsr_id"], "layer": "speed_restrictions",
               "severity": "HIGH", "title": "…", "subtitle": "…",
               **anchor, "detail": row,
           })
       return _sort_features(features)
   ```
2. Register it in `LAYER_BUILDERS`, and add it to any `PORTAL_LAYER_PRESETS` entry that should show it by default.
3. Add an entry to `LAYER_META` in `src/frontend/js/corridor_map.js` with a label, glyph, colour and `kind` (`point`, `span` or `train`). Add to `ACTION_LABEL` only if the popup should offer an action.
4. Add a case to the layer assertions in `tests/test_map_service.py`.

Nothing else changes: the API dispatches by name and the renderer is generic.

### 10.5 Add an event kind
1. Append to `EVENT_KINDS` in `src/simulator/sim_state.py`.
2. Call `sim_state.emit_event(kind=..., department=..., severity=..., title=..., message=..., ref_id=...)` at the transition.

Severity maps to toast styling: `info`, `success`, `warning`, `danger`. The feed and the high-water-mark logic need no change.

### 10.6 Retrain the models
```powershell
py -3.13 src/ml_engine/train_models.py
py -3.13 src/ml_engine/predict.py
py -3.13 src/optimizer/ortools_scheduler.py
```
Regenerates `risk_classifier.joblib`, `rul_regressor.joblib`, `duration_estimator.joblib` and `scaler.joblib`, then re-scores the backlog and re-solves the schedule.

### 10.7 Change simulator pacing
All in `src/simulator/`:

| Knob | File | Default |
| :--- | :--- | :--- |
| Clock acceleration | `virtual_clock.py` `MULTIPLIER` | 80.0 |
| Clock epoch | `virtual_clock.py` `SIM_EPOCH_HOUR` | 5 |
| Report interval | `fault_generator.py` `TARGET_GAP_SIM_MIN_RANGE` | (25, 40) sim-min |
| Loop sleep | `fault_generator.py` `TICK_SLEEP_REAL_SEC_RANGE` | (20, 40) real sec |
| Fault spacing | `fault_generator.py` `MIN_SEP_KM` | 8.0 km |
| Withdrawal rate | `block_lifecycle.py` `CANCEL_PROBABILITY` | 0.30 |
| Withdrawal gap | `block_lifecycle.py` `MIN_CANCEL_GAP_SIM_MIN` | 90 sim-min |

Keep the report interval and the loop sleep consistent with the multiplier: at 80×, 25–40 sim-minutes is 19–30 real seconds, which is why the sleep range is 20–40 real seconds.

---

## 11. Operational Runbook & Troubleshooting

### 11.1 Run the test suite
```powershell
py -3.13 -m unittest discover tests/
```
*Expected:* `Ran 72 tests ... OK`, or `OK (skipped=1)` when the pending track-report queue is empty (see the note in §4.8 — both are healthy).

Run one module:
```powershell
py -3.13 -m unittest tests.test_map_service -v
```

### 11.2 Launch the four-portal control network
```powershell
py -3.13 run_system.py
```

| Screen | URL |
| :--- | :--- |
| Central OCC Master Desk | `http://127.0.0.1:8000/` |
| Track Portal (TMS) | `http://127.0.0.1:8000/tms` |
| Traction Portal (TDMS) | `http://127.0.0.1:8000/tdms` |
| Signal Portal (SMMS) | `http://127.0.0.1:8000/smms` |
| Interactive API docs | `http://127.0.0.1:8000/docs` |

The server binds `0.0.0.0:8000` and prints the LAN address, so phones and tablets on the same network can act as field terminals.

### 11.3 Regenerate everything from scratch
```powershell
py -3.13 src/generator/generate_all.py
py -3.13 src/ml_engine/train_models.py
py -3.13 src/ml_engine/predict.py
py -3.13 src/optimizer/ortools_scheduler.py
py -3.13 scripts/generate_attachments.py   # only if data/attachments/ is missing
```

### 11.4 Reset before a demo
```powershell
py -3.13 -c "import requests; print(requests.post('http://127.0.0.1:8000/api/simulator/reset').json())"
```
Or press the reset icon in the OCC header. This clears field reports, OCC demands and notifications in one call.

### 11.5 Common issues and resolutions

| Symptom | Root cause | Resolution |
| :--- | :--- | :--- |
| `No module named uvicorn` / `ortools` | Default interpreter lacks the packages | Use `py -3.13 <command>`, or launch `run_system.py`, which re-spawns itself |
| Tests fail intermittently on demand or report counts | The generator daemon mutated state mid-assertion | Set `RAILWAY_SIM_AUTOSTART=0` before importing `src.api.main` |
| Server startup delayed several seconds | SHAP `TreeExplainer` initialising synchronously | Already handled by lazy construction in `get_explainability_engine()`. Never build SHAP at module import |
| Solver reports `Greedy Heuristic Fallback` | `ortools` not importable | `py -3.13 -m pip install ortools`. Output shape is identical, so nothing else breaks |
| Model file not found on load | Looking for the old `*_xgb.joblib` names | Current filenames are `risk_classifier.joblib`, `rul_regressor.joblib`, `duration_estimator.joblib`, `scaler.joblib` |
| Every demand comes back `DEFERRED_NEXT_CYCLE` | Demands are on a section or line with no feasible slot, or the bundle was truncated before the solver saw it | Confirm the section appears in `find_available_corridor_slots()` output. `ALJN – TDL` never opens a 45-minute gap and `CNB` is terminal. Ensure `priority_task_ids` is being passed |
| Sanctioned window is labelled `TOMORROW` unexpectedly | The window has already passed on the simulated clock | Correct behaviour. `resolve_window` rolls a past window forward rather than letting it silently expire |
| Map shows one line instead of two rails | Zoom is far out and the offset clamp is not clearing the view | The 5 km `MAX_OFFSET_M` ceiling exists for this. Confirm `bearing` is present on every centreline vertex |
| Map markers all one colour | Colour comes from `severity`, not layer | Confirm the builder sets `severity` to one of `CRITICAL`/`HIGH`/`MEDIUM`/`LOW`. The glyph identifies the layer |
| One layer empty, rest fine | The builder raised and was isolated | Check the `errors` object in the `/api/map/layers` response |
| `ValueError: Out of range float values are not JSON compliant` | A sparse backlog column reached the response as `NaN` | Route the payload through `_scrub()` in `layers.py`, or `df.replace({np.nan: None})` in `main.py` |
| Plotly charts overlap or size wrongly on tab switch | The container was hidden at first paint | Call `Plotly.Plots.resize()` or re-render on a short `setTimeout` inside `switchTab()` |
| Corridor map grey after switching to the Network tab | Leaflet measured a hidden container | Call `CorridorMap.invalidateAll()` on tab switch |
| Weekly matrix `.forEach is not a function` | `schedule_matrix` is an object keyed by day | Iterate `Object.entries(data.schedule_matrix)` |
| KPI values read `undefined` | Field name mismatch | Match `downtime_reduction_pct`, `downtime_saved_hours`, `multi_department_bundling_rate_pct`, `total_tasks_completed` |
| Asset counts read `undefined` | `/api/assets/health` returns `total_assets`, not `total_count` | Use `total_assets` plus the four tier counters |
| Attachments 404 | `data/attachments/` is absent, so the mount was skipped | Run `py -3.13 scripts/generate_attachments.py` and restart |
| Clock badge jumps in large steps | Rendering only on the 5-second poll | `sim_clock.js` interpolates locally every second using the server multiplier. Use `initSimClock()` rather than polling directly |
| Approve returns `409` | The report was already reviewed | Expected. Reload the queue |
| Suite reports `OK (skipped=1)` | Fewer than two pending `ENGINEERING_TRACK` reports for the two override tests to consume | Healthy. Replenish with `fault_generator.tick_reports()` if you want both to execute |

### 11.6 Multi-Laptop Offline Demonstration Guide (Zero Cloud / Local LAN)

The system is architected for presentation across a distributed multi-screen control room network operating completely offline:

1. **Local Network Topology:**
   - Connect all demonstration laptops (up to 4 machines) to a single local Wi-Fi router, an Ethernet network switch, or a smartphone Wi-Fi hotspot.
   - **No active internet connection or cellular data is required.** All basemap assets, libraries, solver algorithms, ML weights, and datasets reside locally on disk.

2. **Host Machine (Central OCC & Optimizer Engine):**
   - Run the bootstrap launcher:
     ```bash
     py -3.13 run_system.py
     ```
   - The Uvicorn ASGI server binds to `0.0.0.0:8000`, making the endpoints accessible across the local subnet.
   - The terminal displays the local network IP:
     ```
     [OCC]  Central OCC Master Desk:  http://127.0.0.1:8000/  (or http://192.168.1.45:8000/)
     [TMS]  Civil / Track (TMS):      http://127.0.0.1:8000/tms
     [TDMS] Traction / OHE (TDMS):    http://127.0.0.1:8000/tdms
     [SMMS] Signal & Telecom (SMMS):  http://127.0.0.1:8000/smms
     ```
   - **Windows Defender Firewall:** Ensure incoming connections on port `8000` are allowed. If client laptops receive connection timeouts, run in PowerShell as Administrator:
     ```powershell
     New-NetFirewallRule -DisplayName "Railways Server 8000" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
     ```

3. **Client Laptop Assignments:**
   - **Master Screen (Projector / Main Display):** `http://<HOST_IP>:8000/` (Central Operations Control Center)
   - **Laptop 1 (Civil Engineering Officer):** `http://<HOST_IP>:8000/tms`
   - **Laptop 2 (Electrical Traction Officer):** `http://<HOST_IP>:8000/tdms`
   - **Laptop 3 (Signalling & Telecom Officer):** `http://<HOST_IP>:8000/smms`

4. **Real-Time Cross-Console Sync:**
   - Submissions from department consoles stream to the central OCC queue in near real-time via the 5-second polling synchronization layer.
   - When the OCC Controller executes **"Auto-Bundle & Sanction"**, CP-SAT re-solves the corridor slot assignments; all client laptops automatically detect the new blocks and unlock the interactive **Sanction Memo** modal.

---

## 12. Visual Design System & UI Polish

This section documents the comprehensive visual overhaul (Phase 16) applied across the OCC dashboard and all four portal screens. The overhaul is a **pure visual polish** — no information architecture, navigation hierarchy, data flows or functionality were changed.

### 12.1 Design Philosophy: Warm Industrial + Editorial Operations

The interface aesthetic was rebuilt from the ground up, moving away from a generic dark-mode dashboard look toward a design language inspired by:

- **Industrial control rooms:** precision, calm information density, functional clarity.
- **Swiss editorial design:** typographic hierarchy, structured whitespace, restrained colour.
- **Engineering field manuals and technical drafts:** warm paper tones, graphite inks, readable at a glance.

The result is an interface that reads as *engineered and human-designed* rather than *generated by a UI toolkit*. Every surface, border, shadow, type size and colour was chosen to serve information hierarchy and sustained reading comfort during long operational shifts.

### 12.2 Implementation Architecture

The visual system is implemented as a single additive CSS layer:

```
style.css           ← structural layout, base tokens, portal branding
corridor_map.css    ← map-specific styling (unchanged)
occ_redesign.css    ← visual overhaul layer (Phase 16) — loaded last
```

`occ_redesign.css` overrides `:root` and `[data-theme="light"]` CSS custom properties, so the entire application inherits the new palette without any structural changes. The `<html>` and `<body>` elements carry `data-theme="light"` to activate the design system. Cache-busting parameters (`?v=warm2`) on all CSS and JS `<link>` / `<script>` tags in `index.html` ensure immediate application.

**Edited files in the visual overhaul:**

| File | Change |
| :--- | :--- |
| `src/frontend/css/occ_redesign.css` | New file — complete warm industrial design system (1,009 lines), Level 0–3 material depth hierarchy, tactile buttons, sanction memo styling |
| `src/frontend/index.html` | `data-theme="light"` attribute, cache-busted asset links, SideNav dynamic anchoring |
| `src/frontend/tms.html` | Linked `occ_redesign.css`, warm industrial surface hierarchy, tactile buttons, sanction memo trigger |
| `src/frontend/tdms.html` | Linked `occ_redesign.css`, warm industrial surface hierarchy, tactile buttons, sanction memo trigger |
| `src/frontend/smms.html` | Linked `occ_redesign.css`, warm industrial surface hierarchy, tactile buttons, sanction memo trigger |
| `src/frontend/js/app.js` | SideNav theme token, matrix header background colours, monthly plan mapping fix |
| `src/frontend/js/portal_review.js` | Added digital Sanction Memo modal renderer (`openSanctionMemoModal`) with official red seal and print styling |
| `src/frontend/js/gantt_chart.js` | Plotly layout updated to warm editorial palette |
| `src/frontend/js/marey_chart.js` | Plotly layout updated to warm editorial palette |

### 12.3 Design Token Reference

#### Atmospheric Canvas & Surface Hierarchy

| Token | Value | Purpose |
| :--- | :--- | :--- |
| `--occ-canvas` | `#F3F0E7` | Warm limestone/paper ground — the base page colour |
| `--occ-panel` | `#FAF9F4` | Primary surface: clean warm technical sheet |
| `--occ-card` | `#FAF9F4` | Elevated functional units (cards, panels) |
| `--occ-card-hover` | `#F0EDE4` | Subtly warmed hover state |
| `--occ-card-inset` | `#E9E6DC` | Recessed wells (incoming queue, execution rail) |

#### Typography Inks

| Token | Value | Purpose |
| :--- | :--- | :--- |
| `--occ-text-primary` | `#242424` | Deep graphite — maximum legibility on warm ground |
| `--occ-text-secondary` | `#4A4A45` | Balanced body and technical reading |
| `--occ-text-muted` | `#6D6D68` | Technical labels, units, column headers |
| `--occ-text-faint` | `#91918B` | Subtle timestamps, inactive annotations |

#### Brand & Operational Accents

| Token | Value | Purpose |
| :--- | :--- | :--- |
| `--color-primary` | `#C69A2B` | Muted railway mustard yellow — primary brand accent |
| `--color-primary-dark` | `#A88120` | Darkened variant for hover and active states |
| `--color-primary-light` | `#DFB74D` | Light variant for badges and highlights |
| `--color-indigo` | `#5C4E75` | Muted plum — joint bundling identity |
| `--color-blue` | `#2B4C6F` | Technical slate blue — directional reference |
| `--color-emerald` | `#56806C` | Muted industrial green — healthy / completed |
| `--color-coral` | `#D66A5F` | Muted dusty coral — warning / approaching conflict |
| `--color-crimson` | `#C94F4F` | Muted red — critical / emergency defect |

#### Department Identity System

Each department carries a triad of `text`, `bg` and `border` tokens for calm, semantic identification:

| Department | Text | Background | Border |
| :--- | :--- | :--- | :--- |
| Track / Civil (TMS) | `#2B4C6F` | `#EAEFF5` | `#C2D1E2` |
| OHE / Traction (TDMS) | `#8A6615` | `#F9F3E5` | `#E5D5A8` |
| Signal & Telecom (SMMS) | `#3B624E` | `#EBF2ED` | `#B9D4C2` |
| AI Bundle (joint) | `#5C4E75` | `#F3EFF7` | `#D5CADF` |

#### Geometry & Elevation

| Token | Value | Rationale |
| :--- | :--- | :--- |
| `--radius-xs` | `2px` | Smallest interactive controls |
| `--radius-sm` | `3px` | Tags and badges |
| `--radius-md` | `4px` | Cards and panels |
| `--radius-lg` | `6px` | Dialogs and modals |
| `--radius-xl` | `8px` | Maximum — sharp, not bulbous |
| `--shadow-sm` | `0 1px 2px rgba(36,36,36,0.04)` | Minimal tactile lift |
| `--shadow-md` | `0 2px 8px rgba(36,36,36,0.06)` | Cards and elevated panels |
| `--shadow-lg` | `0 8px 24px rgba(36,36,36,0.10)` | Modals and overlays |

All shadows are physical (directional), never glowing halos. Elevation is communicated through shadow intensity, never blur-only effects.

### 12.4 Typography

- **Primary stack:** `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `sans-serif`
- **Monospace stack:** `JetBrains Mono`, `SF Mono`, `ui-monospace`, `Menlo`, `monospace`
- **Tabular numerals** (`font-variant-numeric: tabular-nums`) on clocks, timestamps, KPI values, train numbers and coordinates — prevents jitter on live-updating values.
- **Letter spacing:** `0.01em` on body text, `0.06em`–`0.08em` on uppercase labels for editorial readability.

### 12.5 Data Visualization Theming

Plotly Gantt and Marey charts were re-themed to match the warm editorial palette:

**Gantt chart (`gantt_chart.js`):**
- Paper colour: `#FAF9F4` (warm panel), plot background: `#F3F0E7` (canvas)
- Grid lines: `#E2DED4` (subtle border), axis text: `#4A4A45` (secondary ink)
- Title and axis label fonts: Inter, matching the design system

**Marey chart (`marey_chart.js`):**
- Same paper/plot colours as Gantt
- Train type colour mapping: Premium trains in railway mustard, freight in muted blue, express in warm coral
- Maintenance block rectangles: warm amber fill with mustard borders
- Time scrubber: `#C69A2B` mustard with 60% opacity

### 12.6 Toast Notification System

The overhaul introduces a styled toast notification system layered on top of the existing `sim_clock.js` event polling:

| Severity | Border colour | Background | Icon |
| :--- | :--- | :--- | :--- |
| `info` | `--color-blue` | Warm card with blue-tinted left border | ℹ |
| `success` | `--color-emerald` | Warm card with green-tinted left border | ✓ |
| `warning` | `--color-amber` | Warm card with amber-tinted left border | ⚠ |
| `danger` | `--color-crimson` | Warm card with red-tinted left border | ✕ |

Toasts stack from the top-right corner, auto-dismiss after 6 seconds, and respect `@media (prefers-reduced-motion: reduce)` by disabling slide-in animations.

### 12.7 Material Depth & 4-Level Surface Hierarchy Refinement

To eliminate any flat "2D rectangle" appearance while strictly retaining the warm light editorial palette, the system establishes a four-tier tactile material depth model:

| Level | Surface Token | Value | Shadow Affordance | Component Realization |
| :--- | :--- | :--- | :--- | :--- |
| **Level 0** | `--occ-canvas` | `#EFECE3` | Ground plane with 1–2% radial micro-grid | Overall application canvas, workspace foundation |
| **Level 1** | `--occ-panel` | `#F7F5EE` | `0 1px 2px rgba(35,32,25,0.05), 0 1px 3px ...` | Header, SideNav column, Corridor strip, major container shells |
| **Level 2** | `--occ-card` | `#FFFFFF` | `0 1px 2px rgba(35,32,25,0.06), 0 3px 8px ...` | KPI instrument cards, demand queue items, execution block cards |
| **Level Inset**| `--occ-card-inset`| `#EAE6DC` | `inset 0 1px 2px rgba(35,32,25,0.06)` | Recessed card trays holding demand rows and execution rail |
| **Level 3** | Floating UI | `#FFFFFF` | `0 3px 6px rgba(35,32,25,0.06), 0 10px 24px ...` | Modals, What-If simulator, popovers, toast notifications |

Key tactile material refinements:
1. **Specular Top Edge Highlights:** Cards and floating overlays carry `inset 0 1px 0 rgba(255, 255, 255, 0.85–0.90)` to simulate milled physical edges catching diffuse ambient light.
2. **KPI Instrument Pip Strips:** KPI cards feature 2px top semantic indicator lines (mustard, plum, amber, crimson) indicating operational status without saturating entire card surfaces.
3. **Physical Button Physics:** Sanction and primary buttons feature `inset 0 1px 0 rgba(255,255,255,0.14)` specular highlights, subtle contact drop shadows, and true active `translateY(1px)` / inset depression affordances.
4. **Structural SideNav Separation:** Given a distinct grounded panel tone (`#F5F2EA`), thin border, right-edge contact shading, and recessed active tab states with 3px mustard edge markers.
5. **Frozen Leaflet Map Bezel:** The map is 100% frozen; its surrounding frame provides a gentle recessed bezel (`inset 0 1px 3px rgba(35,32,25,0.12)`) integrating it naturally like a physical console display.

### 12.8 Space Optimization & Multi-Portal Harmonization

Following an operational audit at standard laptop screen resolution (`1536 × 730 px`), five refinements were implemented:
1. **Vertical Headroom Reclamation (+18.5% Map Area):**
   - KPI row height tightened from `62px` to `52px`; Corridor Strip widget height compressed from `108px` to `80px`.
   - SideNav offset `--shell-top` repositioned from `252px` to `196px`.
   - The central Leaflet Satellite Map expands vertically from `280px` to `~330px`, eliminating the letterbox effect and displaying a much broader section of the corridor track without panning.
2. **Execution Rail Horizontal Navigation & Text Clamping:**
   - Interactive chevron scroll buttons (`‹` and `›`) added into the `IN EXECUTION` header with smooth scroll physics (`window.scrollExecRail`).
   - Deferred reason descriptions clamped to 2 lines (`-webkit-line-clamp: 2`) with full native hover tooltips to prevent clipping at card borders.
3. **Engineered Empty-State Card:**
   - When all demands are sanctioned, the queue displays an active operational status card with a pulsing green heartbeat badge (*"Telemetry Active · Continuous Scan"*).
4. **Multi-Portal Aesthetic Harmonization (TMS, TDMS, SMMS):**
   - Linked `occ_redesign.css` to `tms.html`, `tdms.html`, and `smms.html` so all departmental laptops in a multi-device demo share matching limestone ground, graphite typography, and material depth.
   - Staggered corridor map station labels (NDLS, GZB, DER, KRJ, ALJN) vertically using odd/even offsets to prevent label collision blobs.
5. **30-Day Strategic Plan Template Fix:**
   - Corrected variable mapping in `app.js` (`renderMonthlyStrategicPlan`) to consume real `asset_id`, `work_type`, `target_window`, and `predicted_rul_days`.
6. **KPI Card Text Fit & Dynamic SideNav Anchoring:**
   - Fixed text collision and bottom clipping in `.kpi-card` by applying `align-items: stretch !important` and `gap: 0 !important` to override legacy flex centering from `style.css`, setting a comfortable `58px` height with full-width distribution between label and context subtitles.
   - Dynamically anchored the left SideNav (`.sn-root`) via `ResizeObserver` and `layoutShell()` to sit exactly `6px` below `#strip-wrap.getBoundingClientRect().bottom`, preventing any vertical overlap on corridor possession tracks or station nodes.

### 12.10 Digital Block Sanction Memorandum Modal (BDMS Form IR-BLK-104)

To bridge AI scheduling with statutory Indian Railways operational procedures, the system implements an interactive digital **Block Sanction Memorandum modal** (`openSanctionMemoModal` in `portal_review.js`):

1. **Visual Language & Surface Realization:**
   - Designed with an authentic, high-contrast dark terminal surface (`#0d1117` ground, `#30363d` structural border) to distinguish statutory legal authorization orders from standard operational triage views.
   - Accented with an official circular red Section Controller authorization seal (`SANCTIONED · CHIEF CONTROLLER OCC · NORTH CENTRAL RAILWAY`) rendered in SVG.
2. **Statutory Fields & Codal Compliance:**
   - **Memo Metadata:** Unique Sanction Reference Number, Section boundaries, Line designation (UP / DN), and exact granted possession window times (Start to Finish).
   - **Bundled Departments:** Explicit breakdown of Civil P-Way gang assignments, Electrical Traction 25 kV AC isolation permit IDs, and Signalling Disconnection Form S&T/T-351 authorizations.
   - **Operational Restrictions:** Machine fleet clearances, speed restriction cautions (TSR), and Station Master acknowledgment blocks.
3. **Physical Print & Export Dispatch:**
   - Implements dedicated print media styling (`@media print` in `occ_redesign.css`), automatically stripping out navigation chrome, backgrounds, and action buttons to produce a standardized, black-and-white printout ready for physical sign-off and station dispatch.

### 12.11 Structural Preservation Guarantee

The visual overhaul changed **zero** backend Python files and **zero** API endpoints. The following were explicitly preserved:

- All navigation hierarchy and tab structure
- Information architecture and component placement
- Data flows, polling intervals and WebSocket patterns
- Leaflet GIS satellite map and corridor route visualization
- CTC schematic board and SVG yard interlocking renderer
- All 72 unit and integration tests (all passing)

The overhaul is entirely reversible by removing the `occ_redesign.css` `<link>` tag from `index.html` and reverting the Plotly layout objects in `gantt_chart.js` and `marey_chart.js`.

---

<div align="center">

**Indian Railways AI Automatic Block Planning System** &bull; Production Architecture Handbook
MIT Open-Source License &bull; Repository: [srivastava-himanshu382/ABMaS](https://github.com/srivastava-himanshu382/ABMaS)

</div>
