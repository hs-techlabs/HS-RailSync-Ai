"""
Comprehensive System Integration Tests.
Tests ML features, slot finding, multi-department bundling, OR-Tools optimization,
multi-horizon planning, real-time disruption recovery, and station yard interlocking API.
"""

import unittest
import os
import sys
import time
import json
import pandas as pd
import numpy as np

# Keep the background field-report generator asleep during tests - it would
# otherwise append reports and advance block lifecycles underneath assertions.
os.environ["RAILWAY_SIM_AUTOSTART"] = "0"

from fastapi.testclient import TestClient

# Ensure root directory is in python path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(ROOT_DIR)

from src.generator.rdso_formulas import calculate_composite_criticality, calculate_tgi, calculate_wire_wear_percentage
from src.ml_engine.feature_pipeline import extract_features, FEATURE_COLUMNS
from src.optimizer.slot_finder import find_available_corridor_slots
from src.optimizer.bundling_engine import cluster_maintenance_tasks
from src.optimizer.ortools_scheduler import ORToolsBlockScheduler
from src.optimizer.multi_horizon import generate_monthly_strategic_plan, generate_weekly_tactical_plan
from src.simulator.disruption_engine import DisruptionSimulator
from src.api.main import app


class TestSystemIntegration(unittest.TestCase):

    def test_feature_pipeline(self):
        sample_df = pd.DataFrame([{
            "asset_id": "TRK-001",
            "department": "ENGINEERING_TRACK",
            "rail_age_years": 10,
            "cumulative_gmt": 350.0,
            "tgi_composite": 62.5,
            "rail_temperature_c": 48.0,
            "rainfall_mm_7day": 45.0,
            "days_since_last_maintenance": 90,
            "speed_restriction_active": True
        }])

        features = extract_features(sample_df)
        self.assertEqual(len(features.columns), 18)
        self.assertFalse(features.isnull().values.any())
        self.assertEqual(features["is_track_dept"].iloc[0], 1)
        self.assertEqual(features["is_ohe_dept"].iloc[0], 0)
        self.assertEqual(features["has_active_tsr"].iloc[0], 1)

    def test_safe_criticality_calculation(self):
        # Test with NaN and missing TSR fields
        crit_nan = calculate_composite_criticality(0.8, 15, "A", 1.0, np.nan)
        self.assertGreater(crit_nan, 0.0)
        self.assertLessEqual(crit_nan, 100.0)

        # Test with active TSR
        crit_tsr = calculate_composite_criticality(0.8, 15, "A", 1.0, True)
        self.assertEqual(round(crit_tsr - crit_nan, 1), 15.0)

    def test_slot_finder(self):
        tt_path = os.path.join(ROOT_DIR, "data", "raw", "ndls_cnb_real_timetable.csv")
        self.assertTrue(os.path.exists(tt_path), "Timetable CSV must exist")

        slots = find_available_corridor_slots(tt_path)
        self.assertGreater(len(slots), 0, "Should find candidate slots")
        for s in slots:
            self.assertGreaterEqual(s["duration_min"], 45, "Slots must be at least 45 min")
            self.assertIn(s["line"], ["UP", "DN"])

    def test_fast_bundling_engine(self):
        # Create mock predictions
        mock_preds = pd.DataFrame([
            {"task_id": "TSK-01", "asset_id": "TRK-01", "department": "ENGINEERING_TRACK", "section_from": "GZB", "section_to": "DER", "line": "UP", "km_start": 30.0, "km_end": 31.5, "predicted_duration_min": 180, "composite_criticality_score": 85.0, "power_block_required": True, "disconnection_required": False, "machine_required": "TAMPING"},
            {"task_id": "TSK-02", "asset_id": "OHE-01", "department": "TRACTION_DISTRIBUTION_OHE", "section_from": "GZB", "section_to": "DER", "line": "UP", "km_start": 30.5, "km_end": 31.0, "predicted_duration_min": 120, "composite_criticality_score": 80.0, "power_block_required": True, "disconnection_required": False, "machine_required": "TOWER_WAGON"},
            {"task_id": "TSK-03", "asset_id": "SIG-01", "department": "SIGNAL_AND_TELECOM", "section_from": "GZB", "section_to": "DER", "line": "UP", "km_start": 30.2, "km_end": 30.3, "predicted_duration_min": 45, "composite_criticality_score": 75.0, "power_block_required": False, "disconnection_required": True, "machine_required": "NONE"},
        ])

        t0 = time.time()
        bundles = cluster_maintenance_tasks(mock_preds)
        t_elapsed = time.time() - t0

        self.assertLess(t_elapsed, 0.5, "Bundling must run in sub-second time")
        self.assertGreater(len(bundles), 0)

        # Primary bundle should bundle all 3 departments
        top_b = bundles[0]
        self.assertTrue(top_b["is_multi_department"])
        self.assertEqual(len(top_b["departments"]), 3)
        self.assertGreater(top_b["downtime_saved_min"], 0)
        self.assertEqual(top_b["bundled_duration_min"], 180)  # max duration
        self.assertEqual(top_b["unbundled_duration_min"], 345)  # sum of durations (180+120+45)

    def test_multi_horizon_planner(self):
        m = generate_monthly_strategic_plan()
        self.assertIn("weekly_allocations", m)
        self.assertEqual(len(m["weekly_allocations"]), 4)
        for w_key, projs in m["weekly_allocations"].items():
            self.assertGreater(len(projs), 0, f"{w_key} should have allocated projects")

        w = generate_weekly_tactical_plan()
        self.assertIn("schedule_matrix", w)
        self.assertEqual(len(w["schedule_matrix"]), 7)
        self.assertGreater(w["coordination_kpi"]["night_shift_percentage"], 0.0)
        self.assertGreater(w["coordination_kpi"]["gang_utilization_rate_pct"], 0.0)

    def test_disruption_simulator_speed(self):
        sim = DisruptionSimulator()
        res = sim.simulate_train_delay("12424", 30)
        self.assertIn("solver_time_seconds", res)
        self.assertLess(res["solver_time_seconds"], 2.0, "Disruption solver must resolve in under 2.0 seconds")
        self.assertIn("updated_schedule", res)

    def test_station_yard_topology(self):
        yard_path = os.path.join(ROOT_DIR, "data", "topology", "station_yards.json")
        self.assertTrue(os.path.exists(yard_path))
        with open(yard_path, "r") as f:
            yards = json.load(f)

        self.assertEqual(len(yards), 10, "Must have yard layout definitions for all 10 stations")
        station_codes = [y["station_code"] for y in yards]
        for st in ["NDLS", "GZB", "DER", "KRJ", "ALJN", "TDL", "FZD", "ETW", "PHD", "CNB"]:
            self.assertIn(st, station_codes)

        # Check major junctions have detailed point and signal lists
        for code in ["NDLS", "GZB", "TDL", "CNB"]:
            st_data = next(y for y in yards if y["station_code"] == code)
            self.assertGreater(len(st_data["points"]), 6)
            self.assertGreater(len(st_data["signals"]), 4)
            self.assertGreater(len(st_data["platforms"]), 2)

    def test_station_yard_api(self):
        client = TestClient(app)
        for st in ["NDLS", "GZB", "TDL", "CNB", "DER"]:
            res = client.get(f"/api/station/yard/{st}")
            self.assertEqual(res.status_code, 200, f"Station {st} yard API should return 200")
            data = res.json()
            self.assertEqual(data["station_code"], st)
            self.assertIn("points", data)
            self.assertIn("tracks", data)
            self.assertIn("signals", data)
            self.assertIn("ohe_masts", data)
            # Verify enriched point machine health metrics
            if data["points"]:
                self.assertIn("health_index", data["points"][0])
                self.assertIn("throw_time_sec", data["points"][0])

    def test_demand_safety_rule_enforcement(self):
        client = TestClient(app)
        # OHE demand must enforce power_block_required
        res_ohe = client.post("/api/demand/raise", json={
            "department": "TRACTION_DISTRIBUTION_OHE",
            "defect_category": "Contact Wire Wear",
            "section_from": "ALJN",
            "section_to": "TDL",
            "line": "DN",
            "km_start": 136.0,
            "km_end": 137.0,
            "machine_required": "TOWER_WAGON",
            "power_block_required": False,  # Should be auto-enforced to True
            "disconnection_required": False,
            "gang_crew": "TRD Gang",
            "duration_requested_min": 180,
            "priority": "CRITICAL"
        })
        self.assertEqual(res_ohe.status_code, 200)
        self.assertTrue(res_ohe.json()["demand"]["power_block_required"])

        # S&T demand must enforce disconnection_required
        res_sig = client.post("/api/demand/raise", json={
            "department": "SIGNAL_AND_TELECOM",
            "defect_category": "Point Machine Sluggish",
            "section_from": "ALJN",
            "section_to": "TDL",
            "line": "DN",
            "km_start": 135.0,
            "km_end": 136.0,
            "machine_required": "SIGNAL_GANG",
            "power_block_required": False,
            "disconnection_required": False,  # Should be auto-enforced to True
            "gang_crew": "Signal Gang",
            "duration_requested_min": 120,
            "priority": "CRITICAL"
        })
        self.assertEqual(res_sig.status_code, 200)
        self.assertTrue(res_sig.json()["demand"]["disconnection_required"])

    def test_demand_lifecycle_and_shadow_bundling(self):
        client = TestClient(app)
        client.post("/api/demand/clear")

        # 1. Raise Track Demand
        client.post("/api/demand/raise", json={
            "department": "ENGINEERING_TRACK",
            "defect_category": "Rail Flaw (USFD)",
            "section_from": "GZB",
            "section_to": "DER",
            "line": "UP",
            "km_start": 28.5,
            "km_end": 30.0,
            "machine_required": "CSM_TAMPING",
            "power_block_required": True,
            "disconnection_required": False,
            "gang_crew": "Track Gang B (GZB Depot)",
            "duration_requested_min": 210,
            "priority": "CRITICAL"
        })

        # 2. Raise OHE Demand
        client.post("/api/demand/raise", json={
            "department": "TRACTION_DISTRIBUTION_OHE",
            "defect_category": "Contact Wire Wear",
            "section_from": "GZB",
            "section_to": "DER",
            "line": "UP",
            "km_start": 29.0,
            "km_end": 30.0,
            "machine_required": "TOWER_WAGON",
            "power_block_required": True,
            "disconnection_required": False,
            "gang_crew": "TRD Linemen Gang B",
            "duration_requested_min": 180,
            "priority": "CRITICAL"
        })

        # 3. Raise Signal Demand
        client.post("/api/demand/raise", json={
            "department": "SIGNAL_AND_TELECOM",
            "defect_category": "Point Machine Sluggish",
            "section_from": "GZB",
            "section_to": "DER",
            "line": "UP",
            "km_start": 28.0,
            "km_end": 29.0,
            "machine_required": "SIGNAL_GANG",
            "power_block_required": False,
            "disconnection_required": True,
            "gang_crew": "Signal Gang B",
            "duration_requested_min": 120,
            "priority": "CRITICAL"
        })

        # 4. Check Pending Queue
        res_q = client.get("/api/demand/pending")
        self.assertEqual(res_q.status_code, 200)
        self.assertEqual(res_q.json()["total_pending"], 3)
        self.assertGreaterEqual(res_q.json()["total_unbundled_hours"], 8.0)

        # 5. Trigger CP-SAT Shadow Bundling
        res_b = client.post("/api/demand/bundle_and_sanction")
        self.assertEqual(res_b.status_code, 200)
        self.assertEqual(res_b.json()["status"], "SUCCESS")
        self.assertEqual(res_b.json()["sanctioned_count"], 3)

        # 6. Verify Pending Queue is Cleared
        res_after = client.get("/api/demand/pending")
        self.assertEqual(res_after.json()["total_pending"], 0)

        # 7. Verify Department Status Endpoints Show Approved
        for dept in ["ENGINEERING_TRACK", "TRACTION_DISTRIBUTION_OHE", "SIGNAL_AND_TELECOM"]:
            res_dept = client.get(f"/api/demand/status/{dept}")
            self.assertEqual(res_dept.status_code, 200)
            self.assertGreater(len(res_dept.json()["demands"]), 0)
            self.assertEqual(res_dept.json()["demands"][0]["status"], "APPROVED_SHADOW_BLOCK")

        # 8. The sanction must be real: each demand's ID must appear in the
        #    task list of the block it was assigned to, and the window must be
        #    resolved to an absolute simulated datetime for the lifecycle engine.
        blocks = {b["schedule_id"]: b for b in res_b.json()["updated_schedule"]["scheduled_blocks"]}
        for d in res_b.json()["sanctioned_demands"]:
            block = blocks.get(d["sanction_memo_id"])
            self.assertIsNotNone(block, f"{d['demand_id']} points at a non-existent block")
            self.assertIn(d["demand_id"], block["tasks"],
                          f"{d['demand_id']} was not actually scheduled into {block['schedule_id']}")
            self.assertIsNotNone(d["window_start_sim"])
            self.assertIsNotNone(d["window_end_sim"])
            self.assertIn(d["window_day_label"], ("TODAY", "TOMORROW"))

    def test_department_portal_pages(self):
        client = TestClient(app)
        for route in ["/tms", "/tdms", "/smms"]:
            res = client.get(route)
            self.assertEqual(res.status_code, 200, f"Route {route} should return 200 HTML")
            self.assertIn("text/html", res.headers.get("content-type", ""))

    def test_demand_history_and_clear(self):
        client = TestClient(app)
        res_h = client.get("/api/demand/history")
        self.assertEqual(res_h.status_code, 200)
        self.assertIn("demands", res_h.json())

        res_c = client.post("/api/demand/clear")
        self.assertEqual(res_c.status_code, 200)
        self.assertEqual(res_c.json()["status"], "SUCCESS")


if __name__ == "__main__":
    unittest.main()


