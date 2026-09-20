# BHOOMIDHRISTI Upgrade 24 — Temporal Workflow & Legal Intelligence

## Purpose
Turn the project register into a temporal, workflow-aware decision-support foundation without pretending a single acquisition workflow or a generic deadline applies across India.

## Implemented
- Workflow-specific stage ordering for the demo NH pathway.
- Legal-clock definitions with explicit trigger/completion events.
- Court-stay pause/resume handling for the National Highways Act section 3D clock.
- Project-stage dependency graph.
- Authenticated project workflow endpoint.
- Authenticated legal-clock evaluation endpoint.
- Authenticated project-event write endpoint with timestamp validation and audit logging.
- Upgrade 24 project panel exposing applicable framework, current stage, event coverage, clock status and dependency edges.
- Stored-risk wording corrected so deterministic risk scores are not presented as validated probabilities.

## Legal-source discipline
The National Highways Act source is the India Code text. Section 3D(3) is represented as a one-year period from the 3A notification with court-stay periods excluded. Section 3E is represented as a 60-day surrender window from service of the possession notice. The RFCTLARR pathway includes section 25's 12-month award clock from publication of the section 19 declaration. These are source references for decision support, not legal advice.

## Demo-data discipline
Seeded workflow events are synthetic demonstration records. They are not official government events and must remain labelled as synthetic until replaced by authorised source records.

## Safety rules
- No generic 365-day rule is applied to every acquisition.
- A clock is `AWAITING_TRIGGER` when the required source event is absent.
- Court stays pause the NH 3A→3D effective elapsed time.
- Legal determinations remain with authorised legal/government functions.
- Workflow applicability must be confirmed by authorised configuration before using statutory conclusions operationally.
