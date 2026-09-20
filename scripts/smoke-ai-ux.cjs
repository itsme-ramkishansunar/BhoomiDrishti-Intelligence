const fs = require('fs');
const path = require('path');
const file = path.resolve(__dirname, '..', 'src', 'components', 'ai', 'BhoomiAIPage.jsx');
const source = fs.readFileSync(file, 'utf8');
const checks = [
  ['welcome state does not hard-code evidence coverage', !source.includes('evidenceCoverage: 0.95')],
  ['welcome state does not hard-code uncertainty', !source.includes('uncertainty: 0.05')],
  ['workspace uses responsive viewport-aware height', (source.includes("height: 'clamp(520px, 64vh, 680px)'") || source.includes("height: 'clamp(600px, 74vh, 780px)'"))],
  ['workspace keeps composer in normal flex flow', source.includes('flex-shrink-0') && source.includes('borderTop')],
  ['workspace has bounded desktop width', (source.includes('maxWidth: 1560') || source.includes('maxWidth: 1680'))],
  ['conversation content is width constrained', (source.includes('max-w-[1040px]') || source.includes('max-w-[1180px]'))],
  ['evidence block is response-gated', source.includes("m.role === 'assistant' && m.analysis && <EvidenceBlock")],
];
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('AI UX smoke failed:');
  failed.forEach(([label]) => console.error(`FAIL ${label}`));
  process.exit(1);
}
console.log('AI UX smoke passed: grounded welcome state and responsive workspace contracts are present.');
