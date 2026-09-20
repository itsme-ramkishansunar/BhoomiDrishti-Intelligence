const DAY_MS = 86400000;

export const LEGAL_CLOCK_DEFINITIONS = {
  NH_3A_TO_3D: {
    code: 'NH_3A_TO_3D',
    workflow: 'NH_ACQUISITION_V1',
    label: '3A publication → 3D declaration',
    clockType: 'STATUTORY',
    durationDays: 365,
    triggerEvent: 'NH_3A_PUBLICATION',
    completionEvent: 'NH_3D_DECLARATION',
    pauseEvents: ['COURT_STAY_STARTED'],
    resumeEvents: ['COURT_STAY_ENDED'],
    sourceSection: 'National Highways Act, 1956 — section 3D(3)',
    sourceUrl: 'https://upload.indiacode.nic.in/view-casepdf?id=AC_CEN_30_42_00002_195648_1517807321068&type=act',
    note: 'The statutory period excludes periods during which action/proceedings pursuant to section 3A are stayed by a court.'
  },
  NH_3H_TO_3E: {
    code: 'NH_3H_TO_3E',
    workflow: 'NH_ACQUISITION_V1',
    label: '3E possession notice → surrender window',
    clockType: 'STATUTORY_NOTICE',
    durationDays: 60,
    triggerEvent: 'NH_3E_NOTICE_SERVED',
    completionEvent: 'NH_3E_POSSESSION',
    pauseEvents: [],
    resumeEvents: [],
    sourceSection: 'National Highways Act, 1956 — section 3E(1)',
    sourceUrl: 'https://upload.indiacode.nic.in/view-casepdf?id=AC_CEN_30_42_00002_195648_1517807321068&type=act',
    note: 'The sixty-day period is tied to service of the possession notice; it is not a generic project deadline.'
  },
  RF_19_TO_25: {
    code: 'RF_19_TO_25',
    workflow: 'RFCTLARR_CENTRAL_V1',
    label: 'section 19 declaration publication → award',
    clockType: 'STATUTORY',
    durationDays: 365,
    triggerEvent: 'RF_19_DECLARATION_PUBLICATION',
    completionEvent: 'RF_23_AWARD',
    pauseEvents: [],
    resumeEvents: [],
    sourceSection: 'RFCTLARR Act, 2013 — section 25',
    sourceUrl: 'https://www.indiacode.nic.in/handle/123456789/17043',
    note: 'The Act specifies a twelve-month period from publication of the declaration, subject to the statutory extension mechanism.'
  }
};

