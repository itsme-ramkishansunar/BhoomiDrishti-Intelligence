# BHOOMIDHRISTI application role matrix

These are application-level access profiles. They are not claims about official Government of India cadre names. In deployment, the identity provider and administrator map people to the authority, organisation, jurisdiction and project scopes approved by the host authority.

| Profile | Intended application capabilities | Typical scope controls |
|---|---|---|
| Administrator | Access/security, user provisioning, configuration, audit, integrations, model governance | System/deployment boundary |
| Government Officer | Portfolio oversight, risk prioritisation, intervention and escalation | Organisation + state/district + explicit project scope |
| Department Officer | Operational execution, compensation/document verification, workflow action | Department/work unit + jurisdiction + explicit project scope |
| Legal Officer | Legal/dispute review, evidence verification, history and reporting | Legal work unit + jurisdiction + explicit project scope |
| Viewer | Read-only monitoring, maps, history, reports, evidence-aware AI | Read-only jurisdiction/project scope |

## Security rule

The role selector on the sign-in page does not grant privileges. The backend determines the effective role and permissions from the authenticated user record and re-checks project scope for project APIs and project-context AI.

## Production identity

Local demo credentials are convenience accounts for development. A production deployment should use the authority's approved IAM/SSO/MFA process and should disable `BHOOMI_DEMO_ACCESS_ENABLED`.

## U72.4 portfolio-removal authority

- `projects:archive` is a separate recoverable-removal permission; it is not implied by ordinary project editing.
- Administrator: system-wide recoverable archive/restore.
- Government Officer: recoverable archive/restore within assigned jurisdiction/project scope.
- Department Officer: recoverable archive/restore within assigned scope and, when a project has `responsible_department`, only when it matches the officer's configured organisation/work unit.
- Legal Officer / Viewer: no portfolio-removal authority by default.
- Removal requires an audit reason and never physically deletes the project or its dependent evidence/history.
