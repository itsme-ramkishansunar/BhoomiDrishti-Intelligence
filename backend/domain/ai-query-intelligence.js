/*
 * BHOOMIDHRISHTI U45 — Bhoomi AI query intelligence.
 *
 * Purpose:
 *   Convert short, medium, long and multi-part user questions into a
 *   deterministic, evidence-grounded answer plan before any optional
 *   external LLM is used.
 *
 * Guardrails:
 *   - Uses only authorised project records supplied by the caller.
 *   - Never invents officers, legal outcomes, statutory deadlines or
 *     unavailable evidence.
 *   - Stored risk is described as an application output, not a validated
 *     production probability.
 *   - Scenario/recommendation language is advisory, not causal evidence.
 */

const lower = (value) => String(value ?? '').toLowerCase().trim();
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function unique(values) {
  return [...new Set(values.filter(Boolean).map((v) => String(v).trim()).filter(Boolean))];
}

function projectMatches(project, query) {
  const q = lower(query);
  const tokens = q.split(/[^a-z0-9]+/).filter(Boolean);
  const tokenSet = new Set(tokens);
  const exactToken = (value) => {
    const normalized = lower(value).replace(/[^a-z0-9]+/g, '');
    return normalized.length >= 2 && tokenSet.has(normalized);
  };
  const phraseMatch = (value) => {
    const fieldTokens = lower(value).split(/[^a-z0-9]+/).filter(Boolean);
    if (!fieldTokens.length) return false;
    if (fieldTokens.length === 1 && fieldTokens[0].length <= 2) return tokenSet.has(fieldTokens[0]);
    for (let i = 0; i <= tokens.length - fieldTokens.length; i += 1) {
      if (fieldTokens.every((token, offset) => tokens[i + offset] === token)) return true;
    }
    return false;
  };
  return [project?.id, project?.code].filter(Boolean).some(exactToken)
    || [project?.name, project?.district, project?.state].filter(Boolean).some(phraseMatch);
}

function resolveProject(projects, query, focusProjectId, recentMessages = []) {
  const q = lower(query);
  const followUp = /\b(that|this|above|it|same project|the project|their|those)\b/.test(q)
    || /(what evidence supports|why is that|how do you know|explain that)/i.test(query);

  // Explicit portfolio/ranking questions must override stale UI focus.
  // This prevents a previously opened project from hijacking queries such as
  // "highest-risk project" or "top three projects".
  const portfolioTarget = /\b(highest[- ]risk|highest risk|top[- ]risk|top \d+|top (?:one|two|three|four|five|six|seven|eight|nine|ten)|highest (?:one|two|three|four|five|six|seven|eight|nine|ten)|which projects need attention|attention first|compare .*highest[- ]risk|compare .*top)\b/i.test(query)
    || (/\b(?:which|what)\b.*\b(?:highest|top|greatest|maximum|max)\b.*\brisk\b/i.test(query));
  if (!followUp) {
    const explicit = projects.find((p) => projectMatches(p, query));
    if (explicit) return explicit;
  }

  if (followUp) {
    for (const prior of [...recentMessages].reverse()) {
      const candidate = projects.find((p) => projectMatches(p, prior?.text || ''));
      if (candidate) return candidate;
    }
    if (focusProjectId) return projects.find((p) => String(p.id) === String(focusProjectId)) || null;
    return null;
  }

  if (!portfolioTarget && focusProjectId) {
    return projects.find((p) => String(p.id) === String(focusProjectId)) || null;
  }
  return null;
}

