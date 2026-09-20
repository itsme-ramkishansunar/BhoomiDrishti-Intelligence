# BHOOMIDHRISHTI U53.1 — Shared Persistent Store Runtime Hardening

This release keeps the U53 shared persistent repository and hardens the runtime boundary so a new release cannot silently create a fresh per-release database or start against an unwritable persistent store.

Changes:
- Read/write SQLite preflight before application startup.
- Persistent-store I/O smoke test and writable transaction check.
- Safe persistent database repair using Node `node:sqlite` online backup.
- Migration uses SQLite online backup instead of copying WAL/SHM sidecars.
- Original legacy database is preserved during migration/repair.
- Single-instance runtime lock in the shared data root.
- Windows startup refuses to start when ports 8787/5173 are already occupied.
- Existing U53/U52/U51 product features remain intact.
