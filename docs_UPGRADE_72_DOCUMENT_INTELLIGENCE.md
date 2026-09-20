# U72.1 — Document Intelligence Adapter

## Safety boundary

U71.10 remains the baseline. This release adds an isolated document-processing adapter. It does not replace the React/Vite frontend, Express backend, SQLite store, authentication/RBAC, GIS stack, predictive governance or project workflow.

## Added

- PDF, DOCX, XLSX and plain-text extraction remains supported.
- PNG/JPG/JPEG/TIFF/BMP/WEBP evidence files can now enter Project Intake.
- Scanned-PDF OCR is attempted only when embedded PDF text is insufficient.
- Image OCR is supported when Tesseract is available.
- Optional `.venv-u72-ocr` keeps OCR dependencies isolated from the main Node environment.
- Per-document parser/OCR metadata is returned as provenance.
- Deterministic document classification is candidate-only.
- Duplicate detection uses uploaded SHA-256 or normalized-text identity.
- Low-confidence classification, duplicate documents and low-text extraction are routed to a human-review queue.
- Canonical project facts are never automatically overwritten.

## Source adaptation

The implementation adapts the useful ideas identified in the `land-records-digitization` repository: confidence-triggered OCR fallback, preprocessing/OCR separation, document classification and human review. Its database, seed data and model claims are not imported.

The existing BHOOMIDHRISHTI intake analyzer remains the authoritative integration point for field extraction, evidence coverage, consistency checks, entity resolution and candidate intelligence.

## Setup

Optional:

```powershell
.\INSTALL_U72_DOCUMENT_INTELLIGENCE_WINDOWS.ps1
```

If Tesseract is not installed, ordinary digital PDFs/DOCX/XLSX/text files continue to work. Scanned documents fail safely with an explicit extraction/OCR message rather than becoming unverified project facts.

## Governance

OCR output is user-uploaded evidence until provenance is verified. OCR/classification confidence is not a delay probability. Production ML promotion remains governed by the existing historical-outcome gates.
