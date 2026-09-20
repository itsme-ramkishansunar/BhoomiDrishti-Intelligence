

## U45 hardening pass — Evidence → Action completion

- Added persistent recommendation lifecycle updates (`open`, `accepted`, `declined`, `completed`).
- Added project-scope authorization checks before feedback/action/outcome mutations.
- Added observed-outcome capture and authorized verification for intervention actions.
- Learning eligibility is gated behind verified outcomes; no automatic retraining is performed from unverified records.
- Added U45 query-intelligence and action-loop smoke tests to `validate:all`.

## U45.1 patch — Query precision and evidence targeting

- Added exact-result count constraints for `top N`, numbered, and singular project requests.
- Added explicit priority-attention handling for portfolio triage queries.
- Improved singular highest-risk + evidence queries to target the selected project record.
- Added project-level driver detail and explicit unavailable evidence-coverage wording instead of inventing a percentage.
- Fixed project-name/code matching so short codes cannot accidentally match ordinary words such as `DEL` inside `delay`.
- Extended query-intelligence smoke coverage for exact counts, priority attention, and project evidence targeting.


## U45.2 — Query Constraint & Target Resolution Patch
- Explicit portfolio/ranking queries override stale UI focus.
- Highest-risk queries resolve to the actual highest stored risk project.
- Numeric/word count constraints are parsed robustly and preserved through comparison output.
- Added regression coverage for stale-focus hijacking and exact three-project comparison.

## U45.3 Query scope precision patch
- Preserves explicit comparison limits through linked/related project records.
- Prevents secondary intent handlers from leaking additional projects into the AI response context.
- Keeps highest-risk, attention, evidence-target and selected-project linked records aligned with the primary query.

## U45.3 Query scope precision patch
- Preserves explicit comparison limits through linked/related project records.
- Prevents secondary intent handlers from leaking additional projects into AI-linked records.
- Keeps highest-risk, attention, evidence-target and selected-project linked records aligned with the primary query scope.
- Added regression coverage for exact related-project scope.


## U45.4 — AI persistence and evidence-panel hardening
- Persisted `ai_messages.metadata_json` during message writes so recommendations, related projects, and evidence survive session reloads.
- Provider path now stores provider-returned analysis metadata instead of silently persisting local fallback metadata.
- Related project risk values are normalized and the frontend safely backfills missing risk values from the authorised project scope.
- Extended AI conversation smoke coverage for metadata persistence.