export function detectAIIntents(query) {
  const q = lower(query);
  const intents = new Set();
  if (/\b(system readiness|readiness|is the system ready|ready status|health of the system|system health)\b/.test(q)) intents.add('readiness');
  if (/\b(how many projects|number of projects|projects loaded|loaded projects|portfolio size|project count)\b/.test(q)) intents.add('count');
  if (/\b(risk|risky|riskier|riskiness|highest[- ]risk|top[- ]risk|high[- ]risk|risk ranking|risk score|risk exposure|delay risk|delayed projects|risk trajectory|early warning|warning signs?)\b/.test(q)) intents.add('risk');
  if (/\b(delay drivers?|drivers? of delay|causes? of delay|why.*delay|bottlenecks?|main factors?|contributing factors?)\b/.test(q)) intents.add('drivers');
  if (/\b(compensation|payment|famil(?:y|ies)|award amount|pending families)\b/.test(q)) intents.add('compensation');
  if (/\b(legal|court|dispute|litigation|case(?:s)?|stay|writ)\b/.test(q)) intents.add('legal');
  if (/\b(document|documentation|missing|incomplete|record gaps?|gazette|notification)\b/.test(q)) intents.add('documentation');
  if (/\b(approval|approvals|approval percentage|permission|sanction|clearance)\b/.test(q)) intents.add('approval');
  if (/\b(district|state|geographic|geographical|where|concentration|region)\b/.test(q)) intents.add('geography');
  if (/\b(evidence|supporting evidence|prove|proof|source records?|how do you know|directly supported|derived by the system|facts? vs|observed vs derived)\b/.test(q)) intents.add('evidence');
  if (/\b(uncertain|uncertainty|unknown|missing information|limitations?|caveats?|what can.t you know)\b/.test(q)) intents.add('uncertainty');
  if (/\b(compare|comparison|versus|vs\.?|side by side|contrast)\b/.test(q)) intents.add('compare');
  if (/\b(next step|next action|next actions|what should.*do|what should.*verify|recommend|recommendation|intervention|action plan|provide.*action|give.*action|priorit\w*|need attention|attention first|urgent attention|this week|next week)\b/.test(q)) intents.add('action');
  if (/\b(need attention|attention first|needs attention|priority attention|which projects should be addressed first|priorit\w*.*(?:projects|portfolio)|projects?.*(?:priorit\w*|attention))\b/.test(q)) intents.add('attention');
  if (/\b(prediction|predicted|forecast|expected additional|likelihood|probability|model output)\b/.test(q)) intents.add('prediction');
  if (/\b(exact .*officer|officer responsible|named officer|who is responsible)\b/.test(q)) intents.add('unavailable_officer');
  if (/\b(exact .*completion date|when exactly.*complete|exact completion)\b/.test(q)) intents.add('unavailable_completion');
  if (/\b(exact .*legal outcome|what will the court decide|guaranteed legal)\b/.test(q)) intents.add('unavailable_legal_outcome');
  if (/\b(which projects|projects that|show projects|list projects)\b/.test(q)) intents.add('project_list');
  if (!intents.size) intents.add('general');
  return [...intents];
}

function wordNumber(value) {
  const map = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  return map[String(value).toLowerCase()] || null;
}

function requestedLimit(query, fallback = 5) {
  const q = lower(query).replace(/[–—]/g, '-');
  if (/\b(all|every)\b/.test(q)) return Number.MAX_SAFE_INTEGER;

  const numeric = q.match(/\b(?:top|highest|first)\s*-?\s*(\d{1,2})\b/)
    || q.match(/\b(\d{1,2})\s+(?:highest(?:-risk)?|high-risk|projects?)\b/);
  if (numeric) return Math.max(1, Math.min(20, Number(numeric[1])));

  const wordMap = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const words = q.match(/\b(?:top|highest|first)\s+(?:the\s+)?(one|two|three|four|five|six|seven|eight|nine|ten)\b/)
    || q.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:highest(?:-risk)?|high-risk|projects?)\b/);
  if (words && wordMap[words[1]]) return wordMap[words[1]];

  if (/\b(?:the|a|an|single|highest[- ]risk|highest risk)\s+project\b/.test(q)
    || /\bhighest[- ]risk project\b/.test(q)) return 1;
  return fallback;
}


function driverRankingKey(query) {
  const q = lower(query);
  const patterns = [
    ['compensation', /\bcompensation|payment|famil(?:y|ies)\b/],
    ['legal', /\blegal|court|dispute|litigation|stay|writ\b/],
    ['documentation', /\bdocument(?:ation)?|missing|incomplete|record gaps?\b/],
    ['approval', /\bapproval|approvals|sanction|permission|clearance\b/],
    ['resettlement', /\bresettlement|rehabilitation|r&r\b/],
    ['administrative', /\badministrative|department(?:s)?|coordination\b/]
  ];
  if (!/\b(?:highest|top|maximum|max|greatest)\b.*\brisk\b/.test(q)) return null;
  for (const [key, rx] of patterns) if (rx.test(q)) return key;
  return null;
}

