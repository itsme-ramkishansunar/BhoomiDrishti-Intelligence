# BHOOMIDHRISHTI Upgrade 40 — Real Core + Portable Deployment

This checkpoint is a new copy of Upgrade 39. It adds self-service dataset ingestion and forensic analysis, a persisted ingestion ledger, optional single-origin production serving, Docker packaging, and portability/ingestion validation. It does not change the SIH26017 prediction gate: the candidate predictive engine remains NOT_VALIDATED until the actual authorized historical dataset is forensically inspected and supports defensible temporal labels, leakage-safe features, and evaluation.

No government source is automatically promoted to authoritative status. Uploaded datasets remain USER_UPLOADED / NOT_GOVERNMENT_VERIFIED until provenance is established.

The release also fixes the local-only AI conversation persistence branch so it never references an undefined provider result.
