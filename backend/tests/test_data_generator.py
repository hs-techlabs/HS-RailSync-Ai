"""
Unit tests for RDSO Engineering Formulas and Synthetic Railway Data Generators.
"""

import unittest
import os
import pandas as pd
import sys

# Ensure root directory is in python path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(ROOT_DIR)

from src.generator.rdso_formulas import (
    calculate_tgi,
    classify_tgi,
    calculate_rail_thermal_stress,
    calculate_wire_wear_percentage,
    classify_wire_wear,
    calculate_point_machine_health,
    calculate_composite_criticality
)
from src.generator.timetable_builder import build_corridor_timetable
from src.generator.generate_tms_data import generate_tms_dataset
from src.generator.generate_tdms_data import generate_tdms_dataset
from src.generator.generate_smms_data import generate_smms_dataset


class TestRDSOFormulas(unittest.TestCase):

    def test_tgi_formula(self):
        # Perfect geometry (all 100) -> TGI = 100
        tgi_perfect = calculate_tgi(100, 100, 100, 100)
        self.assertEqual(tgi_perfect, 100.0)
        self.assertEqual(classify_tgi(tgi_perfect), "GOOD")

        # Mixed geometry: UI=60, TI=70, GI=80, AL=50
        # (2*60 + 70 + 80 + 6*50)/10 = (120 + 70 + 80 + 300)/10 = 57.0
        tgi_mixed = calculate_tgi(60, 70, 80, 50)
        self.assertEqual(tgi_mixed, 57.0)
        self.assertEqual(classify_tgi(tgi_mixed), "AVERAGE")

        # Poor geometry
        tgi_poor = calculate_tgi(30, 30, 40, 20)
        self.assertEqual(classify_tgi(tgi_poor), "POOR")

    def test_wire_wear_formula(self):
        # Nominal wire (12.24mm) -> 0% wear
        wear_0 = calculate_wire_wear_percentage(12.24)
        self.assertAlmostEqual(wear_0, 0.0, places=1)
        self.assertEqual(classify_wire_wear(wear_0), "GOOD")

        # Condemning wire (8.25mm) -> 100% wear
        wear_100 = calculate_wire_wear_percentage(8.25)
        self.assertAlmostEqual(wear_100, 100.0, places=1)
        self.assertEqual(classify_wire_wear(wear_100), "CONDEMN_RENEW")

    def test_point_machine_health(self):
        # Perfect point machine: 4.2s throw, 1.9A current, 20 Mohm insulation
        healthy = calculate_point_machine_health(4.2, 1.9, 20.0)
        self.assertGreater(healthy["health_index"], 80.0)
        self.assertEqual(healthy["priority_tier"], "LOW")

        # Severe degraded point machine: 6.2s throw, 3.6A current, 0.8 Mohm insulation
        critical = calculate_point_machine_health(6.2, 3.6, 0.8)
        self.assertLess(critical["health_index"], 40.0)
        self.assertEqual(critical["priority_tier"], "CRITICAL")
        self.assertGreater(len(critical["defect_reasons"]), 0)


class TestDataGenerators(unittest.TestCase):

    def test_timetable_generation(self):
        df_tt = build_corridor_timetable()
        self.assertGreater(len(df_tt), 0)
        self.assertIn("train_number", df_tt.columns)
        self.assertIn("arrival_time", df_tt.columns)
        self.assertIn("direction", df_tt.columns)
        # Check both UP and DN trains exist
        self.assertIn("UP", df_tt["direction"].values)
        self.assertIn("DN", df_tt["direction"].values)

    def test_tms_generation(self):
        df_tms = generate_tms_dataset(100)
        self.assertEqual(len(df_tms), 100)
        self.assertFalse(df_tms.isnull().values.any())
        self.assertTrue((df_tms["tgi_composite"] >= 0).all())
        self.assertTrue((df_tms["tgi_composite"] <= 100).all())

    def test_tdms_generation(self):
        df_tdms = generate_tdms_dataset(100)
        self.assertEqual(len(df_tdms), 100)
        self.assertFalse(df_tdms.isnull().values.any())
        self.assertTrue((df_tdms["wire_wear_percentage"] >= 0).all())

    def test_smms_generation(self):
        df_smms = generate_smms_dataset(100)
        self.assertEqual(len(df_smms), 100)
        self.assertFalse(df_smms.isnull().values.any())


if __name__ == "__main__":
    unittest.main()
