# U54.1 — Unified Persistent + GIS Runtime Stable

## Corrective release
U54.1 keeps the U54 shared repository + precise GIS architecture and fixes the validation/runtime boundary found during Windows testing.

## Fixes
- Temporary validation databases explicitly force isolated storage and can never reuse the user's shared repository.
- Administrator bootstrap handles legacy `USR-ADMIN-001` collisions without mutating an existing account.
- Demo-account bootstrap handles legacy user-ID collisions without destructive updates.
- Runtime smoke labels no longer refer to an older upgrade generation.
- Validation isolation is itself regression-tested.
- Windows installation runs persistence/GIS/isolation sanity checks before full validation and performs a final persistent-store verification before startup.

## Product continuity
- U51 unified persistent data/evidence backbone remains the canonical data layer.
- U52 precise GIS rules remain: geometry > project point > geocoded place; unresolved projects are not plotted; demo district points remain approximate.
- U53 shared persistent repository remains outside application release folders.
- BHOOMIDHRISHTI continues to operate as a decision-support and intelligence layer, not as a replacement for authoritative government systems.

## ML governance
Production delay ML remains gated until authorised historical data, temporal/as-of controls, leakage audit, calibration/OOD evidence, and governance approval are satisfied.
