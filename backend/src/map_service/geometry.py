"""
Corridor geometry: chainage (KM) <-> WGS-84 coordinates, and the UP/DN track pair.

This module is the single authority for "where on the map is KM 173.5?". Every
map layer resolves its features through `position_at_km`, so a track defect, an
OHE mast and a sanctioned block sitting at the same chainage always land on the
same spot.

Two things are deliberately NOT done here:

1. No parallel-offset coordinates are emitted. The UP/DN separation is a
   *visual* concern that has to react to zoom - 5 metres of real track spacing
   is invisible at zoom 8 and correct at zoom 17 - so the offset is applied
   client-side in corridor_map.js against the centreline plus the `bearing`
   this module supplies. Baking a fixed metre offset into the API would freeze
   that decision at the wrong end.

2. No smoothing or curve fitting. The corridor is stored as 10 surveyed station
   anchors, so between stations the alignment is a straight chord. Denser shape
   points can be dropped into `ndls_cnb_corridor.json` later as a `shape_points`
   array and every consumer picks up the better geometry for free - see
   `_load_centreline`.
"""

import json
import math
import os
from bisect import bisect_right

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
TOPOLOGY_PATH = os.path.join(ROOT_DIR, "data", "topology", "ndls_cnb_corridor.json")

EARTH_RADIUS_M = 6371008.8

# Indian Railways convention on this corridor: DN runs New Delhi -> Kanpur,
# UP runs Kanpur -> New Delhi. Drawn as the right/left rail relative to the
# DN direction of travel, which is how a CTC board reads.
DN_SIDE = 1.0    # right of the NDLS->CNB bearing
UP_SIDE = -1.0   # left of it

_topology_cache = None
_centreline_cache = None


# ---------------------------------------------------------------------------
# Spherical helpers
# ---------------------------------------------------------------------------

def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in metres between two WGS-84 points."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(a)))


