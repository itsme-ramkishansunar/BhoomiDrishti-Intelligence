# U71 — Full Functional Hardening

U71 consolidates the map reliability and local-access fixes without changing the persistent data model.

## Changes
- deterministic dotenv reload after local credential repair
- local access smoke reconciles demo accounts from the same `.env` source before verification
- U70 map smoke is version-continuity aware so U70.1/U71 releases do not fail on a stale package version string
- U71 functional contract validates map, GIS provenance, location persistence, credential reconciliation, and validation registration
- no database migration
- no project deletion/reset
- existing persistent SQLite repository remains outside the release directory

## Local validation
Run `npm.cmd run preflight:local`, then `npm.cmd run start:all`, then `npm.cmd run smoke:local-auth-http`.
