# U49.2 — Predictive Graphics + New-Project Automation

## Scope
U49.2 is a surgical follow-on from the Windows-validated U49.1 checkpoint.

## Changes
- Added interactive predictive risk trajectory line chart.
- Added predictive-driver contribution bar chart.
- Kept every chart bound to the selected project's live predictive payload.
- Preserved the candidate/not-validated governance wording.
- Added explicit UI wording that the same project-ID-driven intelligence pipeline applies automatically to newly created projects.
- Added a new-project automation smoke contract covering project creation plus project-scoped predictive, warning, evidence, recommendation, workflow, legal-clock and intervention routes.

## Safety
- No changes to frozen U44 V2.
- No changes to the Windows launcher fix from U49.1.
- No production-model promotion logic changes.
- No new credentials or API keys.
- Charts are visualization of existing derived signals; they do not create new ML claims.

## Validation
- New-project automation + predictive graphics smoke: PASSED.
- backend/server.js syntax: PASSED.
- smoke-new-project-automation.cjs syntax: PASSED.
- Full Windows `validate:all` / production build must be rerun in the U49.2 Windows copy before release freeze because the local build environment did not have preinstalled npm dependencies available.
