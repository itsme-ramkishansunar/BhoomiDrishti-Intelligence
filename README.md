# BHOOMIDHRISHTI

**Evidence-Driven Predictive Land Acquisition Intelligence**  
**Smart India Hackathon 2026 — SIH26017**

BHOOMIDHRISHTI is a web-based decision-support prototype for **early detection of land-acquisition delays**. It combines governed data ingestion, project/stage intelligence, evidence and provenance, risk analysis, GIS visualization, alerts, explainability, intervention workflows, what-if simulation, and outcome feedback.

> **Important:** This public repository is a software prototype for evaluation and deployment demonstration. It is **not an official Government of India system**, does not replace any official system of record, and does not claim official government data, authorization, or production ML performance.

## What the system does

```text
DATA
  ↓
VALIDATE + PROVENANCE
  ↓
PROJECT / PARCEL / STAGE STATE
  ↓
RISK + EARLY WARNING
  ↓
WHY?  → evidence / drivers / trust
  ↓
WHAT NEXT? → rule-grounded intervention
  ↓
WHAT-IF? → isolated simulation
  ↓
ACTION → outcome capture
  ↓
LEARN → governed feedback / model queue
```

### Main capabilities

- Dashboard and portfolio monitoring with drill-down.
- Project Intelligence with stage, legal, compensation, documentation and operational signals.
- GIS/risk-map visualization and project deep links.
- Bulk ingestion with profiling, validation, matching, reconciliation and conflict-aware promotion.
- Field-level evidence/provenance and OBSERVED / DERIVED / FORECAST / SIMULATED / UNAVAILABLE states.
- Explainable risk and driver/action intelligence.
- Statutory timeline monitoring and alerts.
- What-if scenarios that never overwrite real project state.
- Role-based access control, audit trails and administrative boundaries.
- 22-language integrity/safety layer and multilingual review safeguards.
- Public reviewer mode with read-only synthetic records and feedback collection.
- Local-first Bhoomi AI/evidence engine; external AI is disabled for the public profile.

## SIH26017 alignment

The system is designed around the SIH26017 flow: project-wise and stage-wise risk, delay drivers, explanations, corrective-action support, district/state trend visibility, GIS, alerts, APIs/integration boundaries, RBAC/audit, and a feedback path toward continuous learning.

## Data honesty

The included seed projects and the `BHOOMIDHRISHTI_U75.7_BULK_UPLOAD_TEST.csv` fixture are reference/demo material for testing the application and are not presented as official Government of India records.

The public demo is intentionally restricted to `synthetic_demo` reference records. Unknown information remains unknown rather than being silently converted to a negative value. Prediction features are designed around prediction-time availability and leakage checks. Production ML promotion remains governed and is not implied by demo records or synthetic metrics.

## Public demo

The public profile is configured with:

```text
BHOOMI_PUBLIC_DEMO_ENABLED=true
BHOOMI_PUBLIC_DEMO_DATA_MODE=synthetic_only
BHOOMI_DEMO_ACCESS_ENABLED=false
AI_PROVIDER=local
AI_DATA_MODE=local_only
AI_LOCAL_FIRST=true
VITE_GOVERNMENT_EMBLEM_AUTHORIZED=false
```

Public reviewers receive an ephemeral Viewer session and cannot mutate projects, promote data, access admin controls, access private/authoritative records, or invoke external AI providers. Review feedback is rate-limited and stored separately.

See [`PUBLIC_DEMO_DEPLOYMENT.md`](PUBLIC_DEMO_DEPLOYMENT.md) and [`PUBLIC_DEPLOYMENT_RELEASE.md`](PUBLIC_DEPLOYMENT_RELEASE.md).

## Technology

- React + Vite
- Node.js + Express
- SQLite persistence
- Leaflet GIS
- Recharts
- Helmet + CORS + rate limiting
- Additive SQL migrations
- Docker / Docker Compose public-demo profile

## Run locally

Requires a current supported Node.js release with the built-in `node:sqlite` runtime used by this project.

```bash
npm install
npm run setup:local
npm run repair:local-access
npm run doctor:u75-runtime
npm run release:production
npm run start:all
```

PowerShell users can use `npm.cmd run ...`.

Open `http://localhost:5173`.

## Public deployment

Use the provided container profile:

```bash
docker compose -f docker-compose.public-demo.yml up -d --build
```

Put HTTPS in front of the application using your hosting provider/reverse proxy. Keep `.env`, credentials, persistent SQLite storage and any authorized data outside source control.

## Repository safety

Never commit:

- `.env` / `.env.*`
- API keys, access tokens or passwords
- private keys/certificates
- SQLite databases or backups
- uploaded/private datasets
- production logs
- local IDE configuration

The repository includes `.env.example`, but it contains **no real credentials**. Demo/local passwords are generated or supplied through the environment.

## Public repository audit

Before pushing the repository publicly, run:

```bash
npm run audit:public
```

This audit is intentionally conservative and checks the working tree for credentials/private-key patterns and local database artifacts.

## Validation

The release gate covers language integrity, persistent-store behavior, project/portfolio safety, U75 bulk integration, evidence/promotion governance, reliability/recovery, command-center/workbench/intelligence contracts, public-demo isolation, and the Vite production build.

```bash
npm run release:production
```

## Verified release baseline

The `1.0.32-u75.10-final-deployment` source was validated on Windows before publication: U73 language integrity `34/34`, U72.4.2 functional `9/9`, U74 final product `19/19`, U75.10 closure `17/17`, public-demo deployment `25/25`, followed by a successful Vite production build.

The public-repository copy additionally runs `npm run audit:public` to check the working tree for credentials/private-key patterns and local database artifacts before publication.

## Repository structure

```text
backend/       API, persistence, intelligence engines and governance
src/           React UI and modules
database/      additive SQL migrations
config/        canonical schemas and mapping templates
scripts/       setup, diagnostics, smoke tests and release gates
docs/          architecture/release documentation
```

## Scope and governance

BHOOMIDHRISHTI is intended to **complement** authorized government systems such as land-record, acquisition, compensation and court systems rather than replace their systems of record. Real connectors, authoritative datasets, identity infrastructure and production ML approval require separate authorization and validation.

## License

No open-source license is granted by this repository unless a separate license file is added by the project owner. Public visibility is provided for Smart India Hackathon evaluation and deployment review.

## Current release history

- `1.0.32-u75.10-final-deployment` — public-review hardened release baseline.

For historical upgrade details, see the `docs_*.md` and `U*.md` release notes included in this repository.
