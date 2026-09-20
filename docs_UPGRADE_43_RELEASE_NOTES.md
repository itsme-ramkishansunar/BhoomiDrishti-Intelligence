# BHOOMIDHRISHTI Upgrade 43 — Runtime-Hardened UX

## Changes
- Adds `smoke:frontend-symbols` to catch unresolved JSX components and icon references at source-contract level.
- Fixes the previously discovered missing `Link2` frontend binding in Project Intake.
- Removes the hard-coded 95%/5% welcome-state evidence metrics; the welcome state shows no confidence block until an answer supplies actual analysis metadata.
- Tightens the Bhoomi AI workspace to a responsive 520–680px viewport-aware range and widens the desktop canvas.
- Centers conversation content to reduce the narrow-left / empty-canvas effect.
- Adds an AI UX smoke test for the grounded welcome state and layout contracts.
- Preserves the existing backend, database, authentication, AI, predictive, temporal and governance layers.

## Validation
Run `npm.cmd run validate:all` on the Windows runtime, then perform browser smoke tests across login, dashboard, projects, intake, AI, risk map, alerts, history, feedback, data health and access administration.
