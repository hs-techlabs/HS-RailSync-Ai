"""
Corridor Map Service tests.

Covers the three things the map cannot be wrong about:

1. Geometry - a chainage must always resolve to the same, correct point, since
   every layer and every screen positions features through it.
2. Feature shape - every feature must carry the fields the renderer needs, or a
   marker silently fails to appear.
3. Consistency with the rest of the system - the map must not invent blocks the
   OCC does not know about, or drop safety flags.
"""

import copy
import json
import os
import sys
import unittest
from unittest import mock

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from fastapi.testclient import TestClient

from src.map_service import geometry, layers, trains


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------

class TestCorridorGeometry(unittest.TestCase):

    def test_station_chainage_resolves_to_that_station(self):
        """A station's own KM must return its surveyed coordinates exactly."""
        for st in geometry.stations():
            pos = geometry.position_at_km(st["km"])
            self.assertAlmostEqual(pos["lat"], st["lat"], places=5,
                                   msg=f"{st['code']} latitude drifted")
            self.assertAlmostEqual(pos["lng"], st["lng"], places=5,
                                   msg=f"{st['code']} longitude drifted")

    def test_midpoint_falls_between_its_bracketing_stations(self):
        by_code = {s["code"]: s for s in geometry.stations()}
        ndls, gzb = by_code["NDLS"], by_code["GZB"]
        mid = geometry.position_at_km((ndls["km"] + gzb["km"]) / 2.0)

        self.assertTrue(min(ndls["lat"], gzb["lat"]) < mid["lat"] < max(ndls["lat"], gzb["lat"]))
        self.assertTrue(min(ndls["lng"], gzb["lng"]) < mid["lng"] < max(ndls["lng"], gzb["lng"]))

    def test_out_of_range_chainage_clamps_rather_than_raising(self):
        """
        An asset row with a slightly out-of-range KM should still be findable on
        the map, not crash the layer that contains it.
        """
        first, last = geometry.stations()[0], geometry.stations()[-1]
        self.assertAlmostEqual(geometry.position_at_km(-50)["lat"], first["lat"], places=5)
        self.assertAlmostEqual(geometry.position_at_km(9999)["lat"], last["lat"], places=5)

    def test_yard_section_resolves_to_a_stub_span(self):
        """S&T assets store section_from == section_to; that is a yard, not a span."""
        rng = geometry.section_km_range("ETW", "ETW")
        self.assertIsNotNone(rng)
        self.assertLess(rng[0], rng[1], "a yard must still have a non-zero span")

    def test_path_includes_intermediate_vertices(self):
        """A span crossing stations must follow the alignment, not cut the corner."""
        path = geometry.path_between_km(120, 215)     # crosses ALJN (131) and TDL (209)
        self.assertGreaterEqual(len(path), 4)
        kms = [p["km"] for p in path]
        self.assertEqual(kms, sorted(kms), "path vertices must run in chainage order")

    def test_offset_moves_the_rails_apart_by_the_requested_distance(self):
        path = geometry.path_between_km(0, 25)
        dn = geometry.offset_path(path, geometry.DN_SIDE, 300.0)
        up = geometry.offset_path(path, geometry.UP_SIDE, 300.0)

        centre_to_dn = geometry.haversine_m(
            path[0]["lat"], path[0]["lng"], dn[0]["lat"], dn[0]["lng"])
        self.assertAlmostEqual(centre_to_dn, 300.0, delta=1.0)

        # The two rails sit on opposite sides, so they are twice as far apart.
        rail_gap = geometry.haversine_m(dn[0]["lat"], dn[0]["lng"], up[0]["lat"], up[0]["lng"])
        self.assertAlmostEqual(rail_gap, 600.0, delta=2.0)

    def test_geometry_document_is_complete_and_ordered(self):
        doc = geometry.corridor_geometry()
        self.assertEqual(len(doc["stations"]), 10)
        self.assertEqual(len(doc["sections"]), 9)
        self.assertEqual(doc["track_sides"], {"DN": 1.0, "UP": -1.0})

        kms = [s["km"] for s in doc["stations"]]
        self.assertEqual(kms, sorted(kms))
        for vertex in doc["centreline"]:
            self.assertIn("bearing", vertex)


# ---------------------------------------------------------------------------
# Layers
# ---------------------------------------------------------------------------

REQUIRED_FIELDS = ("id", "layer", "lat", "lng", "bearing", "line",
                   "km_start", "km_end", "severity", "title", "subtitle", "detail")


