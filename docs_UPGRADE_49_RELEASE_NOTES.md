# BHOOMIDHRISHTI Upgrade 49 — Final Operational Integration

## Goal
Freeze the operational product path after U48/U48.1 and remove the remaining demo-vs-persistent inconsistency in the legacy Alerts screen.

## Changes
- Alerts page now reads persistent operational alerts from `/api/alerts`.
- Alert generation uses `/api/alerts/generate`.
- Alert acknowledgement, resolution and dismissal use the persistent alert API.
- Alert evidence/action text is sourced from stored alert metadata when available.
- Added `npm run start:all` to start backend + Vite from the actual project root in one command.
- Added `smoke:final-product` / `release:check` for final product contract checks.
- Existing evidence, prediction, temporal, legal, action, MLOps and replay layers are preserved.

## Safety
No U44/U45/U46/U47/U48 checkpoint is overwritten by this upgrade. Production ML promotion remains gated by the existing governance contract and is not unlocked by this release.
