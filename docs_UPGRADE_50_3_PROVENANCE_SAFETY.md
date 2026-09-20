## Validation note
Implemented after browser verification showed a `user_uploaded` project being displayed as `OFFICIAL` in evidence cards. This is corrected because the provenance classifier no longer treats every non-synthetic source as official.

# Upgrade 50.3 — Provenance Safety

## Purpose
Prevent user-uploaded or otherwise unverified project records from being displayed as official evidence.

## Change
Evidence provenance is now classified from the source label using an explicit provenance classifier.

- `synthetic_demo` → `SYNTHETIC`
- `user_uploaded` / `NOT_GOVERNMENT_VERIFIED` → `USER_UPLOADED`
- `official_api` / `official_export` / `authoritative` → `OFFICIAL`
- `derived` / `risk engine` → `DERIVED`
- `simulated` / `scenario` → `SIMULATED`
- `cached` → `CACHED`
- unknown → `UNVERIFIED`

## Safety rule
A manually created project or user-uploaded evidence record must never be labelled `OFFICIAL` merely because it is not synthetic.

## Validation
`npm run smoke:provenance` must pass, including a regression test that asserts `user_uploaded` evidence never becomes `OFFICIAL`.
