# Upgrade 42 — Hardened Intelligence

Preserves Upgrade 41 functionality while adding:

- Production-startup security guard for administrator credentials and demo access.
- Intelligence Trust domain: evidence readiness, prediction applicability, stored prediction diff.
- `/api/projects/:id/intelligence-trust` read endpoint.
- Additional system-contract and hardening smoke checks.
- Doctor false-positive exclusion for self-test scripts.
- Cross-platform portability coverage extended to the trust domain.
- Production Docker compose requires explicit administrator credentials and disables demo access.
- No predictive model is promoted; `candidate_not_validated` remains the safe state pending authorized SIH26017 outcomes.
