# Upgrade 47 — Trusted ML Gate + Baseline Training Toolkit

## Purpose
U47 advances BHOOMIDHRISHTI from predictive-foundation code into a governed ML validation layer while preserving the hard gate that prevents unvalidated or synthetic models from being promoted as production probabilities.

## Added
- reviewed ML training schema
- project-level temporal split utility
- logistic baseline trainer (dependency-free Node implementation)
- ROC-AUC, PR-AUC, Brier, calibration error, threshold metrics and Precision/Recall@K
- artifact hashing
- ML promotion gate
- readiness report persistence
- candidate model artifact format
- ML governance and baseline smoke tests

## Production safety
The trainer requires a reviewed prepared dataset, `project_id`, `prediction_time` and a binary outcome label. Synthetic data is explicitly blocked from production training. Candidate artifacts remain non-production until calibration, OOD/applicability, provenance and human approval gates are satisfied.

## Important limitation
The current machine has no SIH26017 dataset in the supplied location. Therefore U47 provides and validates the training machinery, but does not invent a real-world model result or claim production model accuracy.
