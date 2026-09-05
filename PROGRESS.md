# PROGRESS.md — Active Development Tracking

## 1. Current Phase
- **Phase:** Phase 14 — Corridor Map Service (Dual-Track Geospatial Layer Engine) Shipped & Verified Locally
- **Status:** The corridor map is now an independent, reusable service rendering UP and DN as two distinct tracks and driven entirely by live simulator state. It powers the Central OCC desk and all three department portals from one implementation; the old single-polyline `gis_map.js` is retired. All 69 unit & integration tests pass (69/69 in ~3.4s), and all four pages render with zero console errors.

---

## 2. Completed Features (Shipped & Verified)

### Phase 14 — Corridor Map Service (`src/map_service/`, `js/corridor_map.js`)
- **Independent, reusable map service.** A backend read-model package (`src/map_service/`) plus a drop-in frontend module. Any page adopts it in one call: `CorridorMap.mount("#el", { department, layers, onInspect })`. Served over `/api/map/*` from `src/api/map_router.py`; the OCC and the three portals differ only in department and layer set.
- **Dual-track UP/DN rendering.** `geometry.py` is the single authority for chainage → WGS-84, publishing the centreline plus a per-vertex bearing. The parallel offset is applied client-side per zoom (~6 px each side of centre, clamped 3 m–5 km), so the rails read as two clearly separate lines on the 440 KM overview and converge toward realistic spacing by zoom 16. Station beacons sit on the centreline, bridging the pair.
- **Six live layers, one feature shape.** `issues` (field reports awaiting review), `blocks` (sanctioned possessions with live execution state), `powercuts` (blocks carrying 25 kV isolation), `routines` (statutory inspections due/overdue), `assets` (wear needing attention now vs near term), `health` (per-section S&T system health drawn as coloured spans). Severity drives marker colour uniformly across all of them.
- **Live train movement.** `trains.py` interpolates all 29 timetabled trains between their bracketing stops against the accelerated clock. Markers are moved with `setLatLng`, never recreated, so a 2 s poll reads as continuous motion.
- **Inspect → prefilled form → Request Block.** Hovering a reported issue shows a compact card; clicking opens the full record with site photos and inspection PDF, and an Inspect action that opens a fully prefilled block requisition. The officer's only required action is the *Request Block* button at the end. Submits to the existing approve endpoint, which now accepts optional officer overrides.
- **Wired to the simulator.** Layers read live worker requests, demands and `block_lifecycle.live_state()` — the same function `/api/live/board` uses — so the map and the OCC execution board can never disagree.
- **Retired:** `src/frontend/js/gis_map.js` (single-polyline static map). Its satellite/dark basemaps, station quick-jump and yard drill-down are preserved inside the new module.

### Earlier phases
- **Leaflet Geospatial Satellite Radar Map (`gis_map.js`):** Interactive geospatial map powered by Leaflet.js with ESRI World Imagery (High-Resolution Satellite) and CartoDB Dark Matter tile engines, mapping the full 440 KM New Delhi – Kanpur Central corridor with precise GPS station anchors and a high-contrast electric cyan railway mainline polyline (`#38bdf8`).
- **3-Way Corridor View Toggle:** Seamless 1-click switching between 🛰️ Satellite Radar (ESRI), 🌙 Dark GIS (CartoDB), and 📐 Centralized Traffic Control (CTC) Schematic Board.
- **Quick-Jump Station Navigation Chips:** Clickable horizontal chip bar (`📍 NDLS` through `📍 CNB`) featuring smooth `flyTo` camera easing, auto-zoom (level 13.5), and automated station popup opening.
- **Animated Shadow Block Radar Pings:** Active scheduled blocks rendered with glowing neon boundaries (Crimson `#f43f5e` for multi-department bundles, Amber `#f59e0b` for single blocks), animated dash arrays, and multi-ring pulsating radar wave beacons at possession epicenters.
- **Rich Glassmorphic Map Popups & Cross-Module Drill-Downs:** Station and block popups displaying operational metrics (max speed, platforms, ABS signalling, 25 kV traction, depot fleets, approved windows, downtime saved) with direct 1-click action buttons to *"Inspect Yard Interlocking"* and *"Test Disruption"*.
- **Modal Stacking Context & Z-Index Isolation:** Elevated modal overlay z-indexes (`z-index: 2000+`) and isolated Leaflet map stacking context to guarantee zero map canvas bleed-through under interactive modals.
- **Multi-Department Console Portals (TMS, TDMS, SMMS):** Built 3 dedicated, authentic Indian Railways departmental portals:
  - `http://127.0.0.1:8000/tms` &rarr; Track Management System (IRCEP Civil Engineering) with Steel Blue branding, tamping/BCM requisitions, and live approved status table.
  - `http://127.0.0.1:8000/tdms` &rarr; Traction Distribution Management System (RailSaver TRD) with High-Voltage Amber branding, auto-enforced 25 kV AC power cuts, tower wagon requests, and power permits.
  - `http://127.0.0.1:8000/smms` &rarr; Signal Maintenance Management System (SMMS IR) with Forest Emerald branding, auto-enforced S&T/T-351 disconnection notices, and point overhaul requests.
