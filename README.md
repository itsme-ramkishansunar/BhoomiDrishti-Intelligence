# BHOOMIDHRISHTI — Evidence-Driven Predictive Land Acquisition Intelligence

BHOOMIDHRISHTI is a public research/prototype system for **Smart India Hackathon 2026 problem SIH26017: Predictive Analytics System for Early Detection of Land Acquisition Delays**.

It combines evidence ingestion, validation, provenance, project intelligence, risk analysis, GIS visualization, alerts, intervention workflows, what-if simulation, auditability and governed feedback.

## What it does

- Project and portfolio monitoring
- Stage-aware land-acquisition intelligence
- Evidence and provenance tracking
- Risk-driver and explainability views
- GIS risk visualization and project drill-down
- Statutory timeline / bottleneck monitoring
- Deterministic intervention recommendations
- What-if scenarios kept separate from real project state
- Bulk ingestion, validation, matching, reconciliation and downstream propagation
- RBAC and audit trails
- Public reviewer mode with synthetic/demo-only records
- Public feedback collection
- ML-readiness and governance gates that avoid presenting synthetic/demo results as validated real-world performance

## Architecture

```text
Authorized / demo data
        ↓
Ingestion + Validation + Provenance
        ↓
Entity Resolution / Evidence
        ↓
Canonical Project + Temporal State
        ↓
Risk + Stage Intelligence + Rule Engine
        ↓
Explanation + GIS + Alerts
        ↓
Intervention + What-if
        ↓
Officer Action / Outcome
        ↓
Governed Feedback + Monitoring
```

## Public demo

The public-review mode is explicitly isolated from operational/private data.

When enabled, public visitors receive an ephemeral read-only Viewer session and are restricted to records labelled `synthetic_demo`. Public users cannot administer the system, mutate project records, promote bulk data, or invoke external AI providers.

See:

- `PUBLIC_DEMO_DEPLOYMENT.md`
- `FINAL_PUBLIC_DEPLOYMENT_HARDENING.md`
- `PUBLIC_DEPLOYMENT_RELEASE.md`

## Data honesty

This repository does **not** claim to be an official Government of India production system and does not replace government systems of record.

Do not treat demo/synthetic records or repository-reported model metrics as evidence of production accuracy. Production predictive modeling requires authorized historical outcome data, a defensible temporal label, leakage-safe features, calibration and independent evaluation.

Unknown/unavailable information is kept distinct from observed negative outcomes.

## Technology

- React
- Vite
- Node.js
- Express
- SQLite
- Leaflet
- Recharts

## Local development

Use a supported Node.js release (the validated environment uses Node.js 24).

```bash
npm install
npm run doctor
npm run validate:all
npm run build
npm run start:all
```

PowerShell may use `npm.cmd`.

## Public deployment

Use the supplied production/public-demo deployment configuration. Keep secrets in the deployment environment only.

Never commit:

- `.env` or secret configuration
- API keys/tokens/passwords
- private datasets
- SQLite databases/backups
- `node_modules`
- `dist`

## Verification

The release includes regression and public-deployment smoke tests covering language integrity, persistent storage, portfolio hygiene, U74/U75 functionality, evidence/provenance, bulk reliability, public-demo isolation and the production frontend build.

## Status

Current release: **1.0.32-u75.10-final-deployment**

This is a research/prototype deployment intended for evaluation, judging and controlled demonstration.
