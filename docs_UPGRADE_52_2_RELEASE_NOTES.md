# U52.2 — Precise GIS Stable Release

## Purpose
U52.2 hardens the BHOOMIDHRISHTI GIS layer while preserving the U51 unified data/evidence backbone, provenance controls, temporal safeguards, predictive governance and evidence-to-action workflow.

## GIS behavior
- Uses stored project latitude/longitude or supplied GeoJSON geometry; unresolved projects are not guessed onto the map.
- Supplied GeoJSON geometry is spatially authoritative and is rendered even when a representative point also exists.
- Synthetic district points remain explicitly labelled as demonstration/approximate coordinates.
- User-triggered Nominatim search is proxied server-side with serialized calls and caching.
- Project data auto-refreshes every 30 seconds while the application is visible, with manual refresh available.
- Existing project records can be corrected from the Project Details page and the correction is persisted through the backend.
- Place geocoding is clearly distinct from authoritative cadastral/parcel geometry.

## Stability fixes
- Hardened the frontend symbol smoke parser for named/default/namespace imports and side-effect imports.
- Eliminated the Windows/Node 24 `shell: true` launcher warning path by spawning Node directly.
- Added stronger GIS smoke contracts for geometry precedence, provenance and existing-project location correction.
- Package is shipped with project files at the archive root, avoiding an accidental extra `u52` nesting layer.

## Safety
- U51 is never modified by this release.
- No fake live government API or invented parcel geometry is added.
- No synthetic coordinate is represented as authoritative parcel location.
- Production-grade parcel precision remains dependent on authorized source geometry or verified coordinates.
- Production ML remains gated on authorized historical outcome data, temporal validation, calibration, OOD controls and governance approval.
