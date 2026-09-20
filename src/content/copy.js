export const COPY = {
  brand: {
    name: 'BhoomiDrishti',
    shortDescription: 'Predictive Land Acquisition Intelligence & Decision Support',
    sidebarDescription: 'Land Acquisition Decision Support System',
    complianceNote: 'Government-aligned decision support software. Official Government of India emblem display requires appropriate authorization.',
  },
  dashboard: {
    eyebrow: (count) => `Overview · ${count} active projects`,
    headline: "Don't wait for the delay. Detect the warning signs early.",
    topRisk: 'Highest-risk projects',
    riskOverview: 'Risk overview',
  },
  map: {
    eyebrow: 'Operational GIS intelligence',
    title: 'National risk map',
    searchPlaceholder: 'Search project, district or code',
    riskZones: 'Risk zones',
    ongoingOnly: 'Ongoing only',
    portfolioIndex: 'Portfolio index',
    authoritativeNote: 'Authoritative parcel geometry will take precedence when present in source data.',
  },
  ai: {
    eyebrow: "Grounded in the session's available project data",
    title: 'Bhoomi AI — Evidence-Grounded Decision Support',
    greeting: "I'm Bhoomi AI. Ask about project risk, bottlenecks, documents, legal exposure, geographic concentration, or priority actions. I answer from the authorised project data available to this session and distinguish evidence from modelled recommendations.",
    dataNote: 'Uses the currently loaded project records. It does not invent unavailable government records, statutory facts, officer identities, approvals, or legal conclusions.',
    inputPlaceholder: 'Ask Bhoomi AI about project risk, evidence or priorities…',
    loading: 'Analysing current project data…',
  },
  project: {
    evidenceTitle: 'Documents & records to verify',
    accountabilityTitle: 'Who needs to verify / approve',
    blockersTitle: 'Current blockers requiring action',
    verificationNote: "Responsibilities shown here are workflow guidance derived from the project data model. Actual posts, delegation and approval authority must be configured from the competent authority's approved workflow.",
  },
};
