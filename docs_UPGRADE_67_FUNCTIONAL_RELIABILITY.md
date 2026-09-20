# U67 — Functional Reliability & Real-Data GIS

U67 is a controlled hardening release based on U66. It does not replace the persistent database or invent authoritative coordinates.

## GIS
- Approximate/demo points remain visible by default and are explicitly labelled.
- Unresolved projects remain visible in the portfolio list instead of disappearing.
- Unresolved projects can be deliberately geocoded through the existing backend proxy and saved as `GEOCODED_PLACE` / `NOMINATIM_OSM`, clearly marked approximate.
- A bulk `Resolve missing` action processes unresolved projects sequentially through the existing rate-limited geocoder.
- Authoritative project coordinates and parcel geometry remain distinct from geocoded/demo locations.
- Map fitting re-evaluates filters instead of remaining locked to a stale selection.

## AI
- `/api/ai/status` now reports safe provider configuration state without exposing keys.
- Local mode remains the default and requires no external key.
- External Gemini/Anthropic use requires an actual key and `AI_DATA_MODE=external_allowed`.
- A provider-configuration smoke test never prints secret values.

## Boundary
U67 does not manufacture government data, parcel geometry, historical outcomes, or production model validation. Real government integration remains dependent on authorised access and source contracts.
