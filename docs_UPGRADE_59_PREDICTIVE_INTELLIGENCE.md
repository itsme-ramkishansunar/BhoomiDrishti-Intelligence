# U59 — Predictive Intelligence Bulk Development

U59 extends the frozen U56.3/U57/U58 baseline without replacing the existing risk engine, data backbone, project lifecycle, GIS, evidence, AI or governance paths.

## Added
- Predictive Intelligence Lab UI with pipeline status, candidate portfolio signals, research-artifact control and project inspection.
- Point-in-time feature vector builder with stage, temporal, compensation, legal, approval, documentation, R&R and administrative signals.
- Candidate survival/exposure curve for project-stage investigation. This is explicitly not a calibrated survival probability.
- Research artifact builder using the existing temporal logistic baseline when a reviewed dataset is present.
- Standardized-distance OOD/applicability calculation for reviewed training distributions.
- Governance-safe artifact endpoint. Research artifacts cannot be promoted automatically.
- Restrained UI motion system with reduced-motion support and project timeline progression treatment.

## Safety
- No changes to the shared persistent SQLite database schema.
- No automatic training from user uploads.
- No automatic model promotion.
- No synthetic data may be used by the research artifact builder.
- Production probability claims remain blocked until authorised historical outcomes, temporal evaluation, calibration, OOD applicability, provenance and human approval are satisfied.