function topByDriver(projects, key, limit = 1) {
  return [...projects]
    .map((p) => {
      const driver = (p?.risk?.drivers || []).find((d) => String(d?.key || '').toLowerCase() === key || lower(d?.label).startsWith(key));
      return driver ? { project: p, value: num(driver.value), contribution: num(driver.contribution), driver } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.value - a.value || b.contribution - a.contribution || num(b.project?.risk?.overall) - num(a.project?.risk?.overall))
    .slice(0, limit);
}

function riskExplanationQuestion(query) {
  const q = lower(query);
  return /\bwhy\b.*\b(?:risk|risky|delay|delayed)\b|\b(?:risky|riskiness)\b|\bexplain\b.*\brisk\b|\bevidence\b.*\brisk\b/.test(q);
}

function portfolioMetrics(projects) {
  const ongoing = projects.filter((p) => lower(p?.status) === 'ongoing');
  const completed = projects.filter((p) => lower(p?.status) === 'completed');
  const ranked = [...ongoing].sort((a, b) => num(b?.risk?.overall) - num(a?.risk?.overall));
  const high = ranked.filter((p) => lower(p?.risk?.band) === 'high').length;
  const medium = ranked.filter((p) => lower(p?.risk?.band) === 'medium').length;
  const low = ranked.filter((p) => lower(p?.risk?.band) === 'low').length;
  const sums = {
    familiesPending: ongoing.reduce((s, p) => s + num(p?.familiesPending), 0),
    familiesAffected: ongoing.reduce((s, p) => s + num(p?.familiesAffected), 0),
    disputes: ongoing.reduce((s, p) => s + num(p?.disputes), 0),
    courtCases: ongoing.reduce((s, p) => s + num(p?.courtCases), 0),
    docsMissing: ongoing.reduce((s, p) => s + num(p?.docsMissing), 0),
    delaySignalTotal: ongoing.reduce((s, p) => s + num(p?.avgDelayDays), 0),
  };
  return {
    total: projects.length,
    ongoing: ongoing.length,
    completed: completed.length,
    ranked,
    high,
    medium,
    low,
    avgDelaySignal: ongoing.length ? Math.round(sums.delaySignalTotal / ongoing.length) : 0,
    ...sums,
  };
}

function riskDriverRollup(projects) {
  const ongoing = projects.filter((p) => lower(p?.status) === 'ongoing');
  const map = new Map();
  for (const p of ongoing) {
    for (const d of Array.isArray(p?.risk?.drivers) ? p.risk.drivers : []) {
      const key = String(d.key || d.label || 'unknown');
      const current = map.get(key) || { key, label: d.label || key, contribution: 0, totalValue: 0, projects: 0 };
      current.contribution += num(d.contribution);
      current.totalValue += num(d.value);
      current.projects += 1;
      map.set(key, current);
    }
  }
  return [...map.values()]
    .map((d) => ({ ...d, contribution: Number(d.contribution.toFixed(2)), averageValue: d.projects ? Math.round(d.totalValue / d.projects) : 0 }))
    .sort((a, b) => b.contribution - a.contribution);
}

function topBy(projects, selector, limit = 5) {
  return [...projects].sort((a, b) => selector(b) - selector(a)).slice(0, limit);
}

function projectRiskLine(p) {
  return `${p.name} — ${num(p?.risk?.overall)}/100 (${p?.risk?.band || 'unclassified'})`;
}

function storedRiskCaveat() {
  return 'Stored application risk output is used here; it is not a fresh model-training run and not a validated probability guarantee.';
}

function addRelated(related, projects) {
  for (const p of projects) {
    if (!p || related.some((x) => x.id === p.id)) continue;
    const riskValue = Number.isFinite(Number(p?.risk?.overall)) ? Number(p.risk.overall) : null;
    related.push({ id: String(p.id), name: String(p.name || 'Project'), risk: riskValue, band: p?.risk?.band ?? 'unknown' });
    if (related.length >= 8) break;
  }
}

function readinessAnswer(projects, systemContext) {
  const m = portfolioMetrics(projects);
  const modelStatus = systemContext?.predictiveModelStatus || 'candidate_not_validated';
  const modelVersion = systemContext?.predictiveModelVersion || 'predictive-baseline-v1';
  const lines = [
    `Current repository readiness: ${m.total} authorised project records are available (${m.ongoing} ongoing, ${m.completed} completed).`,
    `Bhoomi AI query/evidence path is operational against the current session scope.`,
    `Stored risk outputs are available for portfolio analysis; predictive model status is ${modelStatus} (${modelVersion}).`,
    `Real-world predictive performance should not be inferred from the current stored demo risk outputs.`,
  ];
  return lines;
}

export function answerWithEvidence({ projects = [], query = '', focusProjectId = '', recentMessages = [], systemContext = {} } = {}) {
  const q = String(query || '').trim();
  const intents = detectAIIntents(q);
  const metrics = portfolioMetrics(projects);
  const selected = resolveProject(projects, q, focusProjectId, recentMessages);
  const relatedProjects = [];
  const evidence = [];
  const recommendations = [];
  const findings = [];
  const sections = [];

  const has = (intent) => intents.includes(intent);
  const multiPart = [
    'risk','drivers','compensation','legal','documentation','approval','geography','evidence','uncertainty','compare','action','prediction'
  ].filter(has).length >= 2;

  evidence.push(`Authorised scope: ${metrics.total} project records (${metrics.ongoing} ongoing, ${metrics.completed} completed).`);

  if (has('readiness')) {
    sections.push({ heading: 'System readiness', lines: readinessAnswer(projects, systemContext) });
    evidence.push('Readiness statement is derived from the current repository and application configuration, not external government system availability.');
  }

  if (has('count')) {
    sections.push({ heading: 'Portfolio count', lines: [`${metrics.total} projects are loaded: ${metrics.ongoing} ongoing and ${metrics.completed} completed.`] });
  }

  const portfolioLimit = requestedLimit(q, 5);
  const driverRanking = driverRankingKey(q);
  const driverRankTarget = driverRanking ? (topByDriver(metrics.ranked, driverRanking, 1)[0]?.project || null) : null;
  const topRisks = metrics.ranked.slice(0, Math.min(metrics.ranked.length, portfolioLimit));
  const evidenceTarget = selected || driverRankTarget || ((has('risk') && has('evidence') && portfolioLimit === 1) ? (metrics.ranked[0] || null) : null);
  if (has('risk')) {
    const riskEvidenceTarget = evidenceTarget || selected;
    const explicitSingleRiskEvidence = has('evidence') && portfolioLimit === 1 && riskEvidenceTarget;
    if (driverRankTarget) {
      const label = driverRankTarget?.risk?.drivers?.find((d) => String(d?.key || '').toLowerCase() === driverRanking)?.label || `${driverRanking} risk`;
      const driver = driverRankTarget?.risk?.drivers?.find((d) => String(d?.key || '').toLowerCase() === driverRanking);
      findings.push(`Highest ${driverRanking} risk: ${projectRiskLine(driverRankTarget)}; ${label} driver value ${num(driver?.value)}/100; contribution ${num(driver?.contribution)}.`);
      addRelated(relatedProjects, [driverRankTarget]);
    } else if (explicitSingleRiskEvidence) {
      findings.push(`Risk: ${projectRiskLine(riskEvidenceTarget)}`);
      addRelated(relatedProjects, [riskEvidenceTarget]);
    } else if (selected) {
      findings.push(`Risk: ${projectRiskLine(selected)}`);
      addRelated(relatedProjects, [selected]);
    } else if (topRisks.length) {
      findings.push(`Highest stored risk outputs: ${topRisks.map(projectRiskLine).join('; ')}`);
      addRelated(relatedProjects, topRisks);
    } else {
      findings.push('No ongoing projects are available for a stored-risk review.');
    }
    evidence.push(storedRiskCaveat());
  }

  if (has('risk') && selected && riskExplanationQuestion(q) && !has('drivers') && !has('evidence')) {
    const drivers = Array.isArray(selected?.risk?.drivers) ? selected.risk.drivers.slice(0, 5) : [];
    sections.push({ heading: `Why ${selected.name} is risky`, lines: [
      `Stored risk: ${num(selected?.risk?.overall)}/100 (${selected?.risk?.band || 'unknown'}); primary bottleneck ${selected?.risk?.bottleneck?.label || 'not recorded'}.`,
      drivers.length ? `Main stored driver signals: ${drivers.map((d) => `${d.label} ${num(d.value)}/100, contribution ${num(d.contribution)}`).join('; ')}.` : 'No stored driver decomposition is available for this project.',
      `Direct project indicators: ${num(selected.familiesPending)}/${num(selected.familiesAffected)} affected families pending compensation, ${num(selected.disputes)} disputes, ${num(selected.courtCases)} court cases, ${num(selected.docsMissing)} missing/incomplete documents, ${selected.approvalPct ?? 'not recorded'}% approval completion.`
    ] });
    evidence.push(`${selected.name}: risk explanation uses its authorised project record and stored risk decomposition.`);
    addRelated(relatedProjects, [selected]);
  }

  if (has('drivers')) {
    if (selected) {
      const drivers = Array.isArray(selected?.risk?.drivers) ? selected.risk.drivers : [];
      const lines = drivers.slice(0, 5).map((d) => `${d.label}: ${num(d.value)}/100 driver value; contribution ${num(d.contribution)}`);
      sections.push({ heading: `Delay drivers — ${selected.name}`, lines: lines.length ? lines : ['No stored driver decomposition is available for this project.'] });
      evidence.push(`${selected.name}: driver decomposition comes from the stored application risk output.`);
      addRelated(relatedProjects, [selected]);
    } else {
      const rollup = riskDriverRollup(projects).slice(0, 6);
      sections.push({ heading: 'Portfolio delay-driver rollup', lines: rollup.length
        ? rollup.map((d) => `${d.label}: ${d.projects} projects represented; average driver value ${d.averageValue}/100; aggregate contribution ${d.contribution}.`)
        : ['No stored risk-driver decomposition is available.'] });
      evidence.push('Portfolio driver rollup aggregates stored project-level risk decomposition; it does not establish causality.');
      addRelated(relatedProjects, topRisks);
    }
  }

  if (has('attention')) {
    const targets = metrics.ranked.slice(0, Math.min(metrics.ranked.length, requestedLimit(q, 3)));
    const lines = targets.length
      ? targets.map((p) => {
        const bottleneck = p?.risk?.bottleneck?.label || 'Primary bottleneck not recorded';
        const action = Array.isArray(p?.risk?.recommendedActions) && p.risk.recommendedActions[0]
          ? p.risk.recommendedActions[0]
          : `Review the ${bottleneck.replace(/ Risk$/i, '')} bottleneck and verify the source record.`;
        return `${p.name}: risk ${num(p?.risk?.overall)}/100; bottleneck ${bottleneck}; pending compensation ${num(p.familiesPending)}; missing/incomplete documents ${num(p.docsMissing)}; approval completion ${p.approvalPct ?? 'not recorded'}%; next check/action: ${action}`;
      })
      : ['No ongoing projects are available for priority review.'];
    sections.push({ heading: 'Priority attention', lines });
    recommendations.push(...targets.map((p) => Array.isArray(p?.risk?.recommendedActions) ? p.risk.recommendedActions[0] : null));
    evidence.push('Priority attention targets are selected from stored application risk outputs and current project fields; this is a decision-support signal, not a causal ranking.');
    addRelated(relatedProjects, targets);
  }

  if (has('compensation')) {
    const top = topBy(metrics.ranked.filter((p) => num(p?.familiesPending) > 0), (p) => num(p?.familiesPending));
    const lines = [`Portfolio compensation backlog: ${metrics.familiesPending.toLocaleString()} affected families currently recorded as pending across ongoing projects.`];
    lines.push(...top.slice(0, 5).map((p) => `${p.name}: ${num(p.familiesPending)} families pending; ${num(p.avgDelayDays)} day average delay signal.`));
    sections.push({ heading: 'Compensation', lines });
    evidence.push(...top.slice(0, 4).map((p) => `${p.name}: ${num(p.familiesPending)} pending families, ${num(p.avgDelayDays)} day average delay signal.`));
    recommendations.push('Review and age the outstanding compensation cases, then route verified cases through the responsible compensation workflow.');
    addRelated(relatedProjects, top);
  }

  if (has('legal')) {
    if (selected) {
      sections.push({ heading: `Legal indicators — ${selected.name}`, lines: [
        `${num(selected.disputes)} ownership disputes and ${num(selected.courtCases)} court cases are recorded.`,
        'These are descriptive project records and do not establish a legal outcome.'
      ] });
      evidence.push(`${selected.name}: legal indicators are sourced from the authorised project record.`);
      addRelated(relatedProjects, [selected]);
    } else {
      const top = metrics.ranked.filter((p) => num(p?.disputes) + num(p?.courtCases) > 0)
        .sort((a,b) => (num(b.disputes)+num(b.courtCases)) - (num(a.disputes)+num(a.courtCases))).slice(0,5);
      sections.push({ heading: 'Legal exposure indicators', lines: [
        `${metrics.disputes} ownership disputes and ${metrics.courtCases} court cases are recorded across ongoing projects.`,
        ...top.map((p) => `${p.name}: ${num(p.disputes)} disputes; ${num(p.courtCases)} court cases.`),
        'Legal indicators are descriptive records only; verify current case status and parcel linkage against an authorised legal source.'
      ] });
      recommendations.push('Verify active case status and parcel linkage against an authorised legal/court source before action.');
      addRelated(relatedProjects, top);
    }
  }

  if (has('documentation')) {
    if (selected) {
      sections.push({ heading: `Documentation — ${selected.name}`, lines: [
        `${num(selected.docsMissing)} document records are marked missing or incomplete.`,
        `Recorded approval completion: ${selected.approvalPct ?? 'not recorded'}%.`
      ] });
      evidence.push(`${selected.name}: document-gap and approval values come from its authorised project record.`);
      addRelated(relatedProjects, [selected]);
    } else {
      const top = topBy(metrics.ranked.filter((p) => num(p?.docsMissing) > 0), (p) => num(p?.docsMissing));
      sections.push({ heading: 'Documentation gaps', lines: [
        `${metrics.docsMissing.toLocaleString()} missing/incomplete document records are recorded across ongoing projects.`,
        ...top.slice(0, 5).map((p) => `${p.name}: ${num(p.docsMissing)} missing/incomplete document records.`)
      ] });
      recommendations.push('Review document checklists and verify each gap against the source record before treating it as a compliance failure.');
      addRelated(relatedProjects, top);
    }
  }

  if (has('approval')) {
    const scope = selected ? [selected] : metrics.ranked;
    const low = [...scope].sort((a,b) => num(a.approvalPct) - num(b.approvalPct)).slice(0, 5);
    sections.push({ heading: selected ? `Approvals — ${selected.name}` : 'Approval completion', lines: low.map((p) => `${p.name}: ${p.approvalPct ?? 'not recorded'}% recorded approval completion.`) });
    evidence.push('Approval completion is taken from the current project repository.');
    addRelated(relatedProjects, low);
  }

  if (has('geography')) {
    const map = new Map();
    for (const p of metrics.ranked) {
      const key = p?.district || p?.state || 'Unspecified';
      const a = map.get(key) || { key, count: 0, risk: 0 };
      a.count += 1;
      a.risk += num(p?.risk?.overall);
      map.set(key, a);
    }
    const rows = [...map.values()].map((x) => ({ ...x, avg: x.count ? Math.round(x.risk / x.count) : 0 }))
      .sort((a,b) => b.avg - a.avg).slice(0, 5);
    sections.push({ heading: 'Geographic concentration', lines: rows.map((r) => `${r.key}: ${r.avg}/100 average stored risk across ${r.count} ongoing project${r.count === 1 ? '' : 's'}.`) });
    evidence.push('Geographic concentration uses stored project risk outputs grouped by recorded district.');
  }

  if (has('evidence')) {
    if (evidenceTarget) {
      sections.push({ heading: `Evidence vs derived intelligence — ${evidenceTarget.name}`, lines: [
        `Direct record fields: project identity, stage ${evidenceTarget.stageIndex ?? 'not recorded'}, ${num(evidenceTarget.familiesPending)}/${num(evidenceTarget.familiesAffected)} affected families pending, ${num(evidenceTarget.disputes)} disputes, ${num(evidenceTarget.courtCases)} court cases, ${num(evidenceTarget.docsMissing)} missing/incomplete documents, ${evidenceTarget.approvalPct ?? 'not recorded'}% approval completion.`,
        `Stored risk output: ${num(evidenceTarget?.risk?.overall)}/100 (${evidenceTarget?.risk?.band || 'unknown'}); bottleneck ${evidenceTarget?.risk?.bottleneck?.label || 'not recorded'}.`,
        `Driver decomposition: ${Array.isArray(evidenceTarget?.risk?.drivers) && evidenceTarget.risk.drivers.length ? evidenceTarget.risk.drivers.slice(0, 5).map((d) => `${d.label} ${num(d.value)}/100, contribution ${num(d.contribution)}`).join('; ') : 'not recorded'}.`,
        `Recommended actions stored on the project: ${Array.isArray(evidenceTarget?.risk?.recommendedActions) && evidenceTarget.risk.recommendedActions.length ? evidenceTarget.risk.recommendedActions.slice(0, 4).join(' | ') : 'none recorded'}.`,
        'Project-level evidence coverage percentage is not separately recorded in this project record, so the system does not invent one.',
        'The stored risk output is not a causal finding and should not be presented as a validated probability.'
      ] });
      evidence.push(`${evidenceTarget.name}: evidence is tied to its authorised project record.`);
      addRelated(relatedProjects, [evidenceTarget]);
    } else {
      sections.push({ heading: 'Evidence vs derived intelligence', lines: [
        'Direct record evidence includes the project fields stored in the authorised repository.',
        'Derived intelligence includes stored risk scores, bands, driver contributions, aggregate portfolio totals and geographic summaries.',
        'Recommendations are advisory and should be verified against source records before action.'
      ] });
      evidence.push('Source/provenance boundaries are enforced by the local evidence engine response contract.');
    }
  }

  if (has('uncertainty')) {
    sections.push({ heading: 'Uncertainty / limitations', lines: [
      'The current session only exposes the authorised project records available to the user.',
      'Unavailable government records, named officers, unrecorded approvals, legal outcomes and exact completion dates are not inferred.',
      'Stored risk outputs are application-derived signals, not validated statistical probability guarantees.',
      'Where project-level evidence coverage is not present in the current project record, the engine does not invent a percentage.'
    ] });
    evidence.push('Uncertainty statements follow the current evidence boundary of the authorised session.');
  }

  if (has('compare')) {
    const compareLimit = requestedLimit(q, 5);
    const explicitRankingCompare = /\b(compare\b.*\b(?:highest[- ]risk|top)\b|compare\s+the\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+highest)/i.test(q);
    const compareSet = (selected && !explicitRankingCompare)
      ? [selected]
      : metrics.ranked.slice(0, Math.min(metrics.ranked.length, compareLimit));
    sections.push({ heading: 'Comparison', lines: compareSet.length
      ? compareSet.map((p) => `${p.name}: risk ${num(p?.risk?.overall)}/100; evidence coverage ${p?.evidenceCoverage ?? 'not recorded'}; bottleneck ${p?.risk?.bottleneck?.label || 'not recorded'}; pending compensation ${num(p.familiesPending)}; missing/incomplete documents ${num(p.docsMissing)}; approval completion ${p.approvalPct ?? 'not recorded'}%.`)
      : ['No project records are available for comparison.'] });
    evidence.push('Comparison uses fields available in the current authorised project records. Project-level evidence coverage is not fabricated when unavailable.');
    addRelated(relatedProjects, compareSet);
  }

  if (has('prediction')) {
    if (selected && Array.isArray(selected?.risk?.drivers)) {
      sections.push({ heading: `Prediction context — ${selected.name}`, lines: [
        `Stored risk output: ${num(selected?.risk?.overall)}/100 (${selected?.risk?.band || 'unknown'}).`,
        'A production-validated delay probability is not claimed by this local engine unless a validated model and applicable prediction record are available.',
        `Current model context: ${systemContext?.predictiveModelVersion || 'predictive-baseline-v1'} — ${systemContext?.predictiveModelStatus || 'candidate_not_validated'}.`
      ] });
      addRelated(relatedProjects, [selected]);
    } else {
      sections.push({ heading: 'Prediction context', lines: [
        `Current model context: ${systemContext?.predictiveModelVersion || 'predictive-baseline-v1'} — ${systemContext?.predictiveModelStatus || 'candidate_not_validated'}.`,
        'The current local portfolio response does not convert stored risk scores into a production probability claim.'
      ] });
      evidence.push('Prediction applicability is limited until validated historical outcomes support a production model.');
    }
  }

  if (has('action') && !has('attention')) {
    if (selected) {
      const actions = Array.isArray(selected?.risk?.recommendedActions) ? selected.risk.recommendedActions : [];
      const lines = actions.length ? actions.slice(0, 4) : ['Verify the underlying source records before assigning an intervention.'];
      const heading = /\bthis week|next week|priorit\w*/i.test(q) ? `Weekly priority actions — ${selected.name}` : `Recommended next actions — ${selected.name}`;
      sections.push({ heading, lines });
      recommendations.push(...lines);
      addRelated(relatedProjects, [selected]);
    } else {
      const weekly = /\bthis week\b|\bnext week\b|\bpriorit\w*/i.test(q);
      const targets = topRisks.slice(0, 3);
      const lines = [];
      for (const p of targets) {
        const bottleneck = p?.risk?.bottleneck?.label || 'Primary bottleneck not recorded';
        const stored = Array.isArray(p?.risk?.recommendedActions) ? p.risk.recommendedActions[0] : null;
        const action = stored || `Open ${p.name} and review its ${bottleneck.replace(/ Risk$/i, '')} bottleneck.`;
        lines.push(`${p.name}: risk ${num(p?.risk?.overall)}/100; bottleneck ${bottleneck}; next action: ${action}`);
      }
      if (!lines.length) lines.push('Review the latest authorised project records before assigning an intervention.');
      sections.push({ heading: weekly ? 'Weekly priority actions' : 'Recommended next actions', lines });
      recommendations.push(...lines);
      addRelated(relatedProjects, targets);
    }
  }

  const portfolioEarlyWarning = !selected
    && has('risk')
    && (has('evidence') || has('action') || has('uncertainty'))
    && /\bfor each\b|\beach\b.*\bproject\b|highest[- ]risk projects?/i.test(q);
  if (portfolioEarlyWarning) {
    const targets = topRisks.slice(0, Math.min(5, portfolioLimit));
    const lines = targets.map((p) => {
      const drivers = Array.isArray(p?.risk?.drivers) ? p.risk.drivers.slice(0, 3) : [];
      const driverText = drivers.length ? drivers.map((d) => `${d.label} ${num(d.value)}/100`).join(', ') : 'driver decomposition not recorded';
      const bottleneck = p?.risk?.bottleneck?.label || 'Primary bottleneck not recorded';
      const action = Array.isArray(p?.risk?.recommendedActions) && p.risk.recommendedActions[0]
        ? p.risk.recommendedActions[0]
        : `Verify the ${bottleneck.replace(/ Risk$/i, '')} bottleneck against the source record.`;
      return `${p.name}: risk ${num(p?.risk?.overall)}/100; bottleneck ${bottleneck}; key drivers ${driverText}; evidence indicators ${num(p.familiesPending)} pending families, ${num(p.disputes)} disputes, ${num(p.courtCases)} court cases, ${num(p.docsMissing)} missing/incomplete documents, ${p.approvalPct ?? 'not recorded'}% approval completion; next action ${action}`;
    });
    if (lines.length) {
      sections.push({ heading: 'Project-level early-warning detail', lines });
      evidence.push('Each project detail is derived from its authorised project record and stored risk decomposition.');
      recommendations.push(...targets.map((p) => Array.isArray(p?.risk?.recommendedActions) ? p.risk.recommendedActions[0] : null));
      addRelated(relatedProjects, targets);
    }
  }

  if (has('unavailable_officer')) {
    sections.push({ heading: 'Unavailable from current evidence', lines: ['The exact responsible government officer identity is not recorded in the project data exposed to this session, so it is not inferred.'] });
  }
  if (has('unavailable_completion')) {
    sections.push({ heading: 'Unavailable from current evidence', lines: ['An exact completion date is not established by the current authorised project records, so the system does not invent one.'] });
  }
  if (has('unavailable_legal_outcome')) {
    sections.push({ heading: 'Unavailable from current evidence', lines: ['A future or exact legal outcome cannot be determined from the current project data; recorded legal indicators remain descriptive.'] });
  }

  if (has('project_list')) addRelated(relatedProjects, selected ? [selected] : topRisks);

  if (!sections.length && findings.length) sections.push({ heading: 'Analysis', lines: findings });
  if (!sections.length) {
    sections.push({ heading: 'Bhoomi AI', lines: [
      'I can answer project and portfolio questions about risk, delay drivers, compensation, legal indicators, documentation, approvals, geography, evidence, uncertainty and next actions using the authorised records in this session.',
      'Try a specific project, a portfolio question, or a multi-part request.'
    ] });
  }
  if (findings.length) sections.unshift({ heading: 'Direct answer', lines: findings });

  // Keep linked/related records aligned with the user's primary query scope.
  // Secondary intent handlers may gather additional projects, but UI-linked
  // records must not leak beyond an explicit ranking/count constraint.
  let scopedRelatedProjects = relatedProjects;
  if (has('compare')) {
    const compareLimit = requestedLimit(q, 5);
    const explicitRankingCompare = /\b(compare\b.*\b(?:highest[- ]risk|top)\b|compare\s+the\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+highest)/i.test(q);
    const compareSet = (selected && !explicitRankingCompare)
      ? [selected]
      : metrics.ranked.slice(0, Math.min(metrics.ranked.length, compareLimit));
    scopedRelatedProjects = compareSet;
  } else if (has('attention')) {
    scopedRelatedProjects = metrics.ranked.slice(0, Math.min(metrics.ranked.length, requestedLimit(q, 3)));
  } else if (has('evidence') && evidenceTarget) {
    scopedRelatedProjects = [evidenceTarget];
  } else if (has('risk')) {
    scopedRelatedProjects = selected ? [selected] : topRisks;
  } else if (selected) {
    scopedRelatedProjects = [selected];
  }

  // Remove repeated section lines while preserving order.
  const seen = new Set();
  const cleanSections = sections.map((section) => ({
    heading: section.heading,
    lines: section.lines.filter((line) => {
      const key = String(line);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
  })).filter((s) => s.lines.length);

  const textParts = [];
  for (const section of cleanSections) {
    textParts.push(`${section.heading}\n${section.lines.map((line, i) => `${i + 1}. ${line}`).join('\n')}`);
  }
  if (multiPart) {
    textParts.push('Interpretation note\nThe response combines independently evaluated dimensions from the authorised records; derived risk outputs are not presented as causal findings or validated probabilities.');
  }

  const directCount = cleanSections.reduce((n, s) => n + s.lines.length, 0);
  const confidence = clamp(Number((0.74 + Math.min(0.14, directCount * 0.01)).toFixed(2)), 0, 0.90);

  return {
    text: textParts.join('\n\n'),
    evidence: unique(evidence).slice(0, 12),
    recommendations: unique(recommendations).slice(0, 8),
    relatedProjects: scopedRelatedProjects.slice(0, 8),
    confidence,
    evidenceCoverage: confidence,
    dataCompleteness: confidence,
    uncertainty: Number((1 - confidence).toFixed(2)),
    applicability: 'configured',
    mode: 'local-evidence-engine',
    intents,
    selectedProjectId: selected?.id || null,
    queryPlan: {
      intents,
      selectedProjectId: selected?.id || null,
      multiPart,
      requestedLimit: Number.isSafeInteger(portfolioLimit) ? portfolioLimit : 'all',
      evidenceBound: true,
    },
  };
}
