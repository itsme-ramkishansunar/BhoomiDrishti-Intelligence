# Upgrade 51 — Unified Data & Evidence Backbone

## Goal
Make the existing SQLite operational store the authoritative application data backbone while adding a materialized, DB-backed project intelligence bundle for consistent retrieval across AI, project detail, operations, evidence, alerts, actions, and replay.

## Safe design
- Built as a new checkpoint from Upgrade 50.3; earlier checkpoints are untouched.
- Existing 28-table schema remains intact; migration 014 only adds two tables.
- Base operational tables remain the source of truth; the intelligence snapshot is a materialized read model.
- User-uploaded records remain USER_UPLOADED/UNVERIFIED unless authoritative provenance is established.
- Production ML promotion remains gated on real historical outcome evidence.

## New data backbone
- `project_data_facts`: normalized project facts with source/provenance/verification metadata.
- `project_intelligence_snapshots`: versioned current materialized bundle with SHA-256 hashes.
- `GET /api/projects/:id/data-hub`: unified retrieval endpoint.
- `POST /api/projects/:id/data-hub/refresh`: explicit refresh endpoint.
- New project creation and project-intake creation both attempt lifecycle bootstrap plus unified snapshot refresh.

## Scope
The unified hub exposes project data, facts, evidence, events, predictions, recommendations, alerts, interventions, feedback, prediction diff, replay, governance and provenance metadata. Existing feature routes are preserved for backward compatibility.

## Validation
The U51 smoke test creates an isolated temporary SQLite database, verifies normalized fact persistence and provenance, creates a versioned intelligence snapshot with a SHA-256 hash, retrieves the unified data hub, closes the database, and removes the temporary test directory. This avoids the prior Windows SQLite temp-directory cleanup issue.
