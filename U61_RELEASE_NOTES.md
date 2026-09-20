# BHOOMIDHRISHTI U61 — Operational Workspace

U61 is an additive frontend/workspace upgrade on the validated U60.3 baseline.

## Included
- Global Ctrl+K command palette for page/project navigation.
- Workspace context/status bar with repository refresh time.
- Project decision snapshot on project detail pages.
- Alert summary and direct project drill-through where a matching project is available.
- Responsive/reduced-motion support for the new workspace layer.
- Vite manual chunking for React, charts, icons, mapping and CSV parser dependencies.
- Static U61 workspace smoke contract.

## Safety boundary
No database migrations, SQLite schema changes, risk-engine changes, predictive-engine changes, GIS business logic changes, AI backend changes, RBAC changes, or API contract changes are introduced by U61.

The shared persistent store remains external to the release folder and is not included in this package.

## Verification
On Windows:

    npm.cmd install --no-audit --no-fund
    npm.cmd run smoke:u61-workspace
    npm.cmd run build
    npm.cmd run validate:all

Then:

    npm.cmd run start:all
