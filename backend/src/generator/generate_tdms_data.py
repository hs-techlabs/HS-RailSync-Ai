"""
TDMS (Traction Distribution Management System) Synthetic Data Generator.
Generates authentic Indian Railways OHE (Overhead Equipment) records
strictly adhering to ACTM (AC Traction Manual) standards.
"""

import random
import numpy as np
import pandas as pd
import sys
import os

# Ensure local imports work
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from src.generator.rdso_formulas import calculate_wire_wear_percentage, classify_wire_wear


def generate_tdms_dataset(num_samples: int = 500, seed: int = 43) -> pd.DataFrame:
    np.random.seed(seed)
    random.seed(seed)

    stations = [
        ("NDLS", "GZB", 0.0, 25.0),
        ("GZB", "DER", 25.0, 37.0),
        ("DER", "KRJ", 37.0, 83.0),
        ("KRJ", "ALJN", 83.0, 131.0),
        ("ALJN", "TDL", 131.0, 209.0),
        ("TDL", "FZD", 209.0, 226.0),
        ("FZD", "ETW", 226.0, 301.0),
        ("ETW", "PHD", 301.0, 357.0),
        ("PHD", "CNB", 357.0, 440.0),
    ]

    records = []

    for i in range(num_samples):
        asset_id = f"OHE-{i+1:04d}"
        sec = random.choice(stations)
        sec_from, sec_to, sec_min_km, sec_max_km = sec

        km_start = round(random.uniform(sec_min_km, sec_max_km - 1.0), 2)
        km_end = round(km_start + random.uniform(0.5, 1.5), 2)
        line = random.choice(["UP", "DN"])

        km_int = int(km_start)
        mast_start = f"{km_int}/{random.randint(1, 15)}"
        mast_end = f"{km_int}/{random.randint(16, 32)}"

        days_since_maint = random.randint(10, 365)
        wear_bias = min(1.0, days_since_maint / 300.0)

        # Contact Wire Diameter (Nominal = 12.24 mm, Condemning = 8.25 mm)
        # Sample with some normal variance and wear degradation
        measured_dia = round(np.random.normal(12.0 - wear_bias * 3.5, 0.8), 2)
        measured_dia = float(np.clip(measured_dia, 8.0, 12.24))

        wear_pct = round(calculate_wire_wear_percentage(measured_dia), 1)
        wire_status = classify_wire_wear(wear_pct)

        # Catenary Wire Condition
        if wear_pct > 75:
            catenary_cond = np.random.choice(["GOOD", "WORN", "CRITICAL"], p=[0.2, 0.5, 0.3])
        else:
            catenary_cond = np.random.choice(["GOOD", "WORN"], p=[0.85, 0.15])

        # Auto Tensioning Device (ATD) Counterweight Position
        # Standard travel range 200mm to 800mm, near 150mm or 850mm means near limit
        ambient_temp = round(random.uniform(15.0, 45.0), 1)
        temp_effect = (ambient_temp - 25.0) * 8.0  # Sag expansion with heat
        base_atd = random.uniform(400.0, 600.0)
        atd_pos = round(base_atd + temp_effect + random.gauss(0, 30), 1)
        atd_pos = float(np.clip(atd_pos, 100.0, 950.0))

        if atd_pos < 180.0 or atd_pos > 850.0:
            atd_status = "AT_LIMIT"
        elif atd_pos < 250.0 or atd_pos > 780.0:
            atd_status = "NEAR_LIMIT"
        else:
            atd_status = "NORMAL"

        # Wire Height at support (standard 5500 mm - 5600 mm, min 5060 mm)
        wire_height = int(np.random.normal(5550, 60))
        stagger_mm = int(random.gauss(0, 80))  # Standard stagger +/- 200 mm

        # Insulator condition & Pollution
        if random.random() < 0.15:
            insulator_cond = np.random.choice(["POLLUTED", "FLASHOVER_RISK"], p=[0.65, 0.35])
        else:
            insulator_cond = "CLEAN"

        # Pantograph spark events (last 30 days)
        if wire_status in ["CRITICAL", "CONDEMN_RENEW"] or insulator_cond == "FLASHOVER_RISK":
            spark_count = random.randint(5, 35)
        else:
            spark_count = random.randint(0, 4)

        # Mast structural health
        mast_foundation = np.random.choice(["STABLE", "SETTLEMENT", "TILTING"], p=[0.90, 0.07, 0.03])

        # Maintenance requirement flags
        power_block_req = True  # OHE always requires 25kV de-energization for physical touch
        tower_wagon_req = (wire_status in ["CRITICAL", "CONDEMN_RENEW"]) or (atd_status == "AT_LIMIT") or (catenary_cond == "CRITICAL")

        # Ground Truth Failure computation
        risk_score = 0.0
        if wire_status == "CONDEMN_RENEW":
            risk_score += 50.0
        elif wire_status == "CRITICAL":
            risk_score += 30.0
        elif wire_status == "WORN":
            risk_score += 15.0

        if atd_status == "AT_LIMIT":
            risk_score += 30.0
        elif atd_status == "NEAR_LIMIT":
            risk_score += 15.0

        if insulator_cond == "FLASHOVER_RISK":
            risk_score += 25.0
        elif insulator_cond == "POLLUTED":
            risk_score += 10.0

        if spark_count > 15:
            risk_score += 20.0

        if mast_foundation == "TILTING":
            risk_score += 25.0

        risk_score += min(15.0, days_since_maint * 0.04)

        failure_label = 1 if risk_score >= 50.0 else 0

        if failure_label == 1:
            rul_days = max(1, int(25 - (risk_score - 50.0) * 0.4))
        else:
            rul_days = min(365, int(365 - risk_score * 3.8))

        records.append({
            "asset_id": asset_id,
            "department": "TRACTION_DISTRIBUTION_OHE",
            "section_from": sec_from,
            "section_to": sec_to,
            "km_start": km_start,
            "km_end": km_end,
            "mast_start": mast_start,
            "mast_end": mast_end,
            "line": line,
            "contact_wire_diameter_mm": measured_dia,
            "wire_wear_percentage": wear_pct,
            "wire_status": wire_status,
            "catenary_wire_condition": catenary_cond,
            "atd_position_mm": atd_pos,
            "atd_status": atd_status,
            "ambient_temperature_c": ambient_temp,
            "wire_height_at_support_mm": wire_height,
            "stagger_mm": stagger_mm,
            "insulator_condition": insulator_cond,
            "pantograph_spark_count_30d": spark_count,
            "mast_foundation_status": mast_foundation,
            "power_block_required": power_block_req,
            "tower_wagon_required": tower_wagon_req,
            "days_since_last_maintenance": days_since_maint,
            "ground_truth_failure": failure_label,
            "ground_truth_rul_days": rul_days
        })

    df = pd.DataFrame(records)
    return df


if __name__ == "__main__":
    os.makedirs("data/processed", exist_ok=True)
    df = generate_tdms_dataset(500)
    out_path = "data/processed/tdms_ohe_defects.csv"
    df.to_csv(out_path, index=False)
    print(f"Generated {len(df)} TDMS OHE records.")
    print("Failure count breakdown:\n", df["ground_truth_failure"].value_counts())
