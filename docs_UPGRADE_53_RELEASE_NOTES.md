# U53 — Shared Persistent Data Store

## Purpose
BHOOMIDHRISHTI now uses one shared persistent application data store by default, independent of the release folder. This prevents personal/manual projects, AI sessions, alerts, evidence, actions, feedback, and related records from disappearing when a new upgrade folder is installed.

## Storage
- Windows default: `%LOCALAPPDATA%\BhoomiDrishti\data`
- macOS default: `~/Library/Application Support/BhoomiDrishti/data`
- Linux default: `$XDG_DATA_HOME/bhoomidrishti/data` or `~/.local/share/bhoomidrishti/data`
- Database: `bhoomidrishti.sqlite`
- Override with an explicit absolute `BHOOMI_PERSISTENT_ROOT`, `BHOOMI_DATA_DIR`, or `BHOOMI_DB_PATH` when authorized.
- `BHOOMI_STORAGE_MODE=isolated` is reserved for disposable tests.

## Migration
`npm run migrate:persistent-store` finds legacy release databases, selects the candidate with the largest project repository (tie-broken by newest data), copies the entire legacy data tree into the shared store, and does not modify the source release.

## Data contract
The persistent database remains the system of record for canonical projects, normalized facts, provenance/evidence, temporal snapshots, predictions, alerts, interventions, outcomes, AI sessions, audit records, source snapshots, and operational analytics. New UI releases read through the backend repository rather than shipping personal data inside frontend source.

## Safety
No existing release folder is overwritten by U53. Source data is preserved. The installer refuses to migrate over an existing shared store.
