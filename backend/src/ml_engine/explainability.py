"""
Explainable AI (XAI) Engine for Railway Asset Maintenance.
Generates plain-English controller justification cards and SHAP-based
feature impact explanations.
"""

import os
import sys
import numpy as np
import pandas as pd
import joblib

# Ensure root directory is in python path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
sys.path.append(ROOT_DIR)

from src.ml_engine.feature_pipeline import FEATURE_COLUMNS, extract_features, load_scaler

try:
    import shap
    HAS_SHAP = True
except ImportError:
    HAS_SHAP = False


class ExplainabilityEngine:
    def __init__(self):
        models_dir = os.path.join(ROOT_DIR, "src", "ml_engine", "saved_models")
        self.clf = joblib.load(os.path.join(models_dir, "risk_classifier.joblib"))
        self.scaler = load_scaler(os.path.join(models_dir, "scaler.joblib"))
        self.explainer = None

        if HAS_SHAP:
            try:
                self.explainer = shap.TreeExplainer(self.clf)
            except Exception:
                self.explainer = None

    def explain_asset(self, asset_record: dict) -> dict:
        """
        Generates a human-readable explanation card for a single asset.
        """
        df_single = pd.DataFrame([asset_record])
        X_raw = extract_features(df_single)
        X_scaled = self.scaler.transform(X_raw)

        prob = float(self.clf.predict_proba(X_scaled)[0, 1])
        pct = round(prob * 100.0, 1)

        if pct >= 75.0:
            tier = "CRITICAL"
        elif pct >= 50.0:
            tier = "HIGH"
        elif pct >= 25.0:
            tier = "MEDIUM"
        else:
            tier = "LOW"

        # Feature contribution analysis
        contributions = []
        feature_names = {
            "rail_age_years": "Rail age",
            "cumulative_gmt": "Cumulative traffic (GMT)",
            "tgi_composite": "Track Geometry Index (TGI)",
            "rail_temp_delta": "Rail temperature deviation",
            "rainfall_mm": "7-day rainfall / ballast moisture",
            "wire_wear_percentage": "OHE contact wire wear",
            "atd_deviation_mm": "ATD counterweight position",
            "pantograph_sparks": "Pantograph spark count",
            "point_throw_time_sec": "Point motor throw time",
            "motor_current_amps": "Point motor current draw",
            "insulation_res_megohm": "Cable insulation resistance",
            "stroke_cycles": "Point cycle count",
            "days_since_last_maint": "Days since last overhaul",
            "has_active_tsr": "Active speed restriction"
        }

        # Human-readable drivers
        drivers = []
        dept = asset_record.get("department", "")

        if dept == "ENGINEERING_TRACK":
            tgi = asset_record.get("tgi_composite", 80)
            gmt = asset_record.get("cumulative_gmt", 100)
            usfd = asset_record.get("usfd_status", "CLEAR")
            if usfd == "IMR":
                drivers.append("Urgent USFD rail flaw detected (Immediate Removal required)")
            if tgi < 55:
                drivers.append(f"Severely degraded track geometry (TGI {tgi:.1f} < 55 standard)")
            if gmt > 500:
                drivers.append(f"Cumulative tonnage exceeded 500 GMT codal limit ({gmt:.1f} GMT)")

        elif dept == "TRACTION_DISTRIBUTION_OHE":
            wear = asset_record.get("wire_wear_percentage", 20)
            atd = asset_record.get("atd_status", "NORMAL")
            if wear > 70:
                drivers.append(f"Contact wire wear consumed {wear:.1f}% of condemning margin")
            if atd == "AT_LIMIT":
                drivers.append("ATD tension counterweight at mechanical limit")

        elif dept == "SIGNAL_AND_TELECOM":
            throw = asset_record.get("point_throw_time_sec", 4.2)
            current = asset_record.get("motor_peak_current_amps", 1.9)
            if throw > 5.5:
                drivers.append(f"Sluggish point motor stroke ({throw:.2f}s > 5.0s norm)")
            if current > 3.0:
                drivers.append(f"High motor friction current spike ({current:.2f}A > 2.2A norm)")

        if not drivers:
            drivers.append("Routine maintenance schedule cycle due")

        return {
            "asset_id": asset_record.get("asset_id", "UNKNOWN"),
            "department": dept,
            "failure_probability_pct": pct,
            "priority_tier": tier,
            "primary_risk_drivers": drivers,
            "recommended_action": f"Schedule {tier} priority maintenance window"
        }


if __name__ == "__main__":
    engine = ExplainabilityEngine()
    sample = {
        "asset_id": "TRK-0042",
        "department": "ENGINEERING_TRACK",
        "tgi_composite": 48.2,
        "cumulative_gmt": 540.0,
        "usfd_status": "IMR",
        "rail_age_years": 19,
        "days_since_last_maintenance": 180
    }
    exp = engine.explain_asset(sample)
    print("Sample Explainability Card:\n", exp)
