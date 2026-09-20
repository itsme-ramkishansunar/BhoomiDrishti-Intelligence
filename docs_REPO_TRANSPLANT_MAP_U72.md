# Repository Transplant Map — U72

| Source | Adapted concept | BHOOMIDHRISHTI location | Imported wholesale? |
|---|---|---|---|
| Landwatch | factor/action and evidence-oriented patterns | Existing intelligence/risk infrastructure | No |
| land-records-digitization | OCR fallback, document classification, human review | `scripts/extract-document.py` + Project Intake | No |
| SIH-2026-Prototype | document workflow/API verification concepts | Existing intake/API contracts | No |
| SIH26014 LandStack | parcel/ULPIN concepts | Deferred to U73/U76 | No |

Safety rule: isolated adapter -> tests -> existing smoke suite -> DB integrity -> UI -> release check.
