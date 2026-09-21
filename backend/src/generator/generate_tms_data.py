"""
TMS (Track Management System) Synthetic Data Generator.
Generates authentic Indian Railways track assets, geometry records,
and defect logs strictly adhering to IRPWM (Permanent Way Manual) and RDSO standards.
"""

import random
import numpy as np
import pandas as pd
import sys
import os

# Ensure local imports work
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from src.generator.rdso_formulas import calculate_tgi, classify_tgi, calculate_rail_thermal_stress


def generate_tms_dataset(num_samples: int = 800, seed: int = 42) -> pd.DataFrame:
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
        asset_id = f"TRK-{i+1:04d}"
        sec = random.choice(stations)
        sec_from, sec_to, sec_min_km, sec_max_km = sec

        km_start = round(random.uniform(sec_min_km, sec_max_km - 1.0), 2)
        km_end = round(km_start + random.uniform(0.5, 2.0), 2)
        line = random.choice(["UP", "DN"])

        rail_type = np.random.choice(["60kg 90UTS", "52kg 72UTS"], p=[0.85, 0.15])
        rail_age_years = random.randint(1, 25)
        cumulative_gmt = round(rail_age_years * random.uniform(15.0, 35.0), 1)

        # Track Geometry Index components (UI, TI, GI, AL)
        # As age and GMT increase, geometry degrades
        degradation_base = min(1.0, cumulative_gmt / 600.0)
        ui = round(np.random.normal(85 - degradation_base * 40, 10), 1)
        ti = round(np.random.normal(88 - degradation_base * 38, 10), 1)
        gi = round(np.random.normal(90 - degradation_base * 35, 8), 1)
        al = round(np.random.normal(86 - degradation_base * 42, 10), 1)

        ui = float(np.clip(ui, 20.0, 100.0))
        ti = float(np.clip(ti, 20.0, 100.0))
        gi = float(np.clip(gi, 20.0, 100.0))
        al = float(np.clip(al, 20.0, 100.0))

        tgi = calculate_tgi(ui, ti, gi, al)
        tgi_category = classify_tgi(tgi)

        # USFD (Ultrasonic Flaw Detection)
        if cumulative_gmt > 450 or rail_age_years > 18 or tgi < 45:
            usfd_status = np.random.choice(["CLEAR", "OBS", "IMR"], p=[0.30, 0.45, 0.25])
            usfd_defect_count = random.randint(1, 5) if usfd_status != "CLEAR" else 0
        else:
            usfd_status = np.random.choice(["CLEAR", "OBS"], p=[0.88, 0.12])
            usfd_defect_count = 1 if usfd_status == "OBS" else 0

        # Environmental & Rail Thermal Stress
        ambient_temp = round(random.uniform(18.0, 44.0), 1)
        # Rail temp is typically 12-18 C higher than ambient in direct sun
        rail_temp = round(ambient_temp + random.uniform(10.0, 18.0), 1)
        destressing_temp = 40.0
        thermal_data = calculate_rail_thermal_stress(rail_temp, destressing_temp)

        # Rainfall & Ballast condition
        rainfall_7d = round(random.uniform(0.0, 180.0), 1)
        if rainfall_7d > 100.0:
            ballast_condition = np.random.choice(["GOOD", "FOULED", "SATURATED"], p=[0.15, 0.35, 0.50])
        elif cumulative_gmt > 400.0:
            ballast_condition = np.random.choice(["GOOD", "FOULED"], p=[0.40, 0.60])
        else:
            ballast_condition = "GOOD"

        max_speed = 160 if sec_min_km >= 131.0 and sec_max_km <= 357.0 else 130
        route_class = "A"

        # Machine requirement
        if tgi < 55.0 or usfd_status == "IMR":
            machine_req = np.random.choice(["CSM", "BCM", "TAMPING"], p=[0.35, 0.25, 0.40])
        elif tgi < 75.0:
            machine_req = np.random.choice(["TAMPING", "MANUAL"], p=[0.70, 0.30])
        else:
            machine_req = "NONE"

        days_since_maint = random.randint(5, 360)

        # Active TSR (Temporary Speed Restriction)
        has_tsr = (tgi < 45.0) or (usfd_status == "IMR") or (ballast_condition == "SATURATED")
        tsr_speed = random.choice([30, 45, 60, 75]) if has_tsr else 0

        # Failure ground truth computation (Physics/RDSO Grounded)
        risk_score = 0.0
        if usfd_status == "IMR":
            risk_score += 45.0
        elif usfd_status == "OBS":
            risk_score += 15.0

        if tgi < 50.0:
            risk_score += 35.0
        elif tgi < 65.0:
            risk_score += 18.0

        if cumulative_gmt > 525.0:  # Codal renewal threshold
            risk_score += 20.0

        if ballast_condition == "SATURATED":
            risk_score += 15.0

        if thermal_data["buckling_risk"] == "EXTREME_BUCKLING_RISK":
            risk_score += 25.0

        risk_score += min(20.0, days_since_maint * 0.05)

        failure_label = 1 if risk_score >= 50.0 else 0

        # Estimated RUL in days
        if failure_label == 1:
            rul_days = max(1, int(30 - (risk_score - 50.0) * 0.5))
        else:
            rul_days = min(365, int(365 - risk_score * 3.5))

        records.append({
            "asset_id": asset_id,
            "department": "ENGINEERING_TRACK",
            "section_from": sec_from,
            "section_to": sec_to,
            "km_start": km_start,
            "km_end": km_end,
            "line": line,
            "rail_type": rail_type,
            "rail_age_years": rail_age_years,
            "cumulative_gmt": cumulative_gmt,
            "tgi_unevenness": ui,
            "tgi_twist": ti,
            "tgi_gauge": gi,
            "tgi_alignment": al,
            "tgi_composite": tgi,
            "tgi_category": tgi_category,
            "usfd_status": usfd_status,
            "usfd_defect_count": usfd_defect_count,
            "rail_temperature_c": rail_temp,
            "ambient_temperature_c": ambient_temp,
            "destressing_temp_c": destressing_temp,
            "thermal_buckling_risk": thermal_data["buckling_risk"],
            "maintenance_permitted_temp": thermal_data["maintenance_permitted"],
            "rainfall_mm_7day": rainfall_7d,
            "ballast_condition": ballast_condition,
            "max_speed_kmph": max_speed,
            "route_class": route_class,
            "machine_required": machine_req,
            "days_since_last_maintenance": days_since_maint,
            "speed_restriction_active": has_tsr,
            "tsr_speed_kmph": tsr_speed,
            "ground_truth_failure": failure_label,
            "ground_truth_rul_days": rul_days
        })

    df = pd.DataFrame(records)
    return df


if __name__ == "__main__":
    os.makedirs("data/processed", exist_ok=True)
    df = generate_tms_dataset(800)
    out_path = "data/processed/tms_track_defects.csv"
    df.to_csv(out_path, index=False)
    print(f"Generated {len(df)} TMS track records.")
    print("Failure count breakdown:\n", df["ground_truth_failure"].value_counts())
