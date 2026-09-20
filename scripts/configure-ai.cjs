const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
if (!fs.existsSync(envPath)) {
  console.error('.env was not found. Copy your local .env into the project first.');
  process.exit(1);
}

let text = fs.readFileSync(envPath, 'utf8');
const updates = {
  AI_PROVIDER: 'gemini',
  AI_MODEL: 'gemini-3.8-flash',
  AI_FALLBACK_MODELS: 'gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash',
  GEMINI_API_VERSION: 'v1',
  AI_THINKING_LEVEL: 'low',
  AI_MAX_OUTPUT_TOKENS: '1400',
  AI_PROVIDER_TIMEOUT_MS: '5000',
  AI_PROVIDER_TOTAL_BUDGET_MS: '9000',
  AI_PROVIDER_FAILURE_COOLDOWN_MS: '60000',
  AI_DATA_MODE: 'external_allowed',
  AI_LOCAL_FIRST: 'true',
};

for (const [key, value] of Object.entries(updates)) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  text = pattern.test(text) ? text.replace(pattern, line) : `${text.trimEnd()}\n${line}\n`;
}
fs.writeFileSync(envPath, text.replace(/\r?\n/g, '\r\n'), 'utf8');
console.log('AI configuration updated: Gemini Interactions API v1, gemini-3.8-flash primary, current Flash fallbacks, low thinking. API keys were not displayed or changed.');