def staged_demands():
    """
    The demand file only holds whatever the running simulation happens to have
    reached, so a test that needs a requisition at a particular stage has to put
    one there. Real records are re-staged rather than invented, which keeps every
    field the layers read authentic.
    """
    records = copy.deepcopy(layers.sim_state.read_demands())
    if not records:
        raise unittest.SkipTest("no demand records to re-stage")

    wanted = ["PENDING_SANCTION", "APPROVED_SHADOW_BLOCK", "IN_PROGRESS"]
    for i, d in enumerate(records):
        d["status"] = wanted[i % len(wanted)]
    return records


class TestMapLayers(unittest.TestCase):

    def _assert_renderable(self, feature, layer_name):
        for field in REQUIRED_FIELDS:
            self.assertIn(field, feature, f"{layer_name} feature is missing '{field}'")
        self.assertIsInstance(feature["lat"], float)
        self.assertIsInstance(feature["lng"], float)
        self.assertIn(feature["severity"], ("CRITICAL", "HIGH", "MEDIUM", "LOW"))
        # Anywhere on the NDLS-CNB corridor, roughly.
        self.assertTrue(26.0 < feature["lat"] < 29.5, f"{layer_name}: latitude off corridor")
        self.assertTrue(77.0 < feature["lng"] < 81.0, f"{layer_name}: longitude off corridor")

    def test_every_layer_yields_renderable_features(self):
        # Asks for every builder by name rather than leaning on a preset: the
        # OCC preset is now deliberately narrow, so driving this off "ALL" would
        # quietly stop exercising the layers that preset no longer carries.
        every = sorted(layers.LAYER_BUILDERS)
        result = layers.build_layers("ALL", names=every)
        self.assertNotIn("errors", result, f"layer build reported errors: {result.get('errors')}")
        self.assertEqual(sorted(result["layers"]), every)

        for name, features in result["layers"].items():
            for feature in features:
                self._assert_renderable(feature, name)

    def test_layers_are_json_serialisable(self):
        """
        The backlog CSV is sparse, so rows carry NaN in most columns. NaN is not
        valid JSON and starlette refuses to encode it.
        """
        for dept in ("ENGINEERING_TRACK", "TRACTION_DISTRIBUTION_OHE",
                     "SIGNAL_AND_TELECOM", "ALL"):
            payload = layers.build_layers(dept)
            json.dumps(payload, allow_nan=False)

    def test_department_filter_never_leaks_another_department(self):
        for dept in ("ENGINEERING_TRACK", "TRACTION_DISTRIBUTION_OHE", "SIGNAL_AND_TELECOM"):
            result = layers.build_layers(dept)
            for name, features in result["layers"].items():
                for f in features:
                    if f.get("department"):
                        self.assertEqual(f["department"], dept,
                                         f"{name} leaked a {f['department']} feature into {dept}")

    def test_powercuts_are_a_strict_subset_of_blocks(self):
        """A power cut is a property of a sanctioned block, never a record of its own."""
        block_ids = {f["id"] for f in layers.blocks_layer("ALL")}
        for f in layers.powercuts_layer("ALL"):
            self.assertIn(f["id"], block_ids)
            self.assertTrue(f["detail"]["power_block_required"])

    def test_occ_preset_carries_no_ground_level_layer(self):
        """
        The OCC master desk sanctions blocks; it does not triage defects. Its map
        must therefore stay clear of the departments' ground-level intelligence -
        field reports awaiting a department's own review, routine dues, asset
        wear and track health - all of which live on the portal maps instead.
        """
        occ = layers.PORTAL_LAYER_PRESETS["ALL"]
        self.assertEqual(occ, ["demands", "blocks"])
        for ground in ("issues", "routines", "assets", "health"):
            self.assertNotIn(ground, occ)

        # ...and the portals must keep the layers the OCC gave up.
        portal_layers = set()
        for dept, names in layers.PORTAL_LAYER_PRESETS.items():
            if dept != "ALL":
                portal_layers.update(names)
        self.assertTrue({"issues", "routines", "assets", "health"} <= portal_layers)

    def test_a_demand_is_on_exactly_one_of_the_two_occ_layers(self):
        """
        The OCC map mirrors its two columns: INCOMING is `demands`, IN EXECUTION
        is `blocks`. They filter on disjoint status sets, so a requisition is
        plotted once and moves between layers as it is sanctioned - it is never
        drawn twice and never disappears mid-lifecycle.
        """
        staged = staged_demands()
        with mock.patch.object(layers.sim_state, "read_demands", return_value=staged):
            demands = layers.demands_layer("ALL")
            blocks = layers.blocks_layer("ALL")

        self.assertTrue(demands, "staging should have queued a requisition")
        self.assertTrue(blocks, "staging should have sanctioned a block")

        self.assertFalse({f["id"] for f in demands} & {f["id"] for f in blocks})
        for f in demands:
            self.assertEqual(f["detail"]["status"], "PENDING_SANCTION")
        for f in blocks:
            self.assertIn(f["detail"]["status"], layers.BLOCK_STATUSES)

    def test_demands_carry_what_the_occ_popup_shows(self):
        """The popup and its 'Show in queue' action read the feature, not a refetch."""
        staged = staged_demands()
        with mock.patch.object(layers.sim_state, "read_demands", return_value=staged):
            features = layers.demands_layer("ALL")
        self.assertTrue(features, "staging should have queued a requisition")

        for f in features:
            self._assert_renderable(f, "demands")
            self.assertTrue(len(f["path"]) > 1, f"demand {f['id']} has no span to stroke")
            d = f["detail"]
            for field in ("demand_id", "section", "duration_requested_min",
                          "priority", "machine_required", "gang_crew",
                          "department_label", "description"):
                self.assertIn(field, d, f"demand {f['id']} popup cannot show '{field}'")
            # 'Show in queue' finds the INCOMING card by this id exactly.
            self.assertEqual(f["id"], d["demand_id"])

    def test_issues_carry_what_the_block_request_form_needs(self):
        """
        The Inspect form prefills entirely from the feature payload, with no
        second fetch - so the whole worker request has to travel with it.
        """
        for f in layers.issues_layer("ALL"):
            d = f["detail"]
            for field in ("request_id", "section_from", "section_to", "line",
                          "km_start", "km_end", "duration_requested_min",
                          "priority", "machine_required", "gang_crew",
                          "description", "attachments"):
                self.assertIn(field, d, f"issue {f['id']} cannot prefill '{field}'")

    def test_health_covers_sections_and_breaks_down_by_system(self):
        features = layers.health_layer()
        self.assertTrue(features, "S&T health layer should not be empty")

        section_names = {s["section"] for s in geometry.sections()}
        for f in features:
            self.assertIn(f["detail"]["section"], section_names)
            self.assertTrue(f["detail"]["systems"], "a health span needs a system breakdown")
            self.assertGreater(len(f["path"]), 1, "health is drawn as a span, not a pin")
            for system in f["detail"]["systems"]:
                self.assertIn(system["grade"], ("CRITICAL", "HIGH", "MEDIUM", "LOW"))

    def test_routines_are_sorted_by_urgency(self):
        features = layers.routines_layer("ENGINEERING_TRACK")
        if len(features) > 1:
            due = [f["detail"]["due_in_days"] for f in features]
            self.assertEqual(due, sorted(due), "overdue inspections must surface first")

    def test_assets_only_surface_work_that_needs_attention(self):
        for f in layers.assets_layer("TRACTION_DISTRIBUTION_OHE"):
            self.assertIn(f["detail"]["priority_tier"], ("CRITICAL", "HIGH"))
            self.assertIn(f["detail"]["attention_window"], ("NOW", "NEAR_TERM", "PLANNED"))

    def test_unknown_layer_is_reported_not_raised(self):
        result = layers.build_layers("ALL", names=["issues", "does_not_exist"])
        self.assertIn("issues", result["layers"])
        self.assertIn("does_not_exist", result.get("errors", {}))


