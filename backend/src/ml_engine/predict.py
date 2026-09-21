"""
ML Inference Pipeline.
Loads saved models and generates predictions (Failure Probability, Priority Tier,
RUL in days, and Required Block Duration) for the unified maintenance backlog.
"""

import os
import sys
import pandas as pd
import numpy as np
import joblib

# Ensure root directory is in python path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
sys.path.append(ROOT_DIR)

from src.ml_engine.feature_pipeline import extract_features, load_scaler
from src.generator.rdso_formulas import calculate_composite_criticality


def run_inference(input_csv: str = None, output_csv: str = None) -> pd.DataFrame:
    if input_csv is None:
        input_csv = os.path.join(ROOT_DIR, "data", "processed", "unified_maintenance_backlog.csv")
    if output_csv is None:
        output_csv = os.path.join(ROOT_DIR, "data", "processed", "ml_predictions.csv")

    print(f"Loading backlog from {input_csv}...")
    df = pd.read_csv(input_csv)

    models_dir = os.path.join(ROOT_DIR, "src", "ml_engine", "saved_models")
    scaler = load_scaler(os.path.join(models_dir, "scaler.joblib"))
    clf = joblib.load(os.path.join(models_dir, "risk_classifier.joblib"))
    reg_rul = joblib.load(os.path.join(models_dir, "rul_regressor.joblib"))
    reg_dur = joblib.load(os.path.join(models_dir, "duration_estimator.joblib"))

    X_raw = extract_features(df)
    X_scaled = scaler.transform(X_raw)

    # 1. Failure probability & Priority tier
    probs = clf.predict_proba(X_scaled)[:, 1]
    df["failure_probability"] = np.round(probs, 4)
    df["failure_percentage"] = np.round(probs * 100.0, 1)

    def assign_tier(p_pct):
        if p_pct >= 75.0:
            return "CRITICAL"
        elif p_pct >= 50.0:
            return "HIGH"
        elif p_pct >= 25.0:
            return "MEDIUM"
        else:
            return "LOW"

    df["priority_tier"] = df["failure_percentage"].apply(assign_tier)

    # 2. Predicted RUL
    pred_rul = reg_rul.predict(X_scaled)
    df["predicted_rul_days"] = np.clip(np.round(pred_rul, 0), 1, 365).astype(int)

    # 3. Predicted Block Duration (scaled realistically per department domain norms)
    pred_dur = reg_dur.predict(X_scaled)
    df["predicted_duration_min"] = np.clip(np.round(pred_dur, 0), 30, 300).astype(int)

    # 4. Composite Criticality Score for OR-Tools Optimizer
    criticalities = []
    for _, row in df.iterrows():
        tsr_val = row.get("speed_restriction_active", False)
        is_tsr_active = bool(pd.notna(tsr_val) and (tsr_val is True or str(tsr_val).lower() in ["true", "1", "1.0"]))

        score = calculate_composite_criticality(
            failure_prob=row["failure_probability"],
            rul_days=row["predicted_rul_days"],
            route_class=row.get("route_class", "A"),
            has_active_tsr=is_tsr_active
        )
        criticalities.append(round(score, 1))

    df["composite_criticality_score"] = criticalities

    # Sort highest criticality first
    df = df.sort_values(by="composite_criticality_score", ascending=False).reset_index(drop=True)

    df.to_csv(output_csv, index=False)
    print(f"Inference complete on {len(df)} assets. Output saved to {output_csv}")
    print("\nPriority Tier Distribution:\n", df["priority_tier"].value_counts())
    return df


if __name__ == "__main__":
    run_inference()
