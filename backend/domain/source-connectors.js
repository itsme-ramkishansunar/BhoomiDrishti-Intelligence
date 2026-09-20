import crypto from 'node:crypto';

export const SOURCE_CONNECTOR_VERSION = 'source-connectors-v1';
const MAX_BODY_BYTES = 2 * 1024 * 1024;

export const PUBLIC_CONNECTOR_CATALOG = [
  { id:'public-lacrris', name:'LACRRIS public land-acquisition reporting', sourceType:'government', accessMode:'PUBLIC', url:'https://larr.dolr.gov.in/faces/public/projectwise.xhtml', owner:'Department of Land Resources', scope:'Public project-wise land-acquisition reporting / discovery', parser:'html_metadata' },
  { id:'public-paimana', name:'PAIMANA public infrastructure monitoring', sourceType:'government', accessMode:'PUBLIC', url:'https://ipm.mospi.gov.in/Home/PublicDashboard', owner:'MoSPI', scope:'Public project monitoring and aggregate download discovery', parser:'html_metadata' },

  { id:'public-bhoomi-rashi-home', name:'Bhoomi Rashi public portal', sourceType:'government', accessMode:'PUBLIC', url:'https://bhoomirashi.gov.in/', owner:'MoRTH', scope:'Public portal snapshot / discovery', parser:'html_metadata' },
  { id:'public-dilrmp-ulpin-state', name:'DILRMP ULPIN / map status', sourceType:'government', accessMode:'PUBLIC', url:'https://dilrmp.gov.in/dilrmpold/MapULPIN/MapDiditizaionStateList', owner:'Department of Land Resources', scope:'Public status table snapshot / discovery', parser:'html_table_summary' },
  { id:'public-parivesh-home', name:'PARIVESH public portal', sourceType:'government', accessMode:'PUBLIC', url:'https://parivesh.nic.in/', owner:'MoEFCC', scope:'Public portal snapshot / contextual clearance discovery', parser:'html_metadata' },
  { id:'public-datagov-home', name:'Open Government Data Platform', sourceType:'open_data', accessMode:'PUBLIC', url:'https://www.data.gov.in/', owner:'Government of India', scope:'Public dataset discovery', parser:'html_metadata' },
];

function sha256(value){ return crypto.createHash('sha256').update(value).digest('hex'); }
function normaliseText(value){ return String(value || '').replace(/\s+/g,' ').trim(); }

function extractHtmlMetadata(body) {
  const title = normaliseText((body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/<[^>]+>/g,' '));
  const headings = [...body.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].slice(0,12).map(m => normaliseText(m[1].replace(/<[^>]+>/g,' '))).filter(Boolean);
  return { parser:'html_metadata', title, headings, textSample: normaliseText(body.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')).slice(0,1800) };
}

function extractTableSummary(body) {
  const tables = [...body.matchAll(/<table[\s\S]*?<\/table>/gi)].slice(0,8);
  const rows = [];
  for (const table of tables) {
    const trs = [...table[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].slice(0,8);
    for (const tr of trs) {
      const cells = [...tr[0].matchAll(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map(m=>normaliseText(m[1].replace(/<[^>]+>/g,' '))).filter(Boolean);
      if (cells.length) rows.push(cells.slice(0,24));
    }
  }
  return { parser:'html_table_summary', tableCount:tables.length, rows:rows.slice(0,32) };
}

export async function fetchPublicConnector(connector, { fetchImpl = globalThis.fetch, timeoutMs = 25000 } = {}) {
  if (!connector?.url) throw new Error('Connector URL is required.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    let response;
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await fetchImpl(connector.url, {
          method:'GET',
          redirect:'follow',
          cache:'no-store',
          headers:{
            'User-Agent':'BHOOMIDHRISHTI-public-source-monitor/1.1',
            'Accept':'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.7',
            'Cache-Control':'no-cache',
          },
          signal:controller.signal,
        });
        break;
      } catch (e) {
        lastError = e;
        if (attempt === 0 && e?.name !== 'AbortError') {
          await new Promise(resolve => setTimeout(resolve, 350));
          continue;
        }
        throw e;
      }
    }
    if (!response) throw lastError || new Error('No response received from source.');
    const body = await response.text();
    if (Buffer.byteLength(body,'utf8') > MAX_BODY_BYTES) throw new Error('Source response exceeds safe snapshot limit.');
    const extracted = connector.parser === 'html_table_summary' ? extractTableSummary(body) : extractHtmlMetadata(body);
    return {
      connectorId:connector.id,
      url:connector.url,
      fetchedAt:new Date().toISOString(),
      durationMs:Date.now()-started,
      httpStatus:response.status,
      ok:response.ok,
      contentType:response.headers.get('content-type') || null,
      etag:response.headers.get('etag') || null,
      lastModified:response.headers.get('last-modified') || null,
      bodyBytes:Buffer.byteLength(body,'utf8'),
      bodySha256:sha256(body),
      parser:extracted.parser,
      extracted,
      note: 'Public-source snapshot only. Parsed values are NOT automatically authoritative project records.'
    };
  } finally { clearTimeout(timer); }
}

export function buildConnectorHealth(snapshot) {
  if (!snapshot) return 'never_synced';
  if (!snapshot.ok) return 'error';
  const ageMs = Date.now() - new Date(snapshot.fetchedAt).getTime();
  if (ageMs < 24*60*60*1000) return 'healthy';
  if (ageMs < 7*24*60*60*1000) return 'stale';
  return 'very_stale';
}
