# BHOOMIDHRISHTI — Public Review Deployment

This profile is for public evaluation, demos and feedback, not an authorised operational/government deployment. Visitors receive an ephemeral Viewer session limited to projects classified `synthetic_demo`.

## Public reviewers can
- inspect dashboard, projects, intelligence, map, alerts, history and reports;
- use local evidence-grounded Bhoomi AI;
- submit product feedback.

## Public reviewers cannot
- upload, edit, archive or promote data;
- access administration, RBAC or connector controls;
- access authoritative/private records;
- invoke external AI providers.

## Data honesty
The public demo is not an official Government of India system. Synthetic/reference records are labelled as such. The public project-authorization gate rejects non-synthetic records even if a route is accidentally exposed.

## Docker
```bash
docker compose -f docker-compose.public-demo.yml up -d --build
```
Then open the HTTPS URL provided by your hosting/reverse proxy. Keep the SQLite volume and `.env` private.

Required production environment values:
```text
NODE_ENV=production
BHOOMI_PUBLIC_DEMO_ENABLED=true
BHOOMI_PUBLIC_DEMO_DATA_MODE=synthetic_only
BHOOMI_DEMO_ACCESS_ENABLED=false
AI_PROVIDER=local
AI_DATA_MODE=local_only
AI_LOCAL_FIRST=true
VITE_GOVERNMENT_EMBLEM_AUTHORIZED=false
```
Also set a strong `BHOOMI_ADMIN_EMAIL` and `BHOOMI_ADMIN_PASSWORD`.

## Feedback
Public reviews are stored in the additive `public_demo_feedback` table and rate-limited. No name/email is requested by the public review form. Administrators can inspect the summary at `GET /api/admin/public-demo-feedback`.

## Proxy / HTTPS

Serve the public instance through the hosting provider or a trusted HTTPS reverse proxy. For one reverse proxy hop set `BHOOMI_TRUST_PROXY=1`; keep it `0` when the app is directly exposed. The public session cookie is `Secure` in production and therefore requires HTTPS.

## Publish gate
Run the complete Windows release gate before publishing a URL:
```powershell
npm.cmd install --no-audit --no-fund
npm.cmd run doctor:u75-runtime
npm.cmd run smoke:public-ui-integrity
npm.cmd run release:production
npm.cmd run start:all
```
Then test in an incognito browser: public demo entry, dashboard, projects, map, project detail, review submission, blocked mutation/admin routes, refresh/logout, and `/api/public/demo/config`.

For an authorised operational deployment, use the normal `docker-compose.yml`, keep public demo disabled, and connect approved identity/access management, data adapters and governance controls.
