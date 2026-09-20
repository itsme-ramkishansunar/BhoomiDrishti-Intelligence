# U48.1 — Spacious AI Workspace

U48.1 is a visual-scale-only checkpoint built from U48 Operational Intelligence.

## Changes
- Increased Bhoomi AI workspace height from 64vh/680px max to 74vh/780px max.
- Increased bounded desktop width from 1560px to 1680px.
- Increased conversation content width from 1040px to 1180px.
- Increased chat message typography and padding for readability.
- Increased evidence/confidence, linked-record, recommendation, and uncertainty text sizing.
- Enlarged welcome state icon/title and suggested prompt controls.
- Enlarged composer textarea and send controls.
- Updated AI UX smoke contract to accept both U48 and U48.1 workspace dimensions.
- No data, workflow, API, authentication, prediction, alert, MLOps, or replay behavior changes.

## Validation
- `check:js` PASS
- `check:text` PASS
- `smoke:ai-ux` PASS
- `smoke:ai-query-intelligence` PASS
- `smoke:ai-query-seed` PASS (29 projects)
- Production build must be re-run after dependency installation in the Windows environment.