- **Central OCC Live Demand Queue & AI Shadow Bundler:** Main dashboard features a live pending demand feed with live unbundled downtime calculation (e.g. 8.5 Hrs), department color badges, and an "Auto-Bundle & Sanction Shadow Block" action button that merges co-located demands into 1 single shadow block (e.g. 3.5h at 02:00 IST).
- **Multi-Device LAN Access:** Server binds to `0.0.0.0:8000` with local IP discovery, enabling phones and tablets to act as field terminals.
- **Compact Backup Simulator Button:** What-If simulator transformed into a compact, subtle icon button in the header for backup demo usage.
- **Comprehensive Test Suite:** 19/19 integration tests passing cleanly.
- **Microsoft Fluent Design System Overhaul:** Clean light theme (`#f8fafc`/`#ffffff`), authentic Microsoft Fluent vector SVGs (sourced from `iconify.design/fluent`), live corridor ticker in header (`Capacity: 94.2%`), and mini sparkline progress bars in KPI cards.
- **Tabular Numerals & Typography Engine:** Enabled `font-feature-settings: "tnum"` for zero text jitter across clocks, timestamps, train numbers, and coordinates.
- **Asset Hub Live Search & SHAP Waterfall Bars:** Live instant filtering by typing query, visual horizontal feature attribution bars (Red/Amber/Slate) in XAI diagnostic cards, and a 1-click "Simulate Maintenance Repair" action resetting asset health to 100%.
- **Marey Chart Live Time Scrubber:** Vertical indicator line showing current real-time clock (IST) intersecting scheduled train paths and maintenance blocks, plus quick category filter chips (`Rajdhani / Vande Bharat`, `Express`, `All`).
- **Yard Interlocking Interactive Controls (Option C):** Layer visibility toggles (`Points`, `Signals`, `25kV OHE`), route switch position toggle (`Normal` vs `Reverse` loop), and SVG pan/zoom controls.
- **1-Click Judge Pitch Presets in Simulator:** Instant crisis scenario buttons (*Fog Delay*, *Rail Fracture*, *OHE Snag*) for live hackathon pitch demonstrations.
- **Global Keyboard Navigation:** `1` to `6` keys to switch tabs instantly, `Escape` to close modals.
- **RDSO Digital Twin & Data Synthesis:** 10-station NDLS-CNB corridor topology (`ndls_cnb_corridor.json`), 29-train timetable (`ndls_cnb_real_timetable.csv`), and 1,850 maintenance defect records across TMS, TDMS, SMMS adhering to IRPWM/ACTM/IRSEM standards.
- **ML Intelligence Pipeline:** XGBoost Risk Classifier (**0.9751 ROC-AUC**, 91% accuracy), XGBoost RUL Regressor (RMSE 67.6d), Random Forest Duration Regressor (**RMSE 12.25 min**), and SHAP Explainability Engine with lazy loading.
- **Google OR-Tools CP-SAT Scheduler:** Multi-department shadow block optimizer achieving **78.7% corridor downtime reduction** (78.0 hours saved) and **100% multi-department bundling rate** with zero train delays.
- **Multi-Horizon Block Planner:** 30-Day Strategic Macro Plan (balanced renewal project allocations) and 7-Day Tactical Matrix (gang rostering with dynamic shift KPIs).
- **Dynamic Disruption Simulator:** Real-time delay and emergency defect solver recalculating conflict-free schedules in **0.40 seconds**.
- **Git & GitHub Repository Deployment:** Pushed full codebase to [`https://github.com/Flyinace/Railways`](https://github.com/Flyinace/Railways) on the `main` branch.

---

## 3. In Progress
- System is feature-complete with a 100% test pass rate (69/69 tests).
- **Note for the next session:** the realtime simulator was committed in `add4c9c` ("full realtime simulator ready"). That commit also swept up three Corridor Map Service files (`src/map_service/__init__.py`, `geometry.py`, `layers.py`) while they were still mid-write, so `layers.py` has since changed and the rest of the map service — `map_service/trains.py`, `api/map_router.py`, `js/corridor_map.js`, `js/block_request.js`, `css/corridor_map.css`, `tests/test_map_service.py` — is still untracked. The whole map service should go in as one follow-up commit.
- Ready for hackathon presentation, video recording, live demos, or packaging.

---

## 4. Known Bugs & Open Issues
- *No critical or blocking bugs open.* (All 69 integration tests pass cleanly in ~3.4s; all 4 portal workflows and the corridor map validated in a live headless browser with zero console errors.)

---

## 5. Verification Commands (Exact & Copy-Pasteable)

### 5.1 Run Entire Unit & Integration Test Suite (19 Tests)
```powershell
py -3.13 -m unittest discover tests/
```
*Expected Result: `Ran 69 tests in ~3.4s -> OK`*

### 5.2 Test Multi-Department Demand Lifecycle & Bundling
```powershell
py -3.13 -c "from fastapi.testclient import TestClient; from src.api.main import app; c = TestClient(app); print('Pending Queue:', c.get('/api/demand/pending').json()['total_pending'])"
```

### 5.3 Launch 4-Portal Enterprise Control Network
```powershell
py -3.13 run_system.py
```
*Expected Result: Master OCC running on `http://127.0.0.1:8000/`, with TMS on `/tms`, TDMS on `/tdms`, and SMMS on `/smms`.*

