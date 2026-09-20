# BHOOMIDHRISTI AI Architecture — Upgrade 21

Upgrade 21 moves the Gemini integration to the stable Gemini Interactions API (`v1`) and current Flash model family. Google documents Interactions as the default interface for new Gemini applications and documents `gemini-3.8-flash` as a current Flash model.

## Runtime path

```text
User
  -> authenticated BHOOMIDHRISTI backend
  -> jurisdiction/project authorization
  -> evidence/context assembly
  -> Gemini Interactions API
  -> structured JSON response
  -> response normalization
  -> audit event
  -> UI
```

## Latency and resilience

- Low thinking level is used by default to reduce unnecessary latency.
- A provider timeout stops serial model attempts and immediately allows the local evidence engine fallback.
- 404/5xx/429-class provider failures may try the next configured current model.
- No browser API key is used.
- `store=false` is sent so the provider is not asked to retain the interaction for later retrieval.

## Grounding boundary

The model receives only the authorised project context selected by the backend. The frontend-supplied project list is not treated as an authority source. The AI is instructed to distinguish recorded evidence from recommendations and to state when information is unavailable.

## Current defaults

- Primary: `gemini-3.8-flash`
- Fallbacks: `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash`
- API: `v1/interactions`
- Thinking level: `low`
- Structured response: JSON schema
