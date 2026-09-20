# U71.1 — Local Authentication Credential Format Fix

## Root cause
The local demo passwords contain `#`. In an unquoted dotenv assignment, `#` can be interpreted as the start of a comment, so the password loaded into `process.env` could be truncated. The repair script then wrote a full password into the database while the runtime later attempted to verify the truncated environment password.

## Fix
- `.env` demo passwords are quoted.
- `repair-local-access.cjs` always quotes values written to `.env`.
- Repair now re-hashes and verifies all five local demo accounts using the exact configured credentials.
- `smoke-local-access.cjs` keeps the canonical demo-role bootstrap contract and verifies all roles.
- Added a regression smoke that rejects unquoted passwords containing `#`.
- Persistent application data is not reset or deleted.
