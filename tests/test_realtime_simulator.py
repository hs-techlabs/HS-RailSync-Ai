"""
Realtime Simulator Tests.

Covers the virtual clock, the field-report generator, the officer review
workflow (approve / reject), sanctioned-block lifecycle progression, random
withdrawal policy, and the notification event feed.
"""

import unittest
import os
import sys
from datetime import datetime, timedelta

# The background generator must stay asleep so it cannot append reports or
# advance lifecycles underneath an assertion.
os.environ["RAILWAY_SIM_AUTOSTART"] = "0"

from fastapi.testclient import TestClient

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(ROOT_DIR)

from src.simulator import virtual_clock, sim_state, block_lifecycle, fault_generator
from src.optimizer.slot_finder import find_available_corridor_slots
from src.api.main import app


class TestVirtualClock(unittest.TestCase):

    def test_clock_is_accelerated_and_monotonic(self):
        first = virtual_clock.sim_now()
        second = virtual_clock.sim_now()
        self.assertGreaterEqual(second, first)
        self.assertEqual(virtual_clock.multiplier(), 80.0)

    def test_parse_hhmm_handles_hours_past_midnight(self):
        # The scheduler computes end times as start + duration without wrapping,
        # so "25:30" is a legitimate value it can emit.
        self.assertEqual(virtual_clock.parse_hhmm("00:00"), 0)
        self.assertEqual(virtual_clock.parse_hhmm("09:15"), 555)
        self.assertEqual(virtual_clock.parse_hhmm("25:30"), 1530)

    def test_next_occurrence_rolls_to_tomorrow(self):
        after = datetime(2026, 1, 10, 14, 0)
        # Still ahead today
        self.assertEqual(virtual_clock.next_occurrence("18:30", after),
                         datetime(2026, 1, 10, 18, 30))
        # Already passed -> tomorrow
        self.assertEqual(virtual_clock.next_occurrence("09:00", after),
                         datetime(2026, 1, 11, 9, 0))

    def test_resolve_window_crossing_midnight(self):
        after = datetime(2026, 1, 10, 20, 0)
        start, end = virtual_clock.resolve_window("23:00", "01:30", after)
        self.assertEqual(start, datetime(2026, 1, 10, 23, 0))
        self.assertEqual(end, datetime(2026, 1, 11, 1, 30))
        self.assertGreater(end, start)


class TestFaultGenerator(unittest.TestCase):

    def test_pool_excludes_unschedulable_locations(self):
        """
        Every generated report must be able to reach a real sanctioned window.
        Assets on YARD lines, at ALJN-TDL (no 45-min gap all day) or at the CNB
        terminal can never be scheduled, so they must never be sampled.
        """
        df = fault_generator._load_dataset()
        self.assertGreater(len(df), 0)

        combos = {(s["section_from"], s["line"]) for s in find_available_corridor_slots()}
        for _, row in df.iterrows():
            self.assertIn((str(row["section_from"]), str(row["line"]).upper()), combos)

        self.assertEqual((df["line"] == "YARD").sum(), 0)
        self.assertEqual((df["section_from"] == "ALJN").sum(), 0)
        self.assertEqual((df["section_from"] == "CNB").sum(), 0)

    def test_cold_start_emits_one_report_per_department(self):
        sim_state.write_worker_requests([])
        sim_state.write_demands([])

        created = fault_generator.tick_reports()
        self.assertEqual(len(created), 3, "Every department is due on a cold start")
        self.assertEqual(
            {r["department"] for r in created},
            {"ENGINEERING_TRACK", "TRACTION_DISTRIBUTION_OHE", "SIGNAL_AND_TELECOM"}
        )

    def test_generator_self_throttles_per_department(self):
        sim_state.write_worker_requests([])
        sim_state.write_demands([])

        fault_generator.tick_reports()
        # Immediately after emitting, no department has waited its 25-40 sim-min
        # gap, so a second tick must produce nothing.
        again = fault_generator.tick_reports()
        self.assertEqual(len(again), 0)

    def test_generated_report_shape_and_attachments(self):
        sim_state.write_worker_requests([])
        sim_state.write_demands([])
        created = fault_generator.tick_reports()

        for r in created:
            self.assertTrue(r["request_id"].startswith("WREQ-"))
            self.assertEqual(r["status"], "PENDING_REVIEW")
            self.assertIn(r["priority"], ("CRITICAL", "HIGH", "MEDIUM", "LOW"))
            self.assertIn(r["line"], ("UP", "DN"))
            self.assertGreaterEqual(r["duration_requested_min"], 30)

            # 1-2 photos plus exactly one PDF, and the files must really exist
            pdfs = [a for a in r["attachments"] if a["type"] == "pdf"]
            images = [a for a in r["attachments"] if a["type"] == "image"]
            self.assertEqual(len(pdfs), 1)
            self.assertIn(len(images), (1, 2))
            for att in r["attachments"]:
                disk_path = os.path.join(ROOT_DIR, "data", att["url"].lstrip("/").replace("/", os.sep))
                self.assertTrue(os.path.exists(disk_path), f"missing attachment {att['url']}")

    def test_description_tier_is_resynced(self):
        """
        The dataset's baked-in description text carries a tier from generation
        time that the ML pass later overwrote (260 of 450 signal rows disagree).
        A review card must never contradict its own severity badge.
        """
        df = fault_generator._load_dataset()
        row = df[df["description"].str.contains("Tier:", na=False)].iloc[0]
        request = fault_generator.build_worker_request(row, row["department"])
        self.assertIn(f"Tier: {request['priority']}", request["description"])


