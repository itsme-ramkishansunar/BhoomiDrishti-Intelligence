# U63 — Final UI & Production Hardening

U63 is an additive release on top of U62. It preserves the existing backend, database schema, predictive governance, provenance controls, GIS behavior and project lifecycle.

## Changes
- Fixed flex-shell horizontal overflow by allowing the main application pane to shrink correctly.
- Added responsive page/grid primitives for operational screens.
- Improved typography, line-height, wrapping and action alignment.
- Reworked System Readiness metrics to distinguish successful public snapshots from authoritative government access.
- Added real public-source snapshot actions to Integration Control using the existing authorised `/api/source-connectors/:id/sync` route.
- Added source links, sync progress, success/failure messaging and snapshot status.
- Kept the non-authoritative public-source boundary explicit.
- Changed dashboard wording from `Live data` to `Operational data` to avoid overstating source freshness/authority.
- Added a U63 frontend hardening smoke contract.

## Safety
- No database migration was added.
- No existing predictive engine was replaced.
- No user-uploaded data is promoted to official provenance.
- Public connector sync stores a snapshot and provenance metadata only; it does not create authoritative project records.
- Existing workflow-admin permission remains required for connector sync.

## Remaining real-world dependencies
Authorised government access contracts, validated historical outcome data, production infrastructure, security/acceptance testing and target deployment remain external deployment dependencies.