def bearing_deg(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Initial great-circle bearing in degrees clockwise from true north."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lng2 - lng1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


def destination_point(lat: float, lng: float, bearing: float, distance_m: float):
    """The point `distance_m` away from (lat, lng) along `bearing` degrees."""
    ang = distance_m / EARTH_RADIUS_M
    br = math.radians(bearing)
    p1, l1 = math.radians(lat), math.radians(lng)

    p2 = math.asin(math.sin(p1) * math.cos(ang) + math.cos(p1) * math.sin(ang) * math.cos(br))
    l2 = l1 + math.atan2(
        math.sin(br) * math.sin(ang) * math.cos(p1),
        math.cos(ang) - math.sin(p1) * math.sin(p2)
    )
    return round(math.degrees(p2), 7), round((math.degrees(l2) + 540) % 360 - 180, 7)


# ---------------------------------------------------------------------------
# Topology loading
# ---------------------------------------------------------------------------

def load_topology() -> dict:
    """Reads and caches the corridor topology JSON."""
    global _topology_cache
    if _topology_cache is None:
        with open(TOPOLOGY_PATH, "r", encoding="utf-8") as f:
            _topology_cache = json.load(f)
    return _topology_cache


def stations() -> list:
    """Corridor stations, ordered by chainage."""
    return sorted(load_topology().get("stations", []), key=lambda s: s.get("km", 0.0))


def _load_centreline() -> list:
    """
    The corridor centreline as ordered {km, lat, lng} vertices.

    Prefers a `shape_points` array in the topology file when present - that is
    the upgrade path to a real surveyed alignment - and otherwise falls back to
    the station anchors, which is what ships today.
    """
    global _centreline_cache
    if _centreline_cache is not None:
        return _centreline_cache

    topo = load_topology()
    shape = topo.get("shape_points")
    if shape:
        pts = [
            {"km": float(p["km"]), "lat": float(p["lat"]), "lng": float(p["lng"])}
            for p in shape
        ]
    else:
        pts = [
            {"km": float(s["km"]), "lat": float(s["lat"]), "lng": float(s["lng"])}
            for s in stations()
        ]

    _centreline_cache = sorted(pts, key=lambda p: p["km"])
    return _centreline_cache


def corridor_length_km() -> float:
    line = _load_centreline()
    return line[-1]["km"] if line else 0.0


# ---------------------------------------------------------------------------
# Chainage -> coordinate
# ---------------------------------------------------------------------------

def position_at_km(km: float) -> dict:
    """
    Resolves a chainage to a point on the corridor centreline.

    Returns {lat, lng, bearing, km}. `bearing` is the DN direction of travel at
    that chainage, which is what the client needs to offset a feature onto the
    correct rail of the pair.

    Chainages outside the corridor are clamped to its ends rather than raising:
    an asset row with a slightly out-of-range KM should still be findable on the
    map, not silently dropped.
    """
    line = _load_centreline()
    if not line:
        return {"lat": 0.0, "lng": 0.0, "bearing": 0.0, "km": km}

    km = max(line[0]["km"], min(float(km), line[-1]["km"]))

    kms = [p["km"] for p in line]
    idx = bisect_right(kms, km) - 1
    idx = max(0, min(idx, len(line) - 2))

    a, b = line[idx], line[idx + 1]
    span = b["km"] - a["km"]
    t = 0.0 if span <= 0 else (km - a["km"]) / span

    return {
        "km": round(km, 3),
        "lat": round(a["lat"] + (b["lat"] - a["lat"]) * t, 7),
        "lng": round(a["lng"] + (b["lng"] - a["lng"]) * t, 7),
        "bearing": round(bearing_deg(a["lat"], a["lng"], b["lat"], b["lng"]), 2),
    }


def path_between_km(km_start: float, km_end: float) -> list:
    """
    The centreline polyline covering a chainage range, as [{lat,lng,bearing},...].

    Includes every intermediate vertex so a block spanning several sections
    follows the alignment instead of cutting the corner.
    """
    lo, hi = sorted((float(km_start), float(km_end)))
    if hi - lo < 0.01:
        hi = lo + 0.01

    pts = [position_at_km(lo)]
    for v in _load_centreline():
        if lo < v["km"] < hi:
            pts.append(position_at_km(v["km"]))
    pts.append(position_at_km(hi))
    return pts


def offset_path(path: list, side: float, distance_m: float) -> list:
    """
    Server-side parallel offset, used only where a fixed metre offset is genuinely
    wanted (exports, static images). The live map offsets client-side per zoom.

    `side` is DN_SIDE or UP_SIDE; the offset is applied perpendicular to each
    vertex's bearing.
    """
    out = []
    for p in path:
        lat, lng = destination_point(
            p["lat"], p["lng"], p["bearing"] + 90.0 * side, distance_m
        )
        out.append({"lat": lat, "lng": lng, "bearing": p["bearing"]})
    return out


# ---------------------------------------------------------------------------
# Section resolution
# ---------------------------------------------------------------------------

def sections() -> list:
    """
    The inter-station sections of the corridor, in DN order.

    Each carries both endpoints' chainage so a section can be drawn as a span
    without the caller re-deriving it from the station list.
    """
    sts = stations()
    out = []
    for a, b in zip(sts, sts[1:]):
        out.append({
            "section": f"{a['code']} - {b['code']}",
            "from": a["code"],
            "to": b["code"],
            "km_start": a["km"],
            "km_end": b["km"],
            "length_km": round(b["km"] - a["km"], 2),
        })
    return out


def section_km_range(section_from: str, section_to: str):
    """
    Chainage span for a named section, tolerant of the shapes the data uses.

    S&T assets are station-based and store `section_from == section_to`, which
    is a yard, not a span - those resolve to a short stub around the station so
    they still get a real position on the map.
    """
    by_code = {s["code"]: s for s in stations()}
    a = by_code.get(str(section_from).upper().strip())
    b = by_code.get(str(section_to).upper().strip())

    if a and b:
        if a["km"] == b["km"]:
            return a["km"], a["km"] + 1.0
        return min(a["km"], b["km"]), max(a["km"], b["km"])
    if a:
        return a["km"], a["km"] + 1.0
    return None


def nearest_station(km: float) -> dict:
    """The station closest to a chainage - used to caption free-floating features."""
    return min(stations(), key=lambda s: abs(s["km"] - float(km)))


# ---------------------------------------------------------------------------
# Public geometry document
# ---------------------------------------------------------------------------

def corridor_geometry() -> dict:
    """
    Everything a client needs to draw the corridor once, cached hard on the
    frontend: the centreline, the station anchors, and the section index.
    """
    topo = load_topology()
    line = _load_centreline()

    return {
        "corridor_name": topo.get("corridor_name"),
        "zone": topo.get("zone"),
        "total_distance_km": topo.get("total_distance_km", corridor_length_km()),
        "electrification": topo.get("electrification"),
        "signalling_type": topo.get("signalling_type"),
        "tracks": topo.get("tracks", ["UP", "DN"]),
        "track_sides": {"DN": DN_SIDE, "UP": UP_SIDE},
        "centreline": [
            {
                "km": p["km"],
                "lat": p["lat"],
                "lng": p["lng"],
                "bearing": position_at_km(p["km"])["bearing"],
            }
            for p in line
        ],
        "stations": [
            {
                "code": s["code"],
                "name": s["name"],
                "km": s["km"],
                "lat": s["lat"],
                "lng": s["lng"],
                "division": s.get("division"),
                "platforms": s.get("platforms"),
                "speed_limit_kmph": s.get("speed_limit_kmph"),
                "depots": s.get("depots", []),
                "bearing": position_at_km(s["km"])["bearing"],
            }
            for s in stations()
        ],
        "sections": sections(),
    }
