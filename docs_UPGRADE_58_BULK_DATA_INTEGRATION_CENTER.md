# U58 — Bulk Data Integration Center

U58 is additive on U57/U56.3. It adds a governed frontend for the existing dataset-ingestion pipeline, recent ingestion ledger, provenance boundary, and public connector health.

## Safety
- No SQLite schema changes.
- No second source of truth.
- No automatic model training or promotion.
- Uploaded data remains unverified until provenance is explicitly established.
- Existing `/api/data-ingestion/upload` forensic analysis is reused.

## User workflow
1. Open **Data Integration**.
2. Upload CSV/TSV/JSON/NDJSON/XLSX.
3. Backend hashes and stores the file in the persistent incoming directory.
4. Existing data-forensics pipeline analyses structure.
5. Review status/hash/provenance before any future ML training gate.
