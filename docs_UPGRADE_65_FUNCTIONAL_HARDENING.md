# U65 — Functional Hardening: GIS Integrity + Role Accounts

## Scope
- Harden India GIS coordinate integrity and prevent out-of-bound project points from being plotted.
- Repair existing valid project coordinates whose precision metadata was left UNRESOLVED.
- Hide approximate/centroid locations by default; expose them only when the operator explicitly enables approximate points.
- Separate plotted, approximate and unresolved counts in the map UI.
- Normalize bulk-imported coordinates as PROJECT_POINT when coordinates are explicitly supplied.
- Activate and synchronize local demo role accounts from `.env` in non-production demo mode.
- Expand Department Officer and Legal Officer permissions to match their operational workflow responsibilities.
- Preserve production boundary: no government identity claim, no synthetic data promotion, no production ML promotion.

## GIS trust boundary
Coordinates must fall within the India GIS integrity envelope (6.0–38.5 N, 68.0–98.5 E). Invalid points are withheld rather than silently plotted. Parcel geometry remains spatially authoritative when present.

## Local demo credentials
These credentials are for the local SIH/demo deployment only. Replace them before any shared or production deployment.

- Administrator: `admin@bhoomidrishti.local` / `<local admin password>`
- Government Officer: `government.officer@bhoomidrishti.local` / `<local government-officer password>`
- Department Officer: `department.officer@bhoomidrishti.local` / `<local department-officer password>`
- Legal Officer: `legal.officer@bhoomidrishti.local` / `<local legal-officer password>`
- Viewer: `viewer@bhoomidrishti.local` / `<local viewer password>`

## Operational roles
- Administrator — full administration, access/security, audit, integrations and governance.
- Government Officer — project oversight, risk prioritisation, workflow actions and escalations within assigned jurisdiction.
- Department Officer — assigned project editing, document verification, operational actions and workflow.
- Legal Officer — legal/dispute review, evidence/document verification and legal workflow actions within assigned scope.
- Viewer — read-only dashboards, project intelligence, maps, history and reports.

## Repair command
After extracting U65 and stopping the old stack, run `npm.cmd run repair:local-access` once if you want an explicit local access/GIS repair before starting the stack.
