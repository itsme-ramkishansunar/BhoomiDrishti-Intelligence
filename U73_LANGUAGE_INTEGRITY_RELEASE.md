# U73 — National Language Integrity & Human-Safety Gate

This upgrade hardens multilingual intake for India’s 22 Schedule VIII language set already represented by the project. It does not claim that machine translation is perfect. Instead it prevents unsafe assumptions: source text remains preserved; legal/statutory language is not automatically translated or interpreted; person/place/parcel names are not automatically translated; mixed or low-confidence language evidence is routed to human verification.

## Safety contract
- 22 language profiles are registered and validated for uniqueness.
- Unicode is normalized without replacing source evidence.
- Shared scripts and mixed-language documents can trigger REVIEW.
- Operational canonical facts remain subject to existing human verification and provenance controls.
- No automatic legal conclusion is derived from a translation.
- No person/place name is silently rewritten as a translated name.

## Validation
`npm.cmd run smoke:u73-language-integrity`