function toDate(value) {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

function elapsedDays(start, end) {
  return start && end ? Math.max(0, (end.getTime() - start.getTime()) / DAY_MS) : null;
}

function sumPausedDays(events = [], start, end) {
  if (!start || !end) return 0;
  const pauses = [];
  const open = new Map();
  for (const ev of events) {
    const type = ev.eventCode || ev.eventType;
    const at = toDate(ev.occurredAt || ev.occurred_at);
    if (!at) continue;
    if (type === 'COURT_STAY_STARTED') open.set(ev.id || `${type}-${at.toISOString()}`, at);
    if (type === 'COURT_STAY_ENDED') {
      const firstKey = [...open.keys()][0];
      if (firstKey) {
        const s = open.get(firstKey);
        open.delete(firstKey);
        pauses.push([s, at]);
      }
    }
  }
  for (const s of open.values()) pauses.push([s, end]);
  return pauses.reduce((sum, [s, e]) => {
    const lo = s > start ? s : start;
    const hi = e < end ? e : end;
    return sum + Math.max(0, elapsedDays(lo, hi));
  }, 0);
}

function findEvent(events, code) {
  return [...events]
    .map(ev => ({ ...ev, _d: toDate(ev.occurredAt || ev.occurred_at) }))
    .filter(ev => ev._d && (ev.eventCode || ev.event_code || ev.eventType || ev.event_type) === code)
    .sort((a, b) => b._d - a._d)[0] || null;
}

export function evaluateLegalClocks({ workflowCode, events = [], asOf = new Date() }) {
  const applicable = Object.values(LEGAL_CLOCK_DEFINITIONS).filter(r => r.workflow === workflowCode);
  const now = toDate(asOf) || new Date();
  return applicable.map(rule => {
    const startEvent = findEvent(events, rule.triggerEvent);
    const endEvent = findEvent(events, rule.completionEvent);
    if (!startEvent) {
      return {
        ...rule,
        status: 'AWAITING_TRIGGER',
        startAt: null,
        endAt: null,
        elapsedDays: null,
        pausedDays: 0,
        effectiveElapsedDays: null,
        remainingDays: null,
        deadlineAt: null,
        breached: false,
        source: rule.sourceSection
      };
    }
    const start = startEvent._d;
    const end = endEvent?._d || now;
    const pausedDays = rule.pauseEvents.length ? sumPausedDays(events, start, end) : 0;
    const calendarElapsed = elapsedDays(start, end) || 0;
    const effectiveElapsedDays = Math.max(0, calendarElapsed - pausedDays);
    const deadlineAt = new Date(start.getTime() + rule.durationDays * DAY_MS + pausedDays * DAY_MS);
    const completed = Boolean(endEvent);
    const breached = !completed && effectiveElapsedDays > rule.durationDays;
    return {
      ...rule,
      status: completed ? 'COMPLETED' : breached ? 'BREACHED' : 'ACTIVE',
      startAt: start.toISOString(),
      endAt: endEvent ? endEvent._d.toISOString() : null,
      elapsedDays: Math.round(calendarElapsed),
      pausedDays: Math.round(pausedDays),
      effectiveElapsedDays: Math.round(effectiveElapsedDays),
      remainingDays: completed ? 0 : Math.max(0, Math.ceil(rule.durationDays - effectiveElapsedDays)),
      deadlineAt: deadlineAt.toISOString(),
      breached,
      source: rule.sourceSection
    };
  });
}

export function workflowHealth(clocks = []) {
  if (!clocks.length) return { status: 'UNRESOLVED', breached: 0, active: 0, awaitingTrigger: 0 };
  const breached = clocks.filter(c => c.breached).length;
  const active = clocks.filter(c => c.status === 'ACTIVE').length;
  const awaitingTrigger = clocks.filter(c => c.status === 'AWAITING_TRIGGER').length;
  return {
    status: breached ? 'BREACHED' : active ? 'ACTIVE' : awaitingTrigger ? 'AWAITING_TRIGGER' : 'OK',
    breached,
    active,
    awaitingTrigger
  };
}

export function buildWorkflowState({ project, workflow, events = [] }) {
  const ordered = Array.isArray(workflow?.stages) ? workflow.stages : [];
  const currentIndex = Math.max(0, Number(project?.stageIndex || 0));
  const current = ordered[Math.min(currentIndex, Math.max(0, ordered.length - 1))] || null;
  const completed = ordered.slice(0, currentIndex).map(s => s.code);
  const clocks = evaluateLegalClocks({ workflowCode: workflow?.code, events });
  return {
    workflowCode: workflow?.code || 'UNRESOLVED',
    workflowLabel: workflow?.label || 'Workflow applicability unresolved',
    legalFramework: workflow?.act || null,
    currentStage: current,
    stages: ordered.map((s, i) => ({ ...s, sequence: i + 1, state: i < currentIndex ? 'COMPLETED' : i === currentIndex ? 'CURRENT' : 'PENDING' })),
    completedStageCodes: completed,
    clocks,
    health: workflowHealth(clocks),
    eventCoverage: {
      total: events.length,
      coded: events.filter(e => e.eventCode || e.event_code).length,
      lastEventAt: [...events].sort((a,b)=>new Date(b.occurredAt||b.occurred_at)-new Date(a.occurredAt||a.occurred_at))[0]?.occurredAt || null
    }
  };
}
