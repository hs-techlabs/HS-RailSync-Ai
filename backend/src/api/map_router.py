"""
Corridor Map Service HTTP surface (/api/map/*).

A thin transport shell over `src.map_service`: it parses query parameters,
delegates, and returns. All geometry and layer logic lives in the service
package so the same read models can be driven from tests, a notebook, or a
future export job without going through HTTP.

Endpoints:

    GET /api/map/geometry                   corridor centreline, stations, sections
    GET /api/map/layers?department=&layers= geo-resolved feature layers
    GET /api/map/trains                     live train positions
    GET /api/map/presets                    which layers each screen defaults to
"""

from fastapi import APIRouter, HTTPException

from src.map_service import geometry, layers, trains

router = APIRouter(prefix="/api/map", tags=["Corridor Map Service"])


@router.get("/geometry")
def get_corridor_geometry():
    """
    Static corridor geometry. Safe for the client to fetch once and cache: the
    centreline only changes when the topology file does.

    Returns centreline coordinates with per-vertex bearings rather than
    pre-offset UP/DN polylines - the parallel offset is applied client-side so
    it can react to zoom.
    """
    try:
        return geometry.corridor_geometry()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Corridor topology file not found")


@router.get("/layers")
def get_map_layers(department: str = "ALL", layers_csv: str = None):
    """
    Geo-resolved feature layers for one department.

    `layers_csv` is a comma-separated list ("issues,blocks,routines"). Omitted,
    the department's preset from PORTAL_LAYER_PRESETS is used, which is what
    each portal screen wants by default.
    """
    names = None
    if layers_csv:
        names = [n.strip() for n in layers_csv.split(",") if n.strip()]
    return layers.build_layers(department=department, names=names)


@router.get("/trains")
def get_live_trains():
    """Live train positions interpolated from the timetable against the sim clock."""
    result = trains.live_trains()
    return {"total": len(result), "trains": result}


@router.get("/presets")
def get_layer_presets():
    """The default layer set per screen, plus every layer name the service knows."""
    return {
        "presets": layers.PORTAL_LAYER_PRESETS,
        "available_layers": sorted(layers.LAYER_BUILDERS.keys()) + ["trains"],
    }
