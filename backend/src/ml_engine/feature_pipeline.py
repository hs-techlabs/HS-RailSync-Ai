"""
Feature Engineering and Preprocessing Pipeline for Railway Asset Health.
Transforms multi-department maintenance logs (TMS, TDMS, SMMS) into
standardized numeric feature vectors for ML models.
"""

import pandas as pd
import numpy as np
import os
import joblib
from sklearn.preprocessing import StandardScaler


FEATURE_COLUMNS = [
    "rail_age_years",
    "cumulative_gmt",
    "tgi_composite",
    "rail_temp_delta",
    "rainfall_mm",
    "wire_wear_percentage",
    "atd_deviation_mm",
    "pantograph_sparks",
    "point_throw_time_sec",
    "motor_current_amps",
    "insulation_res_megohm",
    "stroke_cycles",
    "days_since_last_maint",
    "is_track_dept",
    "is_ohe_dept",
    "is_signal_dept",
    "is_high_speed_section",
    "has_active_tsr",
]


def _get_series(df: pd.DataFrame, col_name: str, default_val) -> pd.Series:
    """Safely retrieves a column as a pandas Series with default fallback."""
    if col_name in df.columns:
        return df[col_name].fillna(default_val)
    else:
        return pd.Series(default_val, index=df.index)


def extract_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Extracts a standardized set of 18 features from raw or unified maintenance records.
    Handles department-specific missing values gracefully with domain defaults.
    """
    features = pd.DataFrame(index=df.index)

    # 1. Track Features (defaults for non-track assets)
    features["rail_age_years"] = _get_series(df, "rail_age_years", 5.0).astype(float)
    features["cumulative_gmt"] = _get_series(df, "cumulative_gmt", 100.0).astype(float)
    features["tgi_composite"] = _get_series(df, "tgi_composite", 80.0).astype(float)

    # Rail thermal delta from destressing temp (default 40C)
    rail_temp = _get_series(df, "rail_temperature_c", 40.0).astype(float)
    features["rail_temp_delta"] = (rail_temp - 40.0).abs()

    features["rainfall_mm"] = _get_series(df, "rainfall_mm_7day", 0.0).astype(float)

    # 2. OHE / Electrical Features
    features["wire_wear_percentage"] = _get_series(df, "wire_wear_percentage", 20.0).astype(float)

    atd_pos = _get_series(df, "atd_position_mm", 500.0).astype(float)
    # Deviation from ideal midpoint 500 mm
    features["atd_deviation_mm"] = (atd_pos - 500.0).abs()

    features["pantograph_sparks"] = _get_series(df, "pantograph_spark_count_30d", 0.0).astype(float)

    # 3. Signal Features
    features["point_throw_time_sec"] = _get_series(df, "point_throw_time_sec", 4.2).astype(float)
    features["motor_current_amps"] = _get_series(df, "motor_peak_current_amps", 1.9).astype(float)
    features["insulation_res_megohm"] = _get_series(df, "insulation_resistance_megohm", 15.0).astype(float)
    features["stroke_cycles"] = _get_series(df, "total_stroke_cycles", 5000.0).astype(float)

    # 4. Common Operational Features
    features["days_since_last_maint"] = _get_series(df, "days_since_last_maintenance", 30.0).astype(float)

    # Department One-Hot Encodings
    dept_series = _get_series(df, "department", "ENGINEERING_TRACK").astype(str)
    features["is_track_dept"] = (dept_series == "ENGINEERING_TRACK").astype(int)
    features["is_ohe_dept"] = (dept_series == "TRACTION_DISTRIBUTION_OHE").astype(int)
    features["is_signal_dept"] = (dept_series == "SIGNAL_AND_TELECOM").astype(int)

    # Speed & TSR indicators
    max_speed = _get_series(df, "max_speed_kmph", 130.0).astype(float)
    features["is_high_speed_section"] = (max_speed >= 160.0).astype(int)

    has_tsr = _get_series(df, "speed_restriction_active", 0)
    features["has_active_tsr"] = has_tsr.astype(int)

    return features[FEATURE_COLUMNS]


def fit_and_save_scaler(features_df: pd.DataFrame, save_path: str):
    """Fits standard scaler and persists to disk."""
    scaler = StandardScaler()
    scaler.fit(features_df)
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    joblib.dump(scaler, save_path)
    return scaler


def load_scaler(save_path: str) -> StandardScaler:
    """Loads fitted standard scaler from disk."""
    if not os.path.exists(save_path):
        raise FileNotFoundError(f"Scaler not found at {save_path}")
    return joblib.load(save_path)
