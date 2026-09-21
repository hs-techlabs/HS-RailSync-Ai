"""
Master Data Generation Script.
Generates all authentic Indian Railways synthetic datasets:
1. NDLS-CNB Train Timetable (COA)
2. TMS Track Defects & Geometry (Civil / Engineering)
3. TDMS OHE Wire Wear & Tensioning (Electrical / TRD)
4. SMMS Point Machine & Interlocking (S&T / Signalling)
5. Unified Cross-Department Maintenance Backlog with Complete Feature Columns
"""

import os
import sys
import pandas as pd

# Ensure root directory is in python path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
sys.path.append(ROOT_DIR)

from src.generator.timetable_builder import build_corridor_timetable
from src.generator.generate_tms_data import generate_tms_dataset
from src.generator.generate_tdms_data import generate_tdms_dataset
from src.generator.generate_smms_data import generate_smms_dataset


def generate_all_datasets():
    print("=" * 70)
    print("INDIAN RAILWAYS AUTOMATIC BLOCK PLANNING: DATASET SYNTHESIS")
    print("=" * 70)

    # Ensure output directories
    raw_dir = os.path.join(ROOT_DIR, "data", "raw")
    proc_dir = os.path.join(ROOT_DIR, "data", "processed")
    os.makedirs(raw_dir, exist_ok=True)
    os.makedirs(proc_dir, exist_ok=True)

    # 1. Timetable (COA)
    print("\n[1/5] Building Real NDLS-CNB Timetable (COA Layer)...")
    df_timetable = build_corridor_timetable()
    tt_path = os.path.join(raw_dir, "ndls_cnb_real_timetable.csv")
    df_timetable.to_csv(tt_path, index=False)
    print(f"  -> Generated {len(df_timetable)} station-stop entries for {df_timetable['train_number'].nunique()} trains.")
    print(f"  -> Saved: {tt_path}")

    # 2. TMS (Track/Civil)
    print("\n[2/5] Synthesizing TMS Track Geometry & Defect Records (Engineering)...")
    df_tms = generate_tms_dataset(num_samples=850, seed=42)
    tms_path = os.path.join(proc_dir, "tms_track_defects.csv")
    df_tms.to_csv(tms_path, index=False)
    print(f"  -> Generated {len(df_tms)} track assets. At-risk: {df_tms['ground_truth_failure'].sum()}")
    print(f"  -> Saved: {tms_path}")

    # 3. TDMS (OHE/Electrical)
    print("\n[3/5] Synthesizing TDMS Catenary & Contact Wire Records (TRD/Electrical)...")
    df_tdms = generate_tdms_dataset(num_samples=550, seed=43)
    tdms_path = os.path.join(proc_dir, "tdms_ohe_defects.csv")
    df_tdms.to_csv(tdms_path, index=False)
    print(f"  -> Generated {len(df_tdms)} OHE assets. At-risk: {df_tdms['ground_truth_failure'].sum()}")
    print(f"  -> Saved: {tdms_path}")

    # 4. SMMS (Signalling & Telecom)
    print("\n[4/5] Synthesizing SMMS Point Machines & Track Circuits (S&T)...")
    df_smms = generate_smms_dataset(num_samples=450, seed=44)
    smms_path = os.path.join(proc_dir, "smms_signal_defects.csv")
    df_smms.to_csv(smms_path, index=False)
    print(f"  -> Generated {len(df_smms)} Signal assets. At-risk: {df_smms['ground_truth_failure'].sum()}")
    print(f"  -> Saved: {smms_path}")

    # 5. Build Unified Maintenance Backlog with Complete Feature Data
    print("\n[5/5] Compiling Unified Cross-Department Maintenance Backlog...")

    # Assign task IDs and standardized fields
    df_tms["task_id"] = "TSK-" + df_tms["asset_id"]
    # In 25kV AC electrified territory (IRPWM & ACTM), heavy track machines (BCM, CSM, TAMPING)
    # and major renewals require 25kV OHE power block isolation for safety.
    df_tms["power_block_required"] = df_tms["machine_required"].isin(["BCM", "CSM", "TAMPING"]) | (df_tms["ground_truth_failure"] == 1)
    df_tms["disconnection_required"] = False
    df_tms["description"] = df_tms.apply(lambda r: f"Track maintenance ({r['tgi_category']} TGI {r['tgi_composite']:.1f}, USFD: {r['usfd_status']})", axis=1)

    df_tdms["task_id"] = "TSK-" + df_tdms["asset_id"]
    df_tdms["machine_required"] = df_tdms["tower_wagon_required"].apply(lambda tw: "TOWER_WAGON" if tw else "NONE")
    df_tdms["disconnection_required"] = False
    df_tdms["description"] = df_tdms.apply(lambda r: f"OHE maintenance (Wire wear {r['wire_wear_percentage']:.1f}%, ATD: {r['atd_status']})", axis=1)

    df_smms["task_id"] = "TSK-" + df_smms["asset_id"]
    df_smms["section_from"] = df_smms["station"]
    df_smms["section_to"] = df_smms["station"]
    df_smms["km_start"] = df_smms["km_location"]
    df_smms["km_end"] = (df_smms["km_location"] + 0.1).round(2)
    df_smms["machine_required"] = "NONE"
    df_smms["power_block_required"] = False
    df_smms["description"] = df_smms.apply(lambda r: f"Signal maintenance ({r['asset_type']} at {r['station']}, Tier: {r['priority_tier']})", axis=1)

    df_unified = pd.concat([df_tms, df_tdms, df_smms], ignore_index=True)
    backlog_path = os.path.join(proc_dir, "unified_maintenance_backlog.csv")
    df_unified.to_csv(backlog_path, index=False)
    print(f"  -> Successfully unified {len(df_unified)} maintenance requisitions across all 3 departments.")
    print(f"  -> Saved: {backlog_path}")

    print("\n" + "=" * 70)
    print("PHASE 1 DATA GENERATION COMPLETE: ALL DATASETS READY")
    print("=" * 70)


if __name__ == "__main__":
    generate_all_datasets()