class TestReviewWorkflow(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)
        self.client.post("/api/simulator/reset")
        fault_generator.tick_reports()

    def _first_pending(self):
        return self.client.get("/api/worker_requests/pending?department=ALL").json()["requests"][0]

    def test_clock_endpoint(self):
        data = self.client.get("/api/clock/now").json()
        self.assertIn("sim_time", data)
        self.assertIn("real_time", data)
        self.assertEqual(data["multiplier"], 80.0)

    def test_pending_filters_by_department(self):
        res = self.client.get("/api/worker_requests/pending?department=ENGINEERING_TRACK").json()
        self.assertEqual(res["total"], 1)
        self.assertEqual(res["requests"][0]["department"], "ENGINEERING_TRACK")

    def test_approve_creates_matching_occ_demand(self):
        request = self._first_pending()
        before = self.client.get("/api/demand/pending").json()["total_pending"]

        res = self.client.post(f"/api/worker_requests/{request['request_id']}/approve")
        self.assertEqual(res.status_code, 200)
        demand = res.json()["demand"]

        # The approved report must produce the same record shape the manual form
        # produced, since the whole bundling pipeline downstream depends on it.
        for field in ("demand_id", "department", "section_from", "section_to", "line",
                      "km_start", "km_end", "machine_required", "power_block_required",
                      "disconnection_required", "duration_requested_min", "priority", "status"):
            self.assertIn(field, demand)
        self.assertEqual(demand["status"], "PENDING_SANCTION")
        self.assertEqual(demand["asset_id"], request["asset_id"])
        self.assertEqual(self.client.get("/api/demand/pending").json()["total_pending"], before + 1)

        # ...and it leaves the review queue for the history list
        self.assertNotIn(request["request_id"],
                         [r["request_id"] for r in
                          self.client.get("/api/worker_requests/pending?department=ALL").json()["requests"]])
        history = self.client.get("/api/worker_requests/history?department=ALL").json()
        self.assertIn(request["request_id"], [r["request_id"] for r in history["requests"]])

    def test_reject_never_reaches_the_occ(self):
        request = self._first_pending()
        before = self.client.get("/api/demand/pending").json()["total_pending"]

        res = self.client.post(f"/api/worker_requests/{request['request_id']}/reject",
                               json={"reason": "Insufficient evidence"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["request"]["status"], "REJECTED")
        self.assertEqual(res.json()["request"]["review_note"], "Insufficient evidence")
        self.assertEqual(self.client.get("/api/demand/pending").json()["total_pending"], before)

    def test_double_review_is_rejected(self):
        request = self._first_pending()
        self.client.post(f"/api/worker_requests/{request['request_id']}/approve")
        again = self.client.post(f"/api/worker_requests/{request['request_id']}/approve")
        self.assertEqual(again.status_code, 409)

    def test_unknown_request_returns_404(self):
        self.assertEqual(self.client.post("/api/worker_requests/WREQ-NOPE/approve").status_code, 404)
        self.assertEqual(self.client.post("/api/worker_requests/WREQ-NOPE/reject").status_code, 404)

    def test_ohe_approval_enforces_power_block(self):
        """Safety precedence must survive the new approval path (CONTEXT.md 6.6)."""
        pending = self.client.get(
            "/api/worker_requests/pending?department=TRACTION_DISTRIBUTION_OHE").json()["requests"]
        res = self.client.post(f"/api/worker_requests/{pending[0]['request_id']}/approve")
        self.assertTrue(res.json()["demand"]["power_block_required"])

    def test_signal_approval_enforces_disconnection(self):
        pending = self.client.get(
            "/api/worker_requests/pending?department=SIGNAL_AND_TELECOM").json()["requests"]
        res = self.client.post(f"/api/worker_requests/{pending[0]['request_id']}/approve")
        self.assertTrue(res.json()["demand"]["disconnection_required"])


class TestBlockLifecycle(unittest.TestCase):
    """Drives the lifecycle with an injected clock rather than waiting in real time."""

    def setUp(self):
        self.client = TestClient(app)
        self.client.post("/api/simulator/reset")
        self._real_sim_now = virtual_clock.sim_now

    def tearDown(self):
        virtual_clock.sim_now = self._real_sim_now
        block_lifecycle.sim_now = self._real_sim_now
        fault_generator.sim_now = self._real_sim_now

    def _set_clock(self, when):
        virtual_clock.sim_now = lambda: when
        block_lifecycle.sim_now = lambda: when
        fault_generator.sim_now = lambda: when

    def _seed_sanctioned_demand(self, start, end, status="APPROVED_SHADOW_BLOCK"):
        sim_state.write_demands([{
            "demand_id": "DMD-TMS-999",
            "department": "ENGINEERING_TRACK",
            "department_label": "Civil / Track (TMS)",
            "defect_category": "Rail Flaw (USFD Immediate)",
            "section_from": "GZB", "section_to": "DER", "line": "UP",
            "km_start": 30.0, "km_end": 31.0,
            "priority": "CRITICAL", "status": status,
            "sanctioned_window": "09:00 - 12:00 IST",
            "sanction_memo_id": "SCHED-001",
            "window_start_sim": start.isoformat(),
            "window_end_sim": end.isoformat(),
            "window_day_label": "TODAY"
        }])

    def test_block_starts_then_completes_on_its_own_time(self):
        now = datetime(2026, 1, 10, 8, 0)
        start, end = datetime(2026, 1, 10, 9, 0), datetime(2026, 1, 10, 12, 0)
        self._seed_sanctioned_demand(start, end)

        # Before the window: untouched
        self._set_clock(now)
        block_lifecycle.tick()
        self.assertEqual(sim_state.read_demands()[0]["status"], "APPROVED_SHADOW_BLOCK")

        # Inside the window: under execution
        self._set_clock(datetime(2026, 1, 10, 10, 0))
        block_lifecycle.tick()
        self.assertEqual(sim_state.read_demands()[0]["status"], "IN_PROGRESS")

        # Past the window: completed
        self._set_clock(datetime(2026, 1, 10, 13, 0))
        block_lifecycle.tick()
        self.assertEqual(sim_state.read_demands()[0]["status"], "COMPLETED")

        kinds = [e["kind"] for e in sim_state.read_events()]
        self.assertIn("BLOCK_STARTED", kinds)
        self.assertIn("BLOCK_COMPLETED", kinds)

    def test_progress_is_reported_mid_window(self):
        start, end = datetime(2026, 1, 10, 9, 0), datetime(2026, 1, 10, 11, 0)
        self._seed_sanctioned_demand(start, end)
        self._set_clock(datetime(2026, 1, 10, 10, 0))
        block_lifecycle.tick()

        state = block_lifecycle.live_state(sim_state.read_demands()[0])
        self.assertEqual(state["status"], "IN_PROGRESS")
        self.assertAlmostEqual(state["progress_pct"], 50.0, delta=1.0)

    def test_lone_block_is_never_withdrawn(self):
        """A demo where the only sanctioned block gets cancelled shows nothing."""
        start, end = datetime(2026, 1, 10, 9, 0), datetime(2026, 1, 10, 12, 0)
        self._seed_sanctioned_demand(start, end)
        self._set_clock(datetime(2026, 1, 10, 6, 0))

        for _ in range(60):
            block_lifecycle.tick()
        self.assertEqual(sim_state.read_demands()[0]["status"], "APPROVED_SHADOW_BLOCK")

    def test_withdrawal_only_hits_blocks_that_have_not_started(self):
        start, end = datetime(2026, 1, 10, 9, 0), datetime(2026, 1, 10, 12, 0)
        demands = []
        for i in range(4):
            demands.append({
                "demand_id": f"DMD-TMS-{900 + i}",
                "department": "ENGINEERING_TRACK",
                "defect_category": "Track Geometry Deviation (TGI)",
                "section_from": "GZB", "section_to": "DER", "line": "UP",
                "priority": "HIGH", "status": "APPROVED_SHADOW_BLOCK",
                "sanctioned_window": "09:00 - 12:00 IST",
                "window_start_sim": start.isoformat(),
                "window_end_sim": end.isoformat(),
                "window_day_label": "TODAY"
            })
        sim_state.write_demands(demands)
        self._set_clock(datetime(2026, 1, 10, 6, 0))

        for _ in range(40):
            block_lifecycle.tick()

        cancelled = [d for d in sim_state.read_demands() if d["status"] == "CANCELLED"]
        self.assertGreaterEqual(len(cancelled), 1, "some withdrawal should occur over many ticks")
        for d in cancelled:
            self.assertTrue(d.get("cancellation_reason"), "a withdrawal must state its reason")
            # Never withdrawn after it was already under way
            self.assertNotEqual(d["status"], "IN_PROGRESS")

        # The rate limit must hold: one withdrawal per 90 sim-minutes at a frozen
        # clock means exactly one across the whole burst.
        self.assertEqual(len(cancelled), 1)


class TestEventFeed(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)
        self.client.post("/api/simulator/reset")

    def test_feed_is_sequenced_and_filterable(self):
        fault_generator.tick_reports()

        feed = self.client.get("/api/events/feed?department=ALL").json()
        self.assertGreaterEqual(len(feed["events"]), 3)
        seqs = [e["seq"] for e in feed["events"]]
        self.assertEqual(seqs, sorted(seqs), "events must be monotonically sequenced")

        # after_seq acts as a high-water mark so a page never re-toasts
        latest = feed["latest_seq"]
        self.assertEqual(self.client.get(f"/api/events/feed?after_seq={latest}").json()["events"], [])

        dept_feed = self.client.get("/api/events/feed?department=ENGINEERING_TRACK").json()
        for e in dept_feed["events"]:
            self.assertIn(e["department"], ("ENGINEERING_TRACK", "ALL"))

    def test_live_board_reports_execution_state(self):
        fault_generator.tick_reports()
        for r in self.client.get("/api/worker_requests/pending?department=ALL").json()["requests"]:
            self.client.post(f"/api/worker_requests/{r['request_id']}/approve")

        board = self.client.get("/api/live/board").json()
        self.assertIn("blocks", board)
        self.assertIn("demands", board)
        for b in board["blocks"]:
            self.assertIn(b["exec_status"], ("SCHEDULED", "IN_PROGRESS", "COMPLETED"))
            self.assertGreaterEqual(b["progress_pct"], 0.0)
            self.assertLessEqual(b["progress_pct"], 100.0)


class TestAttachmentServing(unittest.TestCase):

    def test_attachments_are_web_servable(self):
        client = TestClient(app)
        for dept_dir in ("track", "ohe", "signal"):
            for filename in ("site_photo_1.png", "site_photo_2.png", "inspection_report.pdf"):
                res = client.get(f"/attachments/{dept_dir}/{filename}")
                self.assertEqual(res.status_code, 200, f"{dept_dir}/{filename} must be served")


if __name__ == "__main__":
    unittest.main()
