"""
One-off generator for the canned field-evidence attachments.

NOT part of the running application - run it once to populate
`data/attachments/{track,ohe,signal}/`, which the API then serves statically.

Produces per department: 2 stylised "site photo" PNGs and 1 one-page PDF field
inspection report. The generated reports reference them randomly, so the text is
deliberately generic rather than tied to a specific asset.

Uses matplotlib, already a project dependency - it infers PDF from the file
extension, so no additional PDF library is needed.

    py -3.13 scripts/generate_attachments.py
"""

import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as patches

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ATTACH_DIR = os.path.join(ROOT_DIR, "data", "attachments")

BG = "#eef1f5"
RAIL = "#334155"
STEEL = "#64748b"
ALERT = "#dc2626"
WARN = "#f59e0b"


def _new_fig(title: str, subtitle: str):
    fig, ax = plt.subplots(figsize=(6.4, 4.2))
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(BG)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 65)
    ax.axis("off")
    ax.text(3, 61, title, fontsize=11, fontweight="bold", color="#0f172a")
    ax.text(3, 56.5, subtitle, fontsize=7.5, color=STEEL)
    return fig, ax


def _save(fig, dept_dir: str, filename: str):
    out_dir = os.path.join(ATTACH_DIR, dept_dir)
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, filename)
    fig.savefig(path, dpi=110, bbox_inches="tight", facecolor=BG)
    plt.close(fig)
    print(f"  wrote {os.path.relpath(path, ROOT_DIR)}")


# ---------------------------------------------------------------------------
# Track (Civil / P-Way)
# ---------------------------------------------------------------------------

def track_photo_1():
    fig, ax = _new_fig("P-WAY SITE PHOTOGRAPH", "Rail surface defect located during USFD patrol")
    for y in (24, 38):
        ax.plot([6, 94], [y, y], color=RAIL, lw=5, solid_capstyle="butt")
    for x in range(8, 95, 7):
        ax.add_patch(patches.Rectangle((x, 22), 4, 18, facecolor="#94a3b8",
                                       edgecolor="#475569", lw=0.6))
    ax.add_patch(patches.Rectangle((6, 12), 88, 10, facecolor="#cbd5e1",
                                   edgecolor="#94a3b8", lw=0.8))
    ax.text(50, 16.5, "BALLAST SECTION", fontsize=6.5, color=STEEL, ha="center")
    ax.add_patch(patches.Circle((58, 38), 6.5, fill=False, edgecolor=ALERT, lw=2.2))
    ax.annotate("Transverse rail flaw\n(USFD indication)", xy=(58, 38), xytext=(66, 50),
                fontsize=7, color=ALERT, fontweight="bold",
                arrowprops=dict(arrowstyle="->", color=ALERT, lw=1.4))
    ax.text(3, 5, "Reference only - stylised field evidence for simulator demo",
            fontsize=6, color="#94a3b8", style="italic")
    _save(fig, "track", "site_photo_1.png")


def track_photo_2():
    fig, ax = _new_fig("P-WAY SITE PHOTOGRAPH", "Fouled ballast and cess drainage observation")
    ax.plot([6, 94], [40, 40], color=RAIL, lw=5)
    ax.plot([6, 94], [30, 30], color=RAIL, lw=5)
    for x in range(8, 95, 7):
        ax.add_patch(patches.Rectangle((x, 28), 4, 14, facecolor="#94a3b8",
                                       edgecolor="#475569", lw=0.6))
    ax.add_patch(patches.Polygon([(20, 14), (62, 14), (56, 27), (26, 27)],
                                 facecolor="#a16207", alpha=0.55, edgecolor="#78350f"))
    ax.annotate("Fouled ballast / poor drainage", xy=(40, 20), xytext=(56, 8),
                fontsize=7, color="#78350f", fontweight="bold",
                arrowprops=dict(arrowstyle="->", color="#78350f", lw=1.3))
    ax.add_patch(patches.Circle((30, 40), 4.5, fill=False, edgecolor=WARN, lw=2))
    ax.text(24, 48, "Loose fastening", fontsize=6.8, color="#b45309", fontweight="bold")
    _save(fig, "track", "site_photo_2.png")


# ---------------------------------------------------------------------------
# OHE (Traction Distribution)
# ---------------------------------------------------------------------------

def ohe_photo_1():
    fig, ax = _new_fig("OHE SITE PHOTOGRAPH", "Contact wire wear measured at mast location")
    ax.add_patch(patches.Rectangle((14, 10), 3.5, 42, facecolor=STEEL, edgecolor="#334155"))
    ax.plot([14, 88], [50, 50], color="#475569", lw=2)          # catenary
    ax.plot([16, 88], [34, 34], color="#0f172a", lw=3)          # contact wire
    for x in range(22, 88, 11):
        ax.plot([x, x], [34, 50], color=STEEL, lw=1.1)          # droppers
    ax.text(90, 50.5, "Catenary", fontsize=6.5, color=STEEL, ha="right")
    ax.text(90, 30, "Contact wire", fontsize=6.5, color=STEEL, ha="right")
    ax.add_patch(patches.Rectangle((48, 31.5), 16, 5, fill=False, edgecolor=ALERT, lw=2))
    ax.annotate("Wear zone: residual\ndiameter below limit", xy=(56, 34), xytext=(46, 16),
                fontsize=7, color=ALERT, fontweight="bold",
                arrowprops=dict(arrowstyle="->", color=ALERT, lw=1.4))
    ax.text(3, 5, "25 kV 50 Hz AC traction - isolation required before work",
            fontsize=6, color="#94a3b8", style="italic")
    _save(fig, "ohe", "site_photo_1.png")


