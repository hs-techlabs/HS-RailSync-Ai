# PROGRESS.md — Active Development Tracking

## 1. Current Phase

- **Phase:** Phase 15 — OCC Control-Room Dashboard Redesign, shipped and verified locally
- **Status:** Feature-complete. The OCC landing screen is rebuilt for a control room under load: one 44 px header, a hard-contrast ground, label-only headings, and a fixed 50/50 split between incoming demands and in-flight blocks, with motion carrying every arrival and state change. All **72 unit and integration tests pass**, and all four pages render with zero console errors in both the default and reduced-motion paths.
- **Verified against:** commit `bc594e7` plus the uncommitted Phase 15 working tree.
- **Repository:** [`srivastava-himanshu382/ABMaS`](https://github.com/srivastava-himanshu382/ABMaS), branch `main`.

### Current headline numbers

| Measure | Value |
| :--- | :--- |
| Tests | 72 passing |
| API endpoints | 31 JSON + 4 HTML page routes |
| Corridor | 440 KM, 10 stations, 9 sections, double line |
| Timetable | 29 trains, 290 station-stops (16 DN / 13 UP) |
| Backlog | 1,850 assets (850 track / 550 OHE / 450 S&T) |
| Feasible slots | 87 |
| Candidate bundles | 494, truncated to 20 for the solver |
| Blocks scheduled | 6, covering 33 tasks |
| Downtime reduction | 78.7% (78.03 h saved against a 99.1 h baseline) |
| Multi-department bundling rate | 100% |
| Classifier | ROC-AUC 0.9751, accuracy 91.1% |
| RUL regressor | RMSE 67.6 days |
| Duration estimator | RMSE 12.25 min |

---

## 2. Completed Features (Shipped & Verified)

### Phase 15 — OCC Control-Room Dashboard Redesign (`index.html`, `style.css`, `app.js`)
- **Header cut from 88 px to one 44 px row.** Removed the subtitle, the Capacity / Signalling / Traction ticker and the zone tag. The three portal links compressed to department-coloured chips, and Reset Simulator was demoted to an icon.
- **Contrast pass, delivered as an additive token layer.** Rather than editing the base `:root` palette, the redesign introduces `--occ-ground: #e9eef5`, `--occ-rule: #cbd5e1`, `--occ-edge: #94a3b8` and `--occ-body: #475569` scoped to the OCC screen. The old `#f8fafc` ground against `#ffffff` cards with `#e2e8f0` borders gave almost no separation, so nothing announced itself. Because the change is additive, the three department portals kept the original palette and needed no rework.
- **Section headings are labels only** — `INCOMING` and `IN EXECUTION` plus a bare numeral count. All trailing prose deleted.
- **Fixed 50/50 split** replacing the stacked sections: incoming demands and in-flight blocks each own half the viewport and scroll independently, so a burst of arrivals can never push the execution board off screen. Auto-Bundle moved to the foot of the incoming column. Below 1180 px the split collapses to one column with each half capped at 60 vh.
- **KPI strip compressed** from four cards to one 26 px line. The six tabs were kept with short labels, and a tab click now scrolls its pane into view since the board fills the first screen.
- **Motion on live change.** Arriving demands slide in with a department accent flash and an amber wash that fades to rest; the count numeral pops; blocks entering execution animate in and then pulse; progress bars animate their width; withdrawals shake and reveal their reason. All guarded by `prefers-reduced-motion`.
- **Keyed DOM reconciliation (`reconcileKeyed`)** underpins both boards. They previously repainted wholesale on every 5 s poll, which is why arrivals were invisible and why an animation class alone would have replayed on every poll. Nodes are now matched by demand ID, so only genuine changes touch the DOM.

### Phase 14 — Corridor Map Service (`src/map_service/`, `js/corridor_map.js`)
- **Independent, reusable map service.** A backend read-model package plus a drop-in frontend module. Any page adopts it in one call: `CorridorMap.mount("#el", { department, layers, onInspect })`. Served over `/api/map/*` from `src/api/map_router.py`; the OCC and the three portals differ only in department and layer set.
- **Dual-track UP/DN rendering.** `geometry.py` is the single authority for chainage → WGS-84, publishing the centreline plus a per-vertex bearing. The parallel offset is applied client-side per zoom (~6 px each side of centre, clamped 3 m–5 km), so the rails read as two clearly separate lines on the 440 KM overview and converge toward realistic spacing by zoom 16. Station beacons sit on the centreline, bridging the pair.
- **Seven live layers, one feature shape.** `issues` (field reports awaiting review), `demands` (requisitions raised to the OCC), `blocks` (sanctioned possessions with live execution state), `powercuts` (blocks carrying 25 kV isolation), `routines` (statutory inspections due or overdue), `assets` (wear needing attention now vs near term), `health` (per-section S&T system health as coloured spans). Severity drives marker colour uniformly across all of them, so the glyph is what identifies the layer.
- **Live train movement.** `trains.py` interpolates all 29 timetabled trains between their bracketing stops against the accelerated clock. Markers are moved with `setLatLng`, never recreated, so a 2 s poll reads as continuous motion.
- **Inspect → prefilled form → Request Block.** Hovering a reported issue shows a compact card; clicking opens the full record with site photos and inspection PDF, plus an Inspect action that opens a fully prefilled block requisition. The officer's only required action is the *Request Block* button at the end. It submits to the existing approve endpoint, which now accepts optional officer overrides — so the map flow and the plain approve button share one endpoint and produce identical demand records.
- **Wired to the simulator.** Layers read live worker requests, demands and `block_lifecycle.live_state()` — the same function `/api/live/board` uses — so the map and the OCC execution board can never disagree.
- **Failure isolation.** A layer that raises is reported as an empty list plus an `errors` entry rather than failing the whole response. One bad layer never blanks the map on a live demo.
- **Retired:** `src/frontend/js/gis_map.js` (single-polyline static map). Its satellite/dark basemaps, station quick-jump and yard drill-down are preserved inside the new module.
- **Covered by** `tests/test_map_service.py` — 29 tests across geometry, layers, trains, the HTTP surface, and block-request overrides.

### Phase 13 — Live Corridor Simulator (`src/simulator/`)
- **Stateless 80× accelerated clock (`virtual_clock.py`).** Simulated now is a pure function of real elapsed time since boot, so nothing can desynchronise. 24 simulated hours pass in ~18 real minutes. The epoch is pinned to 05:00 deliberately: on this timetable every window long enough to host a real block (≥ 200 min) starts between 06:00 and 12:00, so booting at 05:00 leaves the entire usable band ahead of the clock and a report approved in the first minute of a demo starts executing within a couple of real minutes.
- **Lock-ordered state layer (`sim_state.py`).** Three JSON stores, three locks, and two absolute rules: hold the lock across the whole read-modify-write, and always acquire `worker_requests → demands → events`. Includes the sequenced event log (eight event kinds, capped at 200) that drives notification toasts on all four screens via a high-water-mark feed.
- **Field-report generator daemon (`fault_generator.py`).** Manufactures worker-submitted reports from real `ml_predictions.csv` rows, carrying forward tier, criticality, machine and safety flags rather than randomising them. Restricts its candidate pool to locations the slot finder can actually host a block on, excludes assets already open, enforces 8 km per-department spacing while deliberately allowing cross-department co-location, samples uniformly to preserve the dataset's natural priority spread, and resyncs the stale tier baked into dataset description text. Each report attaches 1–2 site photos plus an inspection PDF.
- **Block lifecycle engine (`block_lifecycle.py`).** Walks sanctioned demands `APPROVED_SHADOW_BLOCK → IN_PROGRESS → COMPLETED`, with occasional control-office withdrawal modelled conservatively: at most one per 90 simulated minutes, 30% probability, never the last remaining block, never one already under way. Seven realistic withdrawal reasons.
- **Officer review workflow.** `POST /api/worker_requests/{id}/approve` and `/reject`, with 404 on unknown and 409 on double review. Approval routes through the same `_create_pending_demand` the manual form uses, which is why nothing downstream needed to change.
- **Live execution board (`GET /api/live/board`).** Combines derived block state against the simulated day with persisted demand lifecycle state.
- **Field evidence.** `data/attachments/{track,ohe,signal}/` served at `/attachments/*`, generated once by `scripts/generate_attachments.py`. Nothing under `data/` was web-servable before this mount.
- **Test isolation.** `RAILWAY_SIM_AUTOSTART=0` gates the daemon so it never mutates state underneath an assertion.
- **Covered by** `tests/test_realtime_simulator.py` — 24 tests across the clock, generator, review workflow, lifecycle, event feed and attachment serving.

### Phase 12 and earlier
- **Multi-department console portals (TMS, TDMS, SMMS).** Three dedicated departmental portals with authentic branding and auto-enforced safety rules:
  - `/tms` → Track Management System (IRCEP Civil Engineering), Steel Blue `#1e40af`, tamping and BCM requisitions.
  - `/tdms` → Traction Distribution Management System (RailSaver TRD), High-Voltage Amber `#b45309`, auto-enforced 25 kV AC power cuts and tower wagon requests.
  - `/smms` → Signal Maintenance Management System (SMMS IR), Forest Emerald `#047857`, auto-enforced S&T/T-351 disconnection notices.
- **Shared review console (`portal_review.js`).** The three portals differ only in department code, accent colour and a couple of table columns, so the whole review workflow — pending queue, evidence lightbox, approve/reject, reviewed history — lives once. Six demand statuses rendered with distinct badges.
- **Central OCC live demand queue and CP-SAT shadow bundler.** Live pending-demand feed with unbundled downtime totalling, department colour badges, and an Auto-Bundle & Sanction action that merges co-located demands into unified shadow blocks. Demands with no feasible window are honestly reported as `DEFERRED_NEXT_CYCLE` with a reason rather than handed another block's window.
- **Priority-task admission in the solver.** Freshly raised demands score ~95 against a truncation cut-off above 350, so they were being discarded before CP-SAT ever evaluated them and then reported deferred. Bundles carrying a priority task are now admitted first and carry a 2000-point objective bonus, plus an 800-point soft preference for windows still ahead on the operating clock.
- **Absolute window resolution.** Sanctioned windows resolve from bare `"HH:MM"` strings to absolute simulated datetimes, so the lifecycle engine survives the simulated day wrapping and a window already past today is labelled `TOMORROW` rather than silently expiring.
- **Multi-device LAN access.** Server binds `0.0.0.0:8000` with local IP discovery, so phones and tablets act as field terminals.
- **Microsoft Fluent design system.** Clean light theme, authentic Fluent vector SVGs, tabular numerals (`font-feature-settings: "tnum"`) for zero jitter across clocks, timestamps, train numbers and coordinates.
- **Asset hub live search and XAI cards.** Instant client-side filtering, horizontal feature attribution bars, and a Simulate Maintenance Repair action.
- **Marey chart live scrubber.** Vertical indicator at the current corridor time intersecting train paths and maintenance blocks, plus category filter chips.
- **Yard interlocking interactive controls (Option C).** Layer toggles for points, signals and 25 kV OHE; route switch position toggle (Normal vs Reverse); SVG pan and zoom; and a point inspector with a jump into the XAI card.
- **What-If simulator with one-click presets.** Fog Delay (`12424` Rajdhani +45 min), Rail Fracture (`TDL – FZD` DN), OHE Snag (`GZB – DER` UP). Retained as a compact backup demo path in the header.
- **Global keyboard navigation.** `1`–`6` switch tabs, `Escape` closes modals.
- **RDSO digital twin and data synthesis.** 10-station corridor topology with GPS anchors, IRSEM yard layouts for all 10 stations, a 29-train timetable, and 1,850 defect records across TMS, TDMS and SMMS adhering to IRPWM, ACTM and IRSEM standards with per-generator deterministic seeds (42 / 43 / 44).
- **ML intelligence pipeline.** XGBoost risk classifier (0.9751 ROC-AUC, 91.1% accuracy, 0.868 F1), XGBoost RUL regressor (RMSE 67.6 d), Random Forest duration estimator (RMSE 12.25 min), and a lazily loaded SHAP explainability engine with rule-based controller cards. Graceful `GradientBoosting` fallback when XGBoost is absent.
- **Google OR-Tools CP-SAT scheduler.** Multi-department shadow block optimizer achieving 78.7% corridor downtime reduction (78.03 hours saved) and a 100% multi-department bundling rate with zero passenger train delay, plus a greedy first-fit fallback when OR-Tools is absent.
- **Multi-horizon block planner.** 30-day strategic macro plan with week-balanced renewal allocation and resource projection, and a 7-day tactical matrix with gang rostering and shift KPIs.
- **Dynamic disruption simulator.** Real-time delay and emergency defect solver recalculating conflict-free schedules in well under a second.
- **BDMS sanction memoranda.** Formal Block Sanction Memorandum generation with memo reference, chainage, sanctioned window, bundled requisitions, power block and disconnection status, machines and caution orders.

---

## 3. In Progress

- Nothing in flight. The system is feature-complete with a 100% test pass rate (72/72).
- **Working tree state:** the Phase 15 OCC redesign is complete and verified but **not yet committed**. Modified files awaiting a commit: `PROGRESS.md`, `src/frontend/index.html`, `src/frontend/css/style.css`, `src/frontend/js/app.js`, `src/frontend/js/corridor_map.js`, `src/map_service/layers.py`, `tests/test_map_service.py`, plus regenerated runtime state in `data/processed/optimized_schedule.json` and `pending_demands.json`.
- **Resolved:** the earlier note about the Corridor Map Service being partly untracked no longer applies. Commit `bc594e7` ("map service ready to use") landed the complete service — `map_service/trains.py`, `api/map_router.py`, `js/corridor_map.js`, `js/block_request.js`, `css/corridor_map.css` and `tests/test_map_service.py` — and retired `js/gis_map.js`. There are no untracked files.
- Ready for hackathon presentation, video recording, live demos, or packaging.

---

## 4. Known Bugs & Open Issues

- *No critical or blocking bugs open.* All 72 tests pass cleanly; all four portal workflows and the corridor map validated in a live headless browser with zero console errors.
- **Expected non-failure:** the suite may report `OK (skipped=1)`. The two `TestBlockRequestOverrides` tests each consume a pending `ENGINEERING_TRACK` field report by approving it, and skip themselves when the queue is empty. With the daemon disabled for testing, back-to-back runs can leave fewer than two available. Replenish with one generator tick to run both (see §5.8).

### Structural constraints (properties of the data, not defects)
These are documented in `CONTEXT.md` §7 and are depended on by code:

| Constraint | Consequence |
| :--- | :--- |
| `ALJN – TDL` never opens a 45-minute headway gap | No block can be scheduled there; the fault generator excludes it from its pool |
| `CNB` is the terminal station | No section starts there; also excluded |
| 161 S&T assets sit on `line = "YARD"` | Not schedulable as corridor blocks; rendered as station yards |
| The corridor has 10 surveyed anchors, no shape points | Alignment between stations is a straight chord until `shape_points` is supplied |
| `end_time` in the schedule may read past 24:00 (e.g. `"25:30"`) | `parse_hhmm` returns unwrapped minutes; callers decide how to roll them |
| The backlog CSV is sparse across departments | Every response path must scrub `NaN` before serialization |

### Candidate follow-ups (none blocking)
- Commit the Phase 15 OCC redesign as one changeset.
- The solver enforces tamping (≤ 2) and tower wagon (≤ 3) fleet limits only; BCM, USFD trolleys and signal gangs are declared in the topology but currently advisory.
- `data.txt` and `model.txt` are legacy prototype scratch files at the repository root, never imported or executed. They could be deleted or moved into a `prototype/` folder.
- `POST /api/demand/raise` is a manual override path that no portal UI calls any more. It still works and is covered by tests; retained deliberately.

---

## 5. Verification Commands (Exact & Copy-Pasteable)

### 5.1 Run the entire unit and integration test suite (72 tests)
```powershell
py -3.13 -m unittest discover tests/
```
*Expected:* `Ran 72 tests ... OK` (or `OK (skipped=1)` — see §4)

Per-module breakdown: `test_data_generator` 7, `test_system_integration` 12, `test_realtime_simulator` 24, `test_map_service` 29.

Run one module verbosely:
```powershell
py -3.13 -m unittest tests.test_map_service -v
```

### 5.2 Launch the 4-portal enterprise control network
```powershell
py -3.13 run_system.py
```
*Expected:* Master OCC on `http://127.0.0.1:8000/`, with TMS at `/tms`, TDMS at `/tdms`, SMMS at `/smms`, and interactive API docs at `/docs`. The LAN address is printed for multi-device access.

### 5.3 Check the OCC demand queue
```powershell
py -3.13 -c "import os; os.environ['RAILWAY_SIM_AUTOSTART']='0'; from fastapi.testclient import TestClient; from src.api.main import app; c=TestClient(app); d=c.get('/api/demand/pending').json(); print('Pending:', d['total_pending'], '| Unbundled hours:', d['total_unbundled_hours'])"
```

### 5.4 Verify the optimizer end to end
```powershell
py -3.13 src/optimizer/ortools_scheduler.py
```
*Expected:* `Building Google OR-Tools CP-SAT Model with 20 candidate bundles and 87 slots...` then `Optimal schedule generated: 6 blocks approved.` and `Downtime Reduction: 78.7% (Saved 78.0 hours of track possession)`

### 5.5 Verify the Corridor Map Service
```powershell
py -3.13 -c "import os; os.environ['RAILWAY_SIM_AUTOSTART']='0'; from src.map_service import geometry, trains; g=geometry.corridor_geometry(); print('Centreline:', len(g['centreline']), 'Stations:', len(g['stations']), 'Sections:', len(g['sections'])); print('Trains running:', len(trains.live_trains()))"
```

### 5.6 Verify ML model metrics
```powershell
py -3.13 src/ml_engine/train_models.py
```
*Expected:* ROC-AUC `0.9751`, RUL RMSE `67.63` days, duration RMSE `12.25` minutes.

### 5.7 Regenerate everything from scratch
```powershell
py -3.13 src/generator/generate_all.py
py -3.13 src/ml_engine/train_models.py
py -3.13 src/ml_engine/predict.py
py -3.13 src/optimizer/ortools_scheduler.py
```

### 5.8 Replenish the field-report queue (so no test self-skips)
```powershell
py -3.13 -c "import os; os.environ['RAILWAY_SIM_AUTOSTART']='0'; from src.simulator import fault_generator; print(len(fault_generator.tick_reports()), 'reports generated')"
```
*Generates at most one report per department. Run twice for two pending track reports.*

### 5.9 Reset the simulator before a demo
```powershell
py -3.13 -c "import os; os.environ['RAILWAY_SIM_AUTOSTART']='0'; from fastapi.testclient import TestClient; from src.api.main import app; print(TestClient(app).post('/api/simulator/reset').json()['message'])"
```
Or press the reset icon in the OCC header. Clears field reports, OCC demands and notifications in one call.

---

## 6. Demo Script (5 minutes)

1. **Reset** — press the reset icon in the OCC header. Both columns clear.
2. **Wait ~30 seconds** — the fault generator emits one field report per department. Toasts appear on the OCC desk and each portal.
3. **Open `/tms`** — the report is in the review queue *and* on the corridor map as an `issues` marker, from one source.
4. **Click Inspect on the map marker** — a fully prefilled requisition opens with site photos and the inspection PDF attached. Press **Request Block**.
5. **Return to the OCC** — the demand animates into the INCOMING column with its department accent, and appears on the OCC map as a dashed `demands` span.
6. **Repeat for `/tdms` and `/smms`** so co-located demands accumulate on one section.
7. **Press AUTO-BUNDLE & SANCTION** — CP-SAT merges the co-located multi-department demands into one shadow block, and each demand shows its sanctioned window labelled TODAY or TOMORROW.
8. **Watch IN EXECUTION** — at 80×, the block reaches its window within a couple of real minutes, animates into execution, and its progress bar advances. Occasionally control withdraws an upcoming block with a stated reason.
9. **Open the Memo tab** — print the formal BDMS Block Sanction Memorandum for the sanctioned block.
10. **Backup path** — if anything stalls, the header simulator icon offers three one-click crisis presets (Fog Delay, Rail Fracture, OHE Snag) that re-solve the corridor in under a second.
