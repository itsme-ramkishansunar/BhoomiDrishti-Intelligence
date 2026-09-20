# BHOOMIDHRISHTI U52 — Precise GIS Mapping

## Objective
Eliminate misleading schematic/state fallback positions and make map placement evidence-driven.

## Changes
- Added persistent project location metadata: precision, source, label, OSM identifiers and bounding box.
- Added cached server-side geocoding proxy for deliberate user-triggered place searches.
- Seed records now receive explicit demonstration district points only for synthetic display.
- Map no longer plots projects without project coordinates or parcel geometry.
- Duplicate exact coordinates are grouped instead of visually jittered.
- Added manual latitude/longitude entry and deliberate location search to Add Project.
- Added live project refresh every 30 seconds while the page is visible plus a manual Refresh control.
- Added mapping smoke validation.

## Safety
Geocoded coordinates are not treated as authoritative cadastral geometry. Authoritative parcel/project geometry must come from the authorised source record. The public Nominatim service is queried only by deliberate user action, through the server, with one-at-a-time throttling and cached results.
