# U70 — National Map Functional Rebuild

U70 replaces the brittle map presentation with a single Leaflet GIS workspace designed around explicit location provenance.

## Map contract
- India-bounded viewport with max bounds and stable resize handling.
- Stored project/source coordinates and parcel geometry are preferred.
- District-centroid and place-level coordinates remain explicitly approximate.
- Unresolved records are never silently presented as authoritative coordinates.
- Sidebar location labels use the same classification as the map markers.
- Project selection focuses the corresponding map feature.
- Popup actions open the project dossier.
- Filters, search, risk zones, approximate toggle, ongoing toggle, India view and fit-data all operate on the same filtered dataset.
- Map refresh is safe and non-destructive.
- Location resolution is India-only and writes `GEOCODED_PLACE` only when a geocoder result is returned.
- No automatic parcel-level claim is made from a district/place result.

## Local demo recovery
`BHOOMI_LOCAL_DEMO_LOCATION_FALLBACK=true` permits deterministic district-centroid points for local demonstration records with missing coordinates. These points are marked approximate and are not authoritative land records. Production deployments must set the flag to false and use authorised project/parcel coordinates.

## Authentication recovery
`repair:local-access` now synchronises the five deterministic local demo credentials into `.env` and the shared local database, then reports the GIS repair result. Restart `start:all` after repair.

## Production boundary
U70 does not invent government data, parcel geometry, API authority or model validation. Real deployment still requires authorised source contracts and verified location data.


## U70.1 validation contract fix
The mapping smoke test was updated to assert the actual U70 architecture instead of obsolete U69-era UI prose tokens. No application GIS behavior was weakened or replaced.
