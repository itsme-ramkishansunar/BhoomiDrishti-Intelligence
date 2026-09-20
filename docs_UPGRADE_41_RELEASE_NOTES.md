# Upgrade 41 — Intelligence Foundation

New checkpoint built from Upgrade 40 without mutating the previous checkpoint.

## Purpose
Move BHOOMIDHRISHTI faster toward the SIH26017 intelligence core while preserving evidence-first, temporal, provenance and non-fabrication constraints.

## Changes
- Expanded dataset forensics to produce a richer structural dataset profile.
- Added prediction-grain candidates, repeat-observation profile, temporal coverage summary, numeric/categorical profiling, candidate feature/target columns and explicit leakage-review fields.
- Added a model-training gate in the forensic output: structural analysis never authorizes model training by itself.
- Advanced forensic report schema from 1.0 to 1.1.
- Added `smoke:forensics-depth`.
- Fixed portability smoke test false-positive caused by the portability test scanning its own Windows-path detection patterns.
- Kept all existing source connectors, ingestion ledger, project intake, entity resolution, canonical project, temporal reconciliation, legal/workflow, AI and predictive-readiness foundations intact.

## Deliberate non-changes
- No fake government API connectivity.
- No automatic model training or promotion.
- No synthetic data presented as official data.
- No final SIH26017 target/model/accuracy is invented before the actual dataset is inspected and temporally validated.
