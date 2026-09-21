"""
RDSO and Indian Railways Engineering Standards Formulas.
Sources:
- IRPWM (Indian Railways Permanent Way Manual)
- ACTM (AC Traction Manual)
- IRSEM (Indian Railways Signal Engineering Manual)
- RDSO Lucknow Guidelines for Track Geometry Index (TGI)
"""

import numpy as np
import pandas as pd


def calculate_tgi(ui: float, ti: float, gi: float, al: float) -> float:
    """
    Calculate Track Geometry Index (TGI) using RDSO Standard Formula.
    TGI = (2 * UI + TI + GI + 6 * AL) / 10

    Args:
        ui: Unevenness Index (vertical profile variation, 0-100)
        ti: Twist Index (cross-level variation over 3.6m base, 0-100)
        gi: Gauge Index (deviation from 1676 mm standard, 0-100)
        al: Alignment Index (lateral straightness, 0-100)

    Returns:
        Composite TGI score (0 to 100).
    """
    tgi = (2.0 * ui + 1.0 * ti + 1.0 * gi + 6.0 * al) / 10.0
    return float(np.clip(tgi, 0.0, 100.0))


def classify_tgi(tgi: float) -> str:
    """
    Classify TGI score according to RDSO standards.
    - TGI >= 80: GOOD (No immediate action)
    - 50 <= TGI < 80: AVERAGE (Maintenance required within 30 days)
    - TGI < 50: POOR (Urgent block required / TSR imposed)
    """
    if tgi >= 80.0:
        return "GOOD"
    elif tgi >= 50.0:
        return "AVERAGE"
    else:
        return "POOR"


def calculate_rail_thermal_stress(rail_temp_c: float, destressing_temp_c: float = 40.0) -> dict:
    """
    Calculate rail thermal stress and buckling risk according to IRPWM Chapter 7.

    Args:
        rail_temp_c: Current rail temperature in Celsius.
        destressing_temp_c: Rail de-stressing temperature Td (typically 38-42 C).

    Returns:
        dict with thermal_delta, buckling_risk, and maintenance_permitted flag.
    """
    delta_t = rail_temp_c - destressing_temp_c
    abs_delta = abs(delta_t)

    if delta_t > 25.0:
        risk = "EXTREME_BUCKLING_RISK"
        permitted = False
    elif delta_t > 20.0:
        risk = "HIGH_BUCKLING_RISK"
        permitted = False
    elif delta_t > 15.0:
        risk = "MODERATE_HEAT_EXPANSION"
        permitted = True
    elif delta_t < -20.0:
        risk = "HIGH_FRACTURE_RISK_COLD"
        permitted = True
    else:
        risk = "SAFE_RANGE"
        permitted = True

    return {
        "thermal_delta_c": float(delta_t),
        "abs_delta_c": float(abs_delta),
        "buckling_risk": risk,
        "maintenance_permitted": permitted
    }


def calculate_wire_wear_percentage(
    measured_dia_mm: float,
    nominal_dia_mm: float = 12.24,
    condemning_dia_mm: float = 8.25
) -> float:
    """
    Calculate OHE Contact Wire Wear Percentage according to ACTM standards.
    Wear consumed = (Nominal - Measured) / (Nominal - Condemning) * 100

    Args:
        measured_dia_mm: Current contact wire diameter in mm.
        nominal_dia_mm: Nominal diameter when new (12.24 mm standard).
        condemning_dia_mm: Minimum safe condemning limit (8.25 mm standard).

    Returns:
        Wear percentage (0.0 to 100.0+%).
    """
    wear_range = nominal_dia_mm - condemning_dia_mm
    actual_wear = nominal_dia_mm - measured_dia_mm
    wear_pct = (actual_wear / wear_range) * 100.0
    return float(np.clip(wear_pct, 0.0, 100.0))