# ---------------------------------------------------------------------------
# Trains
# ---------------------------------------------------------------------------

class TestTrainPositions(unittest.TestCase):

    def test_trains_sit_on_the_corridor_and_carry_a_line(self):
        for t in trains.live_trains():
            self.assertIn(t["line"], ("UP", "DN"))
            self.assertTrue(0.0 <= t["km"] <= 440.0)
            self.assertTrue(26.0 < t["lat"] < 29.5)
            self.assertIn(t["state"], ("RUNNING", "HALTED"))

    def test_a_train_is_placed_between_its_own_stops(self):
        """Interpolation must never put a train outside the segment it is on."""
        schedule = trains._schedule()
        self.assertTrue(schedule, "timetable failed to load")

        _, stops = next(iter(schedule.values()))
        # Halfway between the first departure and the second arrival.
        mid = (stops[0]["dep"] + stops[1]["arr"]) / 2.0
        located = trains._locate(stops, mid)

        self.assertIsNotNone(located)
        km = located[0]
        self.assertTrue(min(stops[0]["km"], stops[1]["km"]) <= km <= max(stops[0]["km"], stops[1]["km"]))

    def test_a_train_outside_its_window_is_not_running(self):
        _, stops = next(iter(trains._schedule().values()))
        self.assertIsNone(trains._locate(stops, stops[0]["dep"] - 30))
        self.assertIsNone(trains._locate(stops, stops[-1]["arr"] + 30))