def ohe_photo_2():
    fig, ax = _new_fig("OHE SITE PHOTOGRAPH", "Insulator and ATD counterweight close-up")
    ax.add_patch(patches.Rectangle((20, 12), 4, 40, facecolor=STEEL, edgecolor="#334155"))
    for i, y in enumerate(range(34, 48, 4)):
        ax.add_patch(patches.Ellipse((32, y), 11, 3.2, facecolor="#e2e8f0",
                                     edgecolor="#64748b", lw=0.9))
    ax.text(40, 47, "Polymeric insulator string", fontsize=6.8, color=STEEL)
    for i, y in enumerate((14, 18, 22, 26)):
        ax.add_patch(patches.Rectangle((66, y), 14, 3.2, facecolor="#94a3b8",
                                       edgecolor="#475569", lw=0.7))
    ax.text(73, 31, "ATD counterweight stack", fontsize=6.8, color=STEEL, ha="center")
    ax.annotate("Tracking marks on\ninsulator shed", xy=(32, 40), xytext=(50, 54),
                fontsize=7, color=WARN, fontweight="bold",
                arrowprops=dict(arrowstyle="->", color=WARN, lw=1.3))
    _save(fig, "ohe", "site_photo_2.png")


# ---------------------------------------------------------------------------
# Signal (S&T)
# ---------------------------------------------------------------------------

def signal_photo_1():
    fig, ax = _new_fig("S&T SITE PHOTOGRAPH", "Point machine and turnout observation")
    ax.plot([6, 94], [26, 26], color=RAIL, lw=4)
    ax.plot([6, 94], [34, 34], color=RAIL, lw=4)
    ax.plot([44, 94], [34, 48], color=RAIL, lw=4)
    ax.add_patch(patches.Rectangle((34, 14), 16, 9, facecolor="#cbd5e1",
                                   edgecolor="#334155", lw=1.2))
    ax.text(42, 18, "IRS PT-M", fontsize=6.5, ha="center", color="#0f172a", fontweight="bold")
    ax.plot([42, 42], [23, 26], color="#334155", lw=1.6)
    ax.add_patch(patches.Circle((46, 34), 5.5, fill=False, edgecolor=ALERT, lw=2.2))
    ax.annotate("Sluggish throw / obstruction\nat switch toe", xy=(46, 34), xytext=(56, 55),
                fontsize=7, color=ALERT, fontweight="bold",
                arrowprops=dict(arrowstyle="->", color=ALERT, lw=1.4))
    ax.text(3, 5, "Disconnection memo required before S&T work",
            fontsize=6, color="#94a3b8", style="italic")
    _save(fig, "signal", "site_photo_1.png")


def signal_photo_2():
    fig, ax = _new_fig("S&T RELAY ROOM PANEL", "Track circuit / axle counter indication panel")
    ax.add_patch(patches.Rectangle((12, 12), 76, 40, facecolor="#1e293b", edgecolor="#0f172a"))
    idx = 0
    for row in range(4):
        for col in range(8):
            x = 17 + col * 9
            y = 44 - row * 9
            faulty = (row == 2 and col == 5)
            color = ALERT if faulty else "#22c55e"
            ax.add_patch(patches.Circle((x, y), 2.4, facecolor=color, edgecolor="#0f172a"))
            idx += 1
    ax.annotate("Track circuit drop\n(persistent occupancy)", xy=(62, 26), xytext=(52, 3),
                fontsize=7, color=ALERT, fontweight="bold",
                arrowprops=dict(arrowstyle="->", color=ALERT, lw=1.4))
    _save(fig, "signal", "site_photo_2.png")


# ---------------------------------------------------------------------------
# Inspection report PDFs
# ---------------------------------------------------------------------------

