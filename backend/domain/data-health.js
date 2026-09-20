export function buildDataHealth(sources=[], projects=[]) {
  const synthetic = projects.filter(p => String(p?.source?.label || '').toLowerCase().includes('synthetic')).length;
  const unknown = projects.filter(p => !p?.source?.label || String(p.source.label).toLowerCase()==='unspecified').length;
  return {
    generatedAt:new Date().toISOString(),
    repository:{projectCount:projects.length,syntheticProjects:synthetic,unknownProvenance:unknown},
    sources:sources.map(s=>({id:s.id,name:s.name,sourceType:s.sourceType,status:s.status,lastSyncAt:s.lastSyncAt,accessNote:s.accessNote,health:s.status==='available'?'healthy':s.status==='planned'?'planned':'attention'})),
    rules:[
      'Source records are never silently converted to zero when unavailable.',
      'Official / derived / synthetic / simulated / cached provenance must remain distinguishable.',
      'Prediction inputs require a point-in-time snapshot before production model scoring.',
    ],
  };
}
