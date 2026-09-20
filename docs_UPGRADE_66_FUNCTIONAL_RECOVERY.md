# U66 — Functional Recovery

## Fixed
- Map shows valid project points and approximate/demo points by default, while clearly labelling approximate locations.
- Invalid/out-of-India coordinates are not silently plotted; when a known demo district point exists they are converted to an explicitly approximate district-centroid fallback. Unknown locations remain unresolved.
- Local demo role scopes are national so each role can exercise its assigned module set against the local demonstration portfolio; this does not change production IAM rules.
- Deterministic local credential repair verifies all five demo profiles against the persistent store.
- Existing valid coordinates are preserved.

## Production boundary
District-centroid fallbacks are demonstration-only and are not authoritative parcel/project coordinates. Government deployment must use authorised project geometry/coordinates and institutional identity management.