REPORT_TEXT = {
    "track": {
        "title": "FIELD INSPECTION REPORT - CIVIL / P-WAY (TMS)",
        "gang": "Track Patrol Gang / PWI Field Inspector",
        "method": "Visual patrol + USFD ultrasonic testing (RDSO/IRPWM norms)",
        "observation": [
            "Rail surface condition and geometry recorded at reported chainage.",
            "Track Geometry Index (TGI) computed per RDSO composite formula.",
            "Fastenings, sleepers and ballast profile examined over 100 m either side.",
            "Cess drainage checked; no immediate washaway risk observed.",
        ],
        "action": [
            "Recommend block possession for attention as per attached severity tier.",
            "Tamping / deep screening machine to be indented if geometry is POOR.",
            "Impose temporary speed restriction if USFD status reads IMR.",
        ],
    },
    "ohe": {
        "title": "FIELD INSPECTION REPORT - TRACTION DISTRIBUTION (TDMS)",
        "gang": "TRD Linemen Gang / OHE Patrol Inspector",
        "method": "Tower wagon patrol + contact wire thickness gauging (ACTM norms)",
        "observation": [
            "Contact wire residual diameter measured against 12.24 mm nominal.",
            "ATD counterweight travel and tension balance verified at anchor.",
            "Insulator sheds inspected for tracking, cracks and pollution deposit.",
            "Pantograph spark incidence over preceding 30 days reviewed.",
        ],
        "action": [
            "Recommend 25 kV AC power block with earthing before any work.",
            "Tower wagon and TRD crew to be positioned prior to block commencement.",
            "Renew contact wire section if wear exceeds condemning limit.",
        ],
    },
    "signal": {
        "title": "FIELD INSPECTION REPORT - SIGNAL & TELECOM (SMMS)",
        "gang": "Signal Maintainer Gang / S&T Field Technician",
        "method": "Point machine throw timing, current draw and megger test (IRSEM norms)",
        "observation": [
            "Point machine throw time recorded against 4.0-5.0 s normal band.",
            "Motor peak current compared against 1.8-2.2 A healthy range.",
            "Cable insulation resistance meggered; value logged in maintenance register.",
            "Track circuit / axle counter indications verified in relay room.",
        ],
        "action": [
            "Disconnection notice (T-351) to be accepted by Station Master before work.",
            "Overhaul or replace point machine if throw time remains above norm.",
            "Joint testing with Station Master required before restoring to service.",
        ],
    },
}


def inspection_report(dept_dir: str):
    cfg = REPORT_TEXT[dept_dir]
    fig = plt.figure(figsize=(8.27, 11.69))  # A4 portrait
    fig.patch.set_facecolor("white")
    ax = fig.add_axes([0, 0, 1, 1])
    ax.axis("off")
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)

    ax.add_patch(patches.Rectangle((6, 88), 88, 8, facecolor="#0f172a"))
    ax.text(50, 91.4, cfg["title"], fontsize=10.5, color="white",
            ha="center", fontweight="bold")
    ax.text(50, 86, "GOVERNMENT OF INDIA - MINISTRY OF RAILWAYS", fontsize=7.5,
            ha="center", color=STEEL)
    ax.text(50, 84, "Northern & North Central Railway - NDLS-CNB Trunk Corridor",
            fontsize=7.5, ha="center", color=STEEL)

    y = 78
    for label, value in [
        ("Submitted by", cfg["gang"]),
        ("Inspection method", cfg["method"]),
        ("Corridor", "New Delhi (NDLS) - Kanpur Central (CNB), 440 km"),
        ("Report class", "Field evidence attachment - accompanies digital requisition"),
    ]:
        ax.text(8, y, f"{label}:", fontsize=8, fontweight="bold", color="#0f172a")
        ax.text(30, y, value, fontsize=8, color="#334155")
        y -= 3.4

    y -= 2
    ax.text(8, y, "OBSERVATIONS", fontsize=9, fontweight="bold", color="#0f172a")
    ax.plot([8, 92], [y - 1.2, y - 1.2], color="#cbd5e1", lw=1)
    y -= 5
    for line in cfg["observation"]:
        ax.text(10, y, f"-  {line}", fontsize=8, color="#334155")
        y -= 3.4

    y -= 2
    ax.text(8, y, "RECOMMENDED ACTION", fontsize=9, fontweight="bold", color="#0f172a")
    ax.plot([8, 92], [y - 1.2, y - 1.2], color="#cbd5e1", lw=1)
    y -= 5
    for line in cfg["action"]:
        ax.text(10, y, f"-  {line}", fontsize=8, color="#334155")
        y -= 3.4

    y -= 4
    ax.add_patch(patches.Rectangle((8, y - 14), 84, 14, fill=False,
                                   edgecolor="#cbd5e1", lw=1))
    ax.text(11, y - 4, "Field staff signature", fontsize=8, color=STEEL)
    ax.text(11, y - 9, "Date / Time of inspection", fontsize=8, color=STEEL)
    ax.text(58, y - 4, "Reviewing officer", fontsize=8, color=STEEL)
    ax.text(58, y - 9, "Approved / Rejected", fontsize=8, color=STEEL)

    ax.text(50, 4, "Stylised sample document generated for the block-planning simulator.",
            fontsize=7, color="#94a3b8", ha="center", style="italic")

    out_dir = os.path.join(ATTACH_DIR, dept_dir)
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, "inspection_report.pdf")
    fig.savefig(path, facecolor="white")
    plt.close(fig)
    print(f"  wrote {os.path.relpath(path, ROOT_DIR)}")


def main():
    print("Generating canned field-evidence attachments...")
    track_photo_1()
    track_photo_2()
    ohe_photo_1()
    ohe_photo_2()
    signal_photo_1()
    signal_photo_2()
    for dept_dir in ("track", "ohe", "signal"):
        inspection_report(dept_dir)
    print("Done. 9 files under data/attachments/")


if __name__ == "__main__":
    sys.exit(main())
