"""
SMMS (Signalling Maintenance & Management System) Synthetic Data Generator.
Generates authentic Indian Railways Point Machine, Track Circuit, Axle Counter,
and Electronic Interlocking records adhering to IRSEM standards.
"""

import random
import numpy as np
import pandas as pd
import sys
import os

# Ensure local imports work
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from src.generator.rdso_formulas import calculate_point_machine_health


def generate_smms_dataset(num_samples: int = 400, seed: int = 44) -> pd.DataFrame:
    np.random.seed(seed)
    random.seed(seed)

    stations = [
        ("NDLS", 0.0),
        ("GZB", 25.0),
        ("DER", 37.0),
        ("KRJ", 83.0),
        ("ALJN", 131.0),
        ("TDL", 209.0),
        ("FZD", 226.0),
        ("ETW", 301.0),
        ("PHD", 357.0),
        ("CNB", 440.0),
    ]

    records = []

    for i in range(num_samples):
        asset_id = f"SIG-{i+1:04d}"
        st_code, st_km = random.choice(stations)
        km_loc = round(st_km + random.uniform(-1.5, 1.5), 2)
        km_loc = max(0.0, min(440.0, km_loc))

        asset_type = np.random.choice(
            ["POINT_MACHINE", "TRACK_CIRCUIT", "AXLE_COUNTER", "EI_SYSTEM"],
            p=[0.45, 0.30, 0.15, 0.10]
        )
        line = random.choice(["UP", "DN", "YARD"])
        days_since_maint = random.randint(5, 365)

        # Default initialization
        throw_time = 0.0
        peak_current = 0.0
        insulation_res = 15.0
        stroke_cycles = 0
        tc_voltage = 0.0
        tc_ballast_res = 5.0
        relay_age = random.randint(1, 20)
        ei_errors = 0
        battery_health = round(random.uniform(70.0, 99.0), 1)
        last_failure_days = random.randint(10, 700)

        health_data = {"health_index": 85.0, "priority_tier": "LOW", "defect_reasons": []}
        risk_score = 0.0

        if asset_type == "POINT_MACHINE":
            stroke_cycles = random.randint(1000, 45000)
            wear_factor = stroke_cycles / 45000.0

            # Throw time (normal 4.0s - 5.0s, degraded 5.5s - 6.8s)
            throw_time = round(np.random.normal(4.3 + wear_factor * 1.8, 0.4), 2)
            throw_time = float(np.clip(throw_time, 3.5, 7.2))

            # Motor peak current (normal 1.8A - 2.2A, high friction 3.0A - 4.0A)
            peak_current = round(np.random.normal(1.9 + wear_factor * 1.5, 0.3), 2)
            peak_current = float(np.clip(peak_current, 1.2, 4.2))

            # Insulation resistance (normal > 10 Mohm, water ingress < 2 Mohm)
            insulation_res = round(np.random.normal(18.0 - wear_factor * 16.0, 3.0), 1)
            insulation_res = float(np.clip(insulation_res, 0.5, 50.0))

            health_data = calculate_point_machine_health(throw_time, peak_current, insulation_res)
            risk_score = 100.0 - health_data["health_index"]

        elif asset_type == "TRACK_CIRCUIT":
            # Operating voltage (normal 4.5V - 6.0V, drop < 2.5V indicates leakage)
            tc_voltage = round(random.uniform(1.8, 6.5), 2)
            # Ballast resistance (normal > 4.0 Ohm-km, rain leakage < 2.0 Ohm-km)
            tc_ballast_res = round(random.uniform(0.8, 8.0), 2)

            if tc_ballast_res < 2.0 or tc_voltage < 2.5:
                risk_score += 45.0
            if relay_age > 15:
                risk_score += 20.0

            risk_score += min(20.0, days_since_maint * 0.05)
            health_index = max(0.0, 100.0 - risk_score)
            priority_tier = "CRITICAL" if health_index < 35 else ("HIGH" if health_index < 55 else "LOW")
            health_data = {"health_index": health_index, "priority_tier": priority_tier, "defect_reasons": []}

        elif asset_type == "AXLE_COUNTER":
            error_count = random.randint(0, 12)
            if error_count > 6 or days_since_maint > 250:
                risk_score += 55.0
            else:
                risk_score += error_count * 4.0
            health_index = max(0.0, 100.0 - risk_score)
            priority_tier = "CRITICAL" if health_index < 35 else ("HIGH" if health_index < 55 else "LOW")
            health_data = {"health_index": health_index, "priority_tier": priority_tier, "defect_reasons": []}

        elif asset_type == "EI_SYSTEM":
            ei_errors = random.randint(0, 15)
            if ei_errors > 8:
                risk_score += 65.0
            elif ei_errors > 3:
                risk_score += 30.0
            health_index = max(0.0, 100.0 - risk_score)
            priority_tier = "CRITICAL" if health_index < 35 else ("HIGH" if health_index < 55 else "LOW")
            health_data = {"health_index": health_index, "priority_tier": priority_tier, "defect_reasons": []}

        failure_label = 1 if risk_score >= 45.0 else 0

        if failure_label == 1:
            rul_days = max(1, int(20 - (risk_score - 45.0) * 0.35))
        else:
            rul_days = min(365, int(365 - risk_score * 3.6))

        records.append({
            "asset_id": asset_id,
            "department": "SIGNAL_AND_TELECOM",
            "asset_type": asset_type,
            "station": st_code,
            "km_location": km_loc,
            "line": line,
            "point_throw_time_sec": throw_time,
            "motor_peak_current_amps": peak_current,
            "insulation_resistance_megohm": insulation_res,
            "total_stroke_cycles": stroke_cycles,
            "track_circuit_voltage": tc_voltage,
            "track_circuit_ballast_resistance": tc_ballast_res,
            "relay_age_years": relay_age,
            "ei_error_count_30d": ei_errors,
            "battery_health_percentage": battery_health,
            "last_failure_days_ago": last_failure_days,
            "health_index": health_data["health_index"],
            "priority_tier": health_data["priority_tier"],
            "disconnection_required": True if risk_score > 35.0 else False,
            "days_since_last_maintenance": days_since_maint,
            "ground_truth_failure": failure_label,
            "ground_truth_rul_days": rul_days
        })

    df = pd.DataFrame(records)
    return df


if __name__ == "__main__":
    os.makedirs("data/processed", exist_ok=True)
    df = generate_smms_dataset(400)
    out_path = "data/processed/smms_signal_defects.csv"
    df.to_csv(out_path, index=False)
    print(f"Generated {len(df)} SMMS Signal records.")
    print("Failure count breakdown:\n", df["ground_truth_failure"].value_counts())
