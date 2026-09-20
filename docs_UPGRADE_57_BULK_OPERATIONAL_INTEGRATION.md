# U57 — Bulk Operational Integration

U57 is an additive product-integration release built from the validated U56.3 baseline.

## Safety boundary

- U56.3 remains frozen.
- The shared persistent repository remains the single operational store.
- No destructive migration is introduced.
- Existing risk, predictive, GIS, evidence, AI, alert, intervention and governance modules remain the sources of truth.
- Public government sources are represented as discovery/snapshot connectors only. A public web snapshot is not automatically authoritative project data.
- Production ML promotion remains blocked until the existing authorised-data, temporal, leakage, calibration, OOD and governance gates pass.

## Added

### National Intelligence Center

A portfolio-level operational view combining:

- authorised project scope
- risk bands
- intervention queue
- stage pressure/bottleneck aggregation
- state-level risk aggregation
- alert/action/feedback pressure
- model-governance state
- public-source connector health

It links back into the existing project detail route and does not create a second project state.

### Portfolio export

`GET /api/portfolio/export.csv` exports the authorised project scope using the existing project repository and access controls.

### Public source catalog expansion

Added public snapshot/discovery connectors for:

- LACRRIS public project-wise reporting
- PAIMANA public infrastructure monitoring

These are intentionally not treated as live authoritative machine integrations without an approved access contract.