# ---------------------------------------------------------------------------
# HTTP surface
# ---------------------------------------------------------------------------

class TestMapAPI(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        from src.api.main import app
        cls.client = TestClient(app)

    def test_geometry_endpoint(self):
        res = self.client.get("/api/map/geometry")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(len(body["stations"]), 10)
        self.assertEqual(len(body["sections"]), 9)

    def test_layers_endpoint_serves_each_portal_preset(self):
        expected = {
            "ENGINEERING_TRACK": {"issues", "blocks", "routines"},
            "TRACTION_DISTRIBUTION_OHE": {"issues", "assets", "powercuts"},
            "SIGNAL_AND_TELECOM": {"issues", "health"},
        }
        for dept, names in expected.items():
            res = self.client.get(f"/api/map/layers?department={dept}")
            self.assertEqual(res.status_code, 200)
            self.assertEqual(set(res.json()["layers"].keys()), names)

    def test_layers_endpoint_honours_an_explicit_layer_list(self):
        res = self.client.get("/api/map/layers?department=ALL&layers_csv=issues,health")
        self.assertEqual(set(res.json()["layers"].keys()), {"issues", "health"})

    def test_trains_endpoint(self):
        res = self.client.get("/api/map/trains")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["total"], len(res.json()["trains"]))

    def test_presets_endpoint_lists_every_layer(self):
        body = self.client.get("/api/map/presets").json()
        for name in ("issues", "blocks", "powercuts", "routines", "assets", "health", "trains"):
            self.assertIn(name, body["available_layers"])


class TestBlockRequestOverrides(unittest.TestCase):
    """
    The map's Inspect -> Request Block form posts officer edits as optional
    overrides on the existing approve endpoint. Overrides must be honoured, and
    omitting them must behave exactly as the plain approve button always did.
    """

    @classmethod
    def setUpClass(cls):
        from src.api.main import app
        cls.client = TestClient(app)

    def _a_pending_report(self):
        res = self.client.get("/api/worker_requests/pending?department=ENGINEERING_TRACK")
        requests = res.json()["requests"]
        if not requests:
            self.skipTest("no pending field report available to approve")
        return requests[0]

    def test_overrides_are_applied_to_the_resulting_demand(self):
        report = self._a_pending_report()
        res = self.client.post(
            f"/api/worker_requests/{report['request_id']}/approve",
            json={
                "reason": "Inspected on corridor map.",
                "reviewed_by": "Test Officer",
                "duration_requested_min": 175,
                "priority": "CRITICAL",
                "machine_required": "BCM",
                "power_block_required": True,
            },
        )
        self.assertEqual(res.status_code, 200)
        demand = res.json()["demand"]

        self.assertEqual(demand["duration_requested_min"], 175)
        self.assertEqual(demand["priority"], "CRITICAL")
        self.assertEqual(demand["machine_required"], "BCM")
        self.assertTrue(demand["power_block_required"])
        # Location is never editable - it is what the field actually reported.
        self.assertEqual(demand["km_start"], report["km_start"])
        self.assertEqual(demand["section_from"], report["section_from"])

    def test_omitting_overrides_preserves_the_reported_values(self):
        report = self._a_pending_report()
        res = self.client.post(
            f"/api/worker_requests/{report['request_id']}/approve",
            json={"reason": "Plain approve.", "reviewed_by": "Test Officer"},
        )
        self.assertEqual(res.status_code, 200)
        demand = res.json()["demand"]

        self.assertEqual(demand["duration_requested_min"], report["duration_requested_min"])
        self.assertEqual(demand["priority"], report["priority"])
        self.assertEqual(demand["gang_crew"], report["gang_crew"])


if __name__ == "__main__":
    unittest.main()
