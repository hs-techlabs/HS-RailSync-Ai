"""
Corridor Slot Finder.
Analyzes the 24-hour train timetable across all sections of the NDLS-CNB corridor
to find available train-free headway windows on UP and DN lines.
"""

import os
import sys
import pandas as pd
import numpy as np

# Ensure root directory is in python path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
sys.path.append(ROOT_DIR)


def find_available_corridor_slots(
    timetable_csv: str = None,
    min_block_duration_min: int = 45,
    night_window_bonus: bool = True
) -> list:
    """
    Scans the timetable station-by-station and computes available maintenance slots.
    Ensures that usable duration (after safety buffer) is at least min_block_duration_min.
    """
    if timetable_csv is None:
        timetable_csv = os.path.join(ROOT_DIR, "data", "raw", "ndls_cnb_real_timetable.csv")

    df_tt = pd.read_csv(timetable_csv)

    stations = ["NDLS", "GZB", "DER", "KRJ", "ALJN", "TDL", "FZD", "ETW", "PHD", "CNB"]
    sections = []
    for i in range(len(stations) - 1):
        sections.append((stations[i], stations[i + 1]))

    candidate_slots = []
    slot_id_counter = 1

    for s_from, s_to in sections:
        for line in ["UP", "DN"]:
            # Filter trains occupying this section on this line
            trains_in_sec = df_tt[(df_tt["direction"] == line) & (df_tt["station"].isin([s_from, s_to]))].copy()

            # Group by train to get entry and exit times in section
            train_intervals = []
            for train_no, grp in trains_in_sec.groupby("train_number"):
                arr_times = grp["arrival_min_of_day"].values
                dep_times = grp["departure_min_of_day"].values
                t_type = grp["train_type"].iloc[0]
                p_class = grp["priority_class"].iloc[0]
                p_weight = grp["delay_penalty_weight"].iloc[0]

                t_start = min(dep_times.min(), arr_times.min())
                t_end = max(dep_times.max(), arr_times.max())
                if t_end < t_start:  # wraps around midnight
                    t_end += 1440

                train_intervals.append({
                    "train_no": train_no,
                    "train_type": t_type,
                    "priority_class": p_class,
                    "penalty_weight": p_weight,
                    "start_min": t_start,
                    "end_min": t_end
                })

            # Sort trains by start time
            train_intervals.sort(key=lambda x: x["start_min"])

            # Find gaps between consecutive trains
            extended_intervals = train_intervals.copy()
            if not extended_intervals:
                # Completely empty line: full 24h available
                candidate_slots.append({
                    "slot_id": f"SLOT-{slot_id_counter:04d}",
                    "section_from": s_from,
                    "section_to": s_to,
                    "line": line,
                    "start_min": 60,
                    "end_min": 300,
                    "duration_min": 240,
                    "is_night_window": True,
                    "quality_score": 100
                })
                slot_id_counter += 1
                continue

            # Standard timeline scan across 1440 minutes (24h)
            timeline_start = 0
            for t in extended_intervals:
                gap = t["start_min"] - timeline_start
                usable_duration = gap - 10  # 10 min safety clearance headway
                if usable_duration >= min_block_duration_min:
                    is_night = (timeline_start >= 0 and timeline_start <= 330) or (timeline_start >= 1320)
                    candidate_slots.append({
                        "slot_id": f"SLOT-{slot_id_counter:04d}",
                        "section_from": s_from,
                        "section_to": s_to,
                        "line": line,
                        "start_min": int(timeline_start),
                        "end_min": int(t["start_min"] - 10),
                        "duration_min": int(usable_duration),
                        "is_night_window": is_night,
                        "quality_score": 95 if is_night else 75
                    })
                    slot_id_counter += 1
                timeline_start = max(timeline_start, t["end_min"] + 10)

            # Final gap after last train until midnight
            final_gap = 1440 - timeline_start
            if final_gap >= min_block_duration_min:
                candidate_slots.append({
                    "slot_id": f"SLOT-{slot_id_counter:04d}",
                    "section_from": s_from,
                    "section_to": s_to,
                    "line": line,
                    "start_min": int(timeline_start),
                    "end_min": 1440,
                    "duration_min": int(final_gap),
                    "is_night_window": True,
                    "quality_score": 90
                })
                slot_id_counter += 1

    return candidate_slots


if __name__ == "__main__":
    slots = find_available_corridor_slots()
    print(f"Discovered {len(slots)} potential maintenance slots along the corridor.")
