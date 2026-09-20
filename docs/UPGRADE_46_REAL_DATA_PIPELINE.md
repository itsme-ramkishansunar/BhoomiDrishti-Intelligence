# Upgrade 46 — Real SIH26017 Data Pipeline

Upgrade 46 adds a controlled, source-agnostic dataset readiness pipeline for the actual SIH26017-compatible data supplied by an authorized source.

## Pipeline

```text
authorized files
    ↓
immutable file manifest + SHA-256
    ↓
format/sheet inspection
    ↓
column/type/missingness profiling
    ↓
canonical-field suggestions
    ↓
project-grain assessment
    ↓
temporal-field candidates
    ↓
outcome/label candidates
    ↓
readiness gates
    ↓
ONLY AFTER HUMAN/SOURCE VALIDATION
training dataset construction
```

## Supported inputs

CSV, TSV, JSON, NDJSON and XLSX.

## Safety gates

The U46 pipeline does not train, evaluate or promote a model. It does not choose the final delay target from column-name heuristics. Ongoing cases whose future outcome is unknown remain unsuitable for automatic negative labels; right-censoring must be handled during temporal dataset construction. All candidate labels require source-document confirmation.

## Canonical semantic fields

`config/sih26017-canonical-schema.json` defines aliases for project identity, geography, land scale, affected families, compensation, approvals, documentation, legal exposure, R&R, possession, stage/status and temporal/outcome fields. The aliases are suggestions, not authoritative mappings.

## Output

The pipeline writes JSON and Markdown readiness artifacts under `backend/data/forensics/`. It also writes `SIH26017_DATA_READINESS_LATEST.json` and `.md` for deterministic retrieval by later stages.

## Real-data command

```text
npm.cmd run data:sih26017
```

Or explicitly:

```text
npm.cmd run data:sih26017 -- --input="backend/data/incoming" --output="backend/data/forensics"
```

No model is trained or promoted by this command.
