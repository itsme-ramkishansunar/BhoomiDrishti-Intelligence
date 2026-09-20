BHOOMIDHRISTI Security Development Note

This build establishes server-side authentication/authorization and persistent audit records. It is not a production accreditation or security certification.

Before handling restricted government data, the deployment must be reviewed against the competent authority's security requirements, approved infrastructure/network controls, identity provider, logging/monitoring, backup and recovery, data classification, retention, privacy and incident-response obligations.

Current development controls:
- HttpOnly session cookie.
- SameSite cookie policy.
- Helmet security headers.
- CORS allowlist.
- Request rate limit.
- Password hashing with scrypt in the local development store.
- Backend permission gates.
- Transactional access provisioning.
- Audit event persistence.
- No external AI call is required for the local evidence engine.

CERT-In Directions and the Digital Personal Data Protection framework should be reviewed with the deployment authority/legal team for the actual hosting and data-processing context; this project does not by itself establish legal compliance.


## Upgrade 28 subprocess hardening
`validate:all` uses a Node executable plus the active npm CLI path when available and sets `shell: false`; it does not interpolate untrusted input into a shell command.
