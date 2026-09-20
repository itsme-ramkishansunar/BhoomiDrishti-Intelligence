import { INDIA_LANGUAGE_PROFILES, detectLanguageProfile, normalizeUnicode } from './multilingual-intelligence.js';

// U73: language-integrity gate. This deliberately does NOT translate legal text,
// person names, village names, survey/parcel identifiers, or statutory phrases.
// It preserves source evidence and routes ambiguity for human verification.
export const LANGUAGE_INTEGRITY_VERSION = 'language-integrity-v1';

export function languageIntegrityReport(text='') {
  const raw=String(text??'');
  const normalized=normalizeUnicode(raw);
  const profile=detectLanguageProfile(normalized);
  const uniqueCodes=new Set(INDIA_LANGUAGE_PROFILES.map(x=>x.code));
  const supported=INDIA_LANGUAGE_PROFILES.length===22 && uniqueCodes.size===22;
  const scripts=profile.scripts||[];
  const primary=profile.primary;
  const dominant=scripts[0]?.name||null;
  const primaryProfile=INDIA_LANGUAGE_PROFILES.find(x=>x.code===primary?.code)||null;
  const lineLanguages=[...new Set(normalized.split(/\n+/).map(x=>detectLanguageProfile(x).primary?.code).filter(Boolean))];
  const mixedLineEvidence=lineLanguages.length>1;
  const sharedScriptAmbiguity=!!dominant && (!primary || (primaryProfile?.scripts||[]).length===0);
  const weakLanguage=!!raw.trim() && (!primary || (primary.score||0)<3);
  const normalizationChanged=raw!==normalized;
  const sourcePreserved=true;
  const requiresHumanReview=sharedScriptAmbiguity || weakLanguage || mixedLineEvidence || (profile.multilingual && profile.languages.length>1);
  const reasons=[];
  if(weakLanguage) reasons.push('language_not_confidently_identified');
  if(sharedScriptAmbiguity) reasons.push('shared_script_requires_verification');
  if(mixedLineEvidence) reasons.push('mixed_language_lines_requires_verification');
  if(profile.multilingual && profile.languages.length>1) reasons.push('multiple_language_evidence_requires_verification');
  if(!supported) reasons.push('language_registry_integrity_failure');
  return {
    version:LANGUAGE_INTEGRITY_VERSION,
    supportedLanguageCount:INDIA_LANGUAGE_PROFILES.length,
    supported,
    primaryLanguage:primary?.code||'und',
    primaryLanguageName:primary?.name||'Undetermined',
    dominantScript:dominant||'undetermined',
    detectedLanguages:profile.languages||[],
    lineLanguages,
    scripts,
    normalizationChanged,
    sourcePreserved,
    translationApplied:false,
    legalInterpretationApplied:false,
    personOrPlaceNameAutoTranslated:false,
    requiresHumanReview,
    reasons,
    safetyStatus: supported && !requiresHumanReview ? 'PASS' : 'REVIEW'
  };
}

export function attachLanguageIntegrity(analysis) {
  const combined=analysis?.provenance?.map(x=>x?.text||'').filter(Boolean).join('\n') || analysis?.integrity?.combinedText || '';
  const report=languageIntegrityReport(combined);
  return {
    ...analysis,
    languageIntegrity:report,
    warnings:[...(analysis?.warnings||[]),
      'Language integrity gate: source text is preserved; no automatic legal translation or interpretation is applied.',
      ...(report.requiresHumanReview ? ['Language identification or mixed-language evidence requires human verification before operational use.'] : []),
    ]
  };
}
