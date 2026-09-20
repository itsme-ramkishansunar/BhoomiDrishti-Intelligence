# U64 — Connector Reliability & Action Feedback

U64 hardens the U63 integration controls without changing the predictive engine or database schema.

## Changes
- Adds a live source reachability check endpoint: `GET /api/source-connectors/:id/check`.
- Keeps snapshot capture at `POST /api/source-connectors/:id/sync`.
- Adds timeout/retry-safe public source fetching and cache-control headers.
- Adds explicit UI actions: **Source**, **Test source**, and **Capture snapshot**.
- Shows HTTP status and persisted snapshot timestamps.
- Handles non-JSON backend failures without silent UI failure.
- Preserves the public-source/non-authoritative provenance boundary.
- No U64 database migration.

## Important boundary
A successful public snapshot is evidence that a public endpoint was reachable and returned content. It is not an authorised government integration, official project record, or production ML training source.
