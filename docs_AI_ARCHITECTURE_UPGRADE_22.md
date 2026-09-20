# BHOOMIDHRISTI AI Architecture — Upgrade 22

## Speed-first, provider-resilient decision support

The AI route is local-first by default. The deterministic evidence engine answers from the authorised project repository without waiting on an external provider. Gemini remains available as an opt-in provider path when `AI_LOCAL_FIRST=false` and `AI_DATA_MODE=external_allowed`.

This prevents an external model outage or high-demand event from making the user interface unusable.

## Runtime

```text
User
  -> authenticated backend
  -> authorised scope
  -> evidence/context assembly
  -> local evidence answer (default, immediate)

Optional provider path:
  -> Gemini Interactions API
  -> structured response
  -> audit
  -> UI
```

## Provider resilience

- One bounded provider budget prevents serial multi-model delays.
- A short provider timeout is used for optional external calls.
- Provider failures open a temporary circuit breaker.
- No API key is exposed to the browser.
- External provider use is disabled in production unless explicitly configured.

## Grounding

The backend determines the authorised project scope. Browser-supplied project lists are not trusted as an authority source. AI responses distinguish stored observations, model outputs, recommendations, and unavailable information.
