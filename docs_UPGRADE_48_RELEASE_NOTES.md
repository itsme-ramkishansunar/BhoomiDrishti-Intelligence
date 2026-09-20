# BHOOMIDHRISHTI Upgrade 48 — Operational Intelligence

## Scope
Operational completion layer built on the validated U47 Trusted ML foundation.

## Added
- Persistent early-warning alert store and lifecycle events.
- Rule-based operational warning engine separated from calibrated ML prediction.
- Warning-window state explicitly reports `NOT_AVAILABLE` until validated prediction evidence exists.
- Alert generation, acknowledgement, resolution and event history APIs with project-scope authorization.
- Model monitoring snapshot ledger for calibration, Brier, OOD, false-alert, coverage, action and outcome metrics.
- Point-in-time project replay API covering events, predictions, feedback and intervention outcomes.
- Operational Intelligence / MLOps Center UI.
- Validation smoke contracts for operations, MLOps and replay.

## Safety / governance
Operational warnings are derived decision-support signals. They are not presented as calibrated probabilities, causal effects, legal determinations or government priorities. Production ML promotion remains gated on real authorized data, temporal validation, leakage clearance, calibration, applicability/OOD checks and human approval.

## Rollback
U47 remains unchanged and is the immediate rollback baseline.