def classify_wire_wear(wear_pct: float) -> str:
    """
    Classify OHE wire condition based on wear percentage.
    - >= 85%: CONDEMN_RENEW (Mandatory immediate renewal)
    - >= 65%: CRITICAL (Renew within 30 days)
    - >= 40%: WORN (Monitor closely)
    - < 40%: GOOD (Normal service)
    """
    if wear_pct >= 85.0:
        return "CONDEMN_RENEW"
    elif wear_pct >= 65.0:
        return "CRITICAL"
    elif wear_pct >= 40.0:
        return "WORN"
    else:
        return "GOOD"


def calculate_point_machine_health(
    throw_time_sec: float,
    motor_peak_current_amps: float,
    insulation_resistance_megohm: float
) -> dict:
    """
    Calculate Point Machine Health Index according to IRSEM and field diagnostics.

    Standard Normal Parameters:
    - Throw Time: 4.0s - 5.0s (Normal), > 5.8s (Sluggish/Critical)
    - Peak Current: 1.8A - 2.2A (Normal), > 3.2A (High friction/Ballast jamming)
    - Insulation Resistance: >= 10.0 M-Ohm (Good), < 1.0 M-Ohm (Condemning)

    Returns:
        dict with health_index (0-100), priority tier, and defect reasons.
    """
    # Normalized penalty scores (0 = perfect, 1 = worst)
    throw_penalty = np.clip((throw_time_sec - 4.0) / 2.0, 0.0, 1.0)
    current_penalty = np.clip((motor_peak_current_amps - 1.8) / 1.7, 0.0, 1.0)
    insulation_penalty = np.clip((10.0 - min(insulation_resistance_megohm, 10.0)) / 10.0, 0.0, 1.0)

    # Weighted Health Index (100 = Brand New, 0 = Total Failure)
    health_index = 100.0 - (30.0 * throw_penalty + 40.0 * current_penalty + 30.0 * insulation_penalty)
    health_index = float(np.clip(health_index, 0.0, 100.0))

    if health_index < 35.0:
        tier = "CRITICAL"
    elif health_index < 55.0:
        tier = "HIGH"
    elif health_index < 75.0:
        tier = "MEDIUM"
    else:
        tier = "LOW"

    reasons = []
    if throw_time_sec > 5.5:
        reasons.append(f"Sluggish throw time ({throw_time_sec:.1f}s > 5.5s threshold)")
    if motor_peak_current_amps > 3.0:
        reasons.append(f"Motor current spike ({motor_peak_current_amps:.2f}A > 3.0A threshold)")
    if insulation_resistance_megohm < 2.0:
        reasons.append(f"Cable insulation low ({insulation_resistance_megohm:.1f} M-Ohm < 2.0)")

    return {
        "health_index": round(health_index, 2),
        "priority_tier": tier,
        "defect_reasons": reasons
    }


def calculate_composite_criticality(
    failure_prob: float,
    rul_days: float,
    route_class: str = "A",
    compounding_factor: float = 1.0,
    has_active_tsr: bool = False
) -> float:
    """
    Composite asset criticality score for prioritization in Google OR-Tools.
    Produces a 0.0 to 100.0 scale.
    """
    # Route weights
    route_weights = {"A": 1.0, "B": 0.85, "C": 0.70, "D": 0.50}
    rw = route_weights.get(str(route_class).upper(), 0.75)

    # RUL urgency factor (0 if RUL is 365 days, 1 if RUL <= 7 days)
    rul_urgency = np.clip((365.0 - float(rul_days)) / 365.0, 0.0, 1.0)

    # Robust boolean check for TSR active (handling NaN, strings, ints)
    is_tsr = False
    if pd.notna(has_active_tsr):
        is_tsr = bool(has_active_tsr is True or str(has_active_tsr).lower() in ["true", "1", "1.0"])

    # TSR economic penalty weight
    tsr_penalty = 15.0 if is_tsr else 0.0

    score = (
        (35.0 * float(failure_prob)) +
        (25.0 * rul_urgency) +
        (20.0 * rw) +
        (10.0 * (float(compounding_factor) - 1.0) * 2.0) +
        tsr_penalty
    )

    return float(np.clip(score, 0.0, 100.0))
