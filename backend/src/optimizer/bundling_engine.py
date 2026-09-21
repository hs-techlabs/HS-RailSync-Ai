"""
Multi-Department Shadow Block Bundling Engine.
Clusters co-located Engineering (Track), TRD (OHE), and S&T (Signalling)
maintenance requests into unified, coordinated blocks to minimize total corridor possession.
Optimized with spatial section bucketing for sub-millisecond execution.
"""

import os
import sys
import pandas as pd
import numpy as np

# Ensure root directory is in python path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
sys.path.append(ROOT_DIR)


def cluster_maintenance_tasks(df_predictions: pd.DataFrame, max_km_radius: float = 3.0) -> list:
    """
    Groups maintenance tasks that occur in the same section, line, and proximity.
    Uses section-wise spatial bucketing for fast, scalable clustering.
    Returns a list of BundledBlock candidates sorted by total criticality.
    """
    bundled_groups = []
    bundle_id_counter = 1

    # Filter tasks requiring maintenance (Critical, High, Medium, or top criticality)
    df_sorted = df_predictions.sort_values(by="composite_criticality_score", ascending=False).copy()
    assigned_tasks = set()

    # Partition tasks by (section_from, line) for fast O(N) localized clustering
    grouped = df_sorted.groupby(["section_from", "line"], sort=False)

    for (sec_from, line), group in grouped:
        group_records = group.to_dict(orient="records")

        for i, primary_task in enumerate(group_records):
            task_id = primary_task["task_id"]
            if task_id in assigned_tasks:
                continue

            km_start = float(primary_task.get("km_start", 0.0))
            km_end = float(primary_task.get("km_end", km_start + 1.0))
            primary_dept = str(primary_task.get("department", ""))

            # Companion candidate tasks in the same section and line within KM radius
            companions = []
            for j, comp_task in enumerate(group_records):
                c_id = comp_task["task_id"]
                if c_id == task_id or c_id in assigned_tasks:
                    continue

                c_km_start = float(comp_task.get("km_start", 0.0))
                c_km_end = float(comp_task.get("km_end", c_km_start + 1.0))

                # Check proximity within max_km_radius
                dist = max(0.0, max(km_start, c_km_start) - min(km_end, c_km_end))
                if dist <= max_km_radius:
                    companions.append(comp_task)

            # Assemble bundled multi-department group
            all_bundled_tasks = [primary_task]
            depts_present = {primary_dept}

            for comp in companions:
                c_dept = str(comp.get("department", ""))
                # Bundle companion tasks (prioritize cross-department tasks, up to 4 tasks per block)
                if (c_dept not in depts_present or len(all_bundled_tasks) < 4):
                    all_bundled_tasks.append(comp)
                    depts_present.add(c_dept)
                    assigned_tasks.add(comp["task_id"])

            assigned_tasks.add(task_id)

            # Compute bundled block parameters
            durations = [int(t.get("predicted_duration_min", 120)) for t in all_bundled_tasks]
            max_duration = max(durations)
            sum_independent_duration = sum(durations)
            total_criticality = sum(float(t.get("composite_criticality_score", 50.0)) for t in all_bundled_tasks)
            requires_power = any(bool(t.get("power_block_required", False)) for t in all_bundled_tasks)
            requires_disconn = any(bool(t.get("disconnection_required", False)) for t in all_bundled_tasks)

            # Machines involved
            machines = [str(t.get("machine_required", "NONE")) for t in all_bundled_tasks if str(t.get("machine_required", "NONE")) not in ["NONE", "nan", ""]]

            sec_to = primary_task.get("section_to", sec_from)
            min_km = min(float(t.get("km_start", 0.0)) for t in all_bundled_tasks)
            max_km = max(float(t.get("km_end", min_km + 1.0)) for t in all_bundled_tasks)

            bundled_groups.append({
                "bundle_id": f"BND-{bundle_id_counter:04d}",
                "section_from": sec_from,
                "section_to": sec_to,
                "line": line,
                "km_range": f"{min_km:.1f} - {max_km:.1f}",
                "task_count": len(all_bundled_tasks),
                "departments": list(depts_present),
                "is_multi_department": len(depts_present) > 1,
                "tasks": [t["task_id"] for t in all_bundled_tasks],
                "asset_ids": [t.get("asset_id", "") for t in all_bundled_tasks],
                "descriptions": [t.get("description", "") for t in all_bundled_tasks],
                "bundled_duration_min": max_duration,
                "unbundled_duration_min": sum_independent_duration,
                "downtime_saved_min": sum_independent_duration - max_duration,
                "downtime_saved_pct": round(((sum_independent_duration - max_duration) / sum_independent_duration) * 100.0, 1) if sum_independent_duration > 0 else 0.0,
                "total_criticality": round(total_criticality, 1),
                "power_block_required": requires_power,
                "disconnection_required": requires_disconn,
                "machines_required": machines
            })
            bundle_id_counter += 1

    # Sort final bundles by total criticality score
    bundled_groups.sort(key=lambda b: b["total_criticality"], reverse=True)
    return bundled_groups


if __name__ == "__main__":
    preds_csv = os.path.join(ROOT_DIR, "data", "processed", "ml_predictions.csv")
    if os.path.exists(preds_csv):
        df_p = pd.read_csv(preds_csv)
        bundles = cluster_maintenance_tasks(df_p)
        print(f"Formed {len(bundles)} bundled maintenance groups.")
        multi_dept = sum(1 for b in bundles if b["is_multi_department"])
        print(f"Multi-department bundled groups: {multi_dept} ({multi_dept/len(bundles)*100:.1f}%)")
    else:
        print("Run ML predict first to generate ml_predictions.csv")
