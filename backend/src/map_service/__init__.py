"""
Corridor Map Service.

A self-contained geospatial service for the NDLS-CNB corridor. Owns two things
the rest of the system deliberately does not:

1. `geometry` - the single authority on turning railway chainage (KM) into
   WGS-84 coordinates, and on the UP/DN track pair. Everything that needs to
   put something "on the map" goes through here, so a defect at KM 173.5 lands
   in exactly the same place no matter which screen asked.

2. `layers` - geo-resolved feature layers built from live simulator state
   (field reports, sanctioned blocks) and from the ML backlog (asset wear,
   routine dues, system health). Layers are pure read models: they never
   mutate simulator state.

The service is consumed over HTTP via `src/api/map_router.py` (/api/map/*) and
rendered by the drop-in frontend module `src/frontend/js/corridor_map.js`.
"""

from src.map_service import geometry, layers  # noqa: F401
