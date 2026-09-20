export const PROVENANCE_V1 = 'provenance-v1';

export function classifySourceLabel(label) {
  const raw = String(label || '').trim();
  const s = raw.toLowerCase();
  if (!raw) return 'UNVERIFIED';
  if (s.includes('synthetic')) return 'SYNTHETIC';
  if (s.includes('simulated') || s.includes('scenario')) return 'SIMULATED';
  if (s.includes('official') || s.includes('authoritative') || s.includes('official_api') || s.includes('official_export')) return 'OFFICIAL';
  if (s.includes('derived') || s.includes('risk engine') || s.includes('system derived')) return 'DERIVED';
  if (s.includes('cached')) return 'CACHED';
  if (s.includes('user_uploaded') || s.includes('user uploaded') || s.includes('not_government_verified') || s.includes('not government verified')) return 'USER_UPLOADED';
  if (s.includes('unavailable')) return 'UNAVAILABLE';
  return 'UNVERIFIED';
}
