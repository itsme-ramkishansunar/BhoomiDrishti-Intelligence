import { INDIA_LANGUAGE_PROFILES, detectLanguageProfile } from '../backend/domain/multilingual-intelligence.js';
import { languageIntegrityReport } from '../backend/domain/language-integrity.js';

const checks=[];
function check(name,ok,detail=''){checks.push({name,ok,detail});}
check('22 scheduled-language profiles',INDIA_LANGUAGE_PROFILES.length===22 && new Set(INDIA_LANGUAGE_PROFILES.map(x=>x.code)).size===22,`count=${INDIA_LANGUAGE_PROFILES.length}`);
check('unique language codes',new Set(INDIA_LANGUAGE_PROFILES.map(x=>x.code)).size===22);
check('all profiles have names and scripts',INDIA_LANGUAGE_PROFILES.every(x=>x.name && Array.isArray(x.scripts) && x.scripts.length>0));
for(const profile of INDIA_LANGUAGE_PROFILES){ const sample=profile.terms.slice(0,Math.min(3,profile.terms.length)).join(' '); const detected=detectLanguageProfile(sample).primary?.code; check(`language detection ${profile.code}`,detected===profile.code,`detected=${detected||'und'}`); }
check('Unicode normalization preserves content meaningfully',detectLanguageProfile('मराठी भूसंपादन').primary?.code==='mr');
check('Hindi detection',detectLanguageProfile('भूमि अधिग्रहण मुआवजा न्यायालय').primary?.code==='hi');
check('Tamil detection',detectLanguageProfile('நிலம் கையகப்படுத்தல் இழப்பீடு நீதிமன்றம்').primary?.code==='ta');
check('Gujarati detection',detectLanguageProfile('જમીન સંપાદન વળતર કોર્ટ').primary?.code==='gu');
check('Bengali detection',detectLanguageProfile('ভূমি অধিগ্রহণ ক্ষতিপূরণ আদালত').primary?.code==='bn');
const mixed=languageIntegrityReport('मराठी भूसंपादन न्यायालय\nभूमि अधिग्रहण न्यायालय');
check('mixed language routes to review',mixed.requiresHumanReview===true,mixed.reasons.join(','));
const safe=languageIntegrityReport('Maharashtra land acquisition award compensation court');
check('confident source remains un-translated',safe.translationApplied===false && safe.legalInterpretationApplied===false && safe.sourcePreserved===true);
check('person/place names are never auto-translated',safe.personOrPlaceNameAutoTranslated===false);
check('integrity registry supported',safe.supported===true);
const result={ok:checks.every(x=>x.ok),version:'U73',checks:checks.length,failed:checks.filter(x=>!x.ok),details:checks};
console.log(JSON.stringify(result,null,2));
if(!result.ok)process.exit(1);
