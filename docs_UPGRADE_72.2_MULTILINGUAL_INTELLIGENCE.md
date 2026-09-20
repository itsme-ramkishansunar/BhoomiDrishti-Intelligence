# U72.2 — Multilingual Land-Acquisition Intelligence

## Baseline safety

U71.10/U72.1 working architecture remains intact. U72.2 is additive: no SQLite migration, no replacement of React/Vite, Express, authentication/RBAC, GIS, predictive governance, or existing working models.

## India-wide language architecture

The intake analyzer now carries language/script evidence for the 22 Eighth Schedule languages used by the product language layer: Assamese, Bengali, Bodo, Dogri, Gujarati, Hindi, Kannada, Kashmiri, Konkani, Maithili, Malayalam, Manipuri, Marathi, Nepali, Odia, Punjabi, Sanskrit, Santali, Sindhi, Tamil, Telugu and Urdu.

Language detection is evidence-based and conservative. Shared Devanagari vocabulary is not treated as proof of a specific language. Source text is preserved; the system does not silently translate or rewrite legal evidence.

## Extraction upgrades

- multilingual project/state/district/village/acquisition-type extraction
- Indian land-acquisition legal terminology and notification sections 11/19/21/23
- court/case references, parcel/group/survey/khasra identifiers
- compensation and R&R evidence signals
- field-level provenance and confidence
- candidate evidence graph edges for projects, parcels, legal references and compensation references
- stronger document classification across award, notification, declaration, notice, compensation, court, R&R, possession, land-record and project-report classes
- OCR language selection across installed Indian language packs, with `BHOOMI_OCR_LANGS` override

## Governance

Everything remains candidate evidence until human verification and provenance authorization. No OCR/classification/extraction result becomes authoritative government data automatically. No production ML probability is generated or promoted by U72.2.

## Regression boundary

The existing U72.1 smoke remains required. U72.2 adds a deterministic multilingual smoke using English, Hindi, Marathi, Tamil and Bengali evidence snippets.
