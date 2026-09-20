# U53 Persistent Store Guide

## Problem solved
Earlier upgrades stored `bhoomidrishti.sqlite` inside each release folder. Every fresh release therefore started with a new database and the frontend correctly showed only that release's repository. U53 removes the release-folder dependency.

## One repository for all releases

```text
BHOOMIDHRISHTI release A ─┐
BHOOMIDHRISHTI release B ─┼──> Shared persistent data root
BHOOMIDHRISHTI release C ─┘       ├── bhoomidrishti.sqlite
                                  ├── incoming/
                                  ├── forensics/
                                  ├── intake/
                                  ├── ml/
                                  └── storage-manifest.json
```

The database remains the authoritative application repository. Frontend state is a view/cache of API responses, not the system of record.

## What remains persistent
Projects, project stages, evidence/document records, litigation/compensation records, project events, source snapshots, intake records, canonical records, normalized project facts, intelligence snapshots, predictions, prediction explanations/diffs, alerts/events, interventions/outcomes, officer feedback, AI sessions/messages/evidence lineage, model monitoring/replay records, users, roles, and audit events remain in the same database. File-backed intake/forensics/ML artifacts remain under the same shared data root.

## Safety model
- Release folders are never used as the default long-term database location.
- Existing legacy releases are never overwritten by the migration command.
- The migration command refuses to populate a non-empty shared root automatically.
- Isolated storage exists only for smoke tests/disposable environments.
- Future releases should not carry personal project data in source code.

## Production evolution
The storage interface is kept behind the backend repository boundary. SQLite is suitable for the local/demo deployment; an authorized production deployment can move the same repository contract to PostgreSQL with connection pooling, backups, HA and role-based infrastructure without changing the React application contract.
