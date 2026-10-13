/**
 * Pipeline funnel math + plain-English next actions (Today).
 */
import { buildDealSignals } from '@/lib/dealSignals'
import type { ScoredLead } from '@/lib/scoring'
import {
  FUNNEL_STAGES,
  STAGE_LABELS,
  isPipelineStage,
  type PipelineStage,
} from '@/lib/pipeline'

export type FunnelStep = {
  stage: PipelineStage
  label: string
  count: number
  conversionFromPrev: number | null
}

export type NamedCount = { key: string; count: number }

export type WorkflowImpact = {
  workflowKey: string
  name: string
  leadsMoved: number
}

export type BuyingPulse = {
  successionWindows: number
  ownerReachable: number
  multiLocation: number
  saleOrRetirementCues: number
  licensedOrBonded: number
  concentrationFlags: number
}

export type FunnelReport = {
  steps: FunnelStep[]
  byTier: NamedCount[]
  byIndustry: NamedCount[]
  byState: NamedCount[]
  creditsSaved: {
    enriched: number
    total: number
    ratio: number
  }
  workflowImpact: WorkflowImpact[]
  closed: number
  lost: number
  /** Clean shortlist size (non-junk). */
  cleanTotal: number
  tierA: number
  /** Contacted or further on the funnel. */
  inMotion: number
  buying: BuyingPulse
}

function stageOf(lead: ScoredLead): PipelineStage {
  return lead.stage && isPipelineStage(lead.stage) ? lead.stage : 'new'
}

/** Stage index on funnel spine; closed/lost are terminal side paths. */
function funnelIndex(stage: PipelineStage): number {
  const idx = FUNNEL_STAGES.indexOf(stage)
  if (idx >= 0) {
    return idx
  }
  if (stage === 'closed' || stage === 'lost') {
    return FUNNEL_STAGES.length
  }
  return 0
}

/**
 * Count leads that reached at least this funnel stage
 * (e.g. Contacted includes Replied, Owner call, LOI, Closed).
 */
export function countReachedStage(leads: ScoredLead[], stage: PipelineStage): number {
  const target = funnelIndex(stage)
  return leads.filter(l => {
    if (l.junk || l.duplicateOf) {
      return false
    }
    const s = stageOf(l)
    if (stage === 'closed') {
      return s === 'closed'
    }
    if (stage === 'lost') {
      return s === 'lost'
    }
    if (s === 'lost') {
      return false
    }
    return funnelIndex(s) >= target
  }).length
}

export function buildFunnelReport(
  leads: ScoredLead[],
  opts?: {
    enrichedIds?: Set<string>
    workflowMoves?: WorkflowImpact[]
  },
): FunnelReport {
  const clean = leads.filter(l => !l.junk && !l.duplicateOf)
  const steps: FunnelStep[] = FUNNEL_STAGES.map(stage => ({
    stage,
    label: STAGE_LABELS[stage],
    count: stage === 'new' ? clean.length : countReachedStage(clean, stage),
    conversionFromPrev: null as number | null,
  }))

  for (let i = 1; i < steps.length; i++) {
    const prevCount = steps[i - 1].count
    steps[i].conversionFromPrev =
      prevCount > 0 ? Math.round((steps[i].count / prevCount) * 1000) / 10 : null
  }

  const byTierMap = new Map<string, number>()
  const byIndMap = new Map<string, number>()
  const byStateMap = new Map<string, number>()
  for (const l of clean) {
    byTierMap.set(l.tier, (byTierMap.get(l.tier) || 0) + 1)
    const ind = String(l.lead.industry || 'Unknown').trim() || 'Unknown'
    byIndMap.set(ind, (byIndMap.get(ind) || 0) + 1)
    const st = String(l.lead.state || '—').toUpperCase()
    byStateMap.set(st, (byStateMap.get(st) || 0) + 1)
  }

  const toNamed = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)

  const enriched =
    opts?.enrichedIds?.size ??
    clean.filter(l => funnelIndex(stageOf(l)) >= funnelIndex('enriched') || !!l.profile?.company.services.value)
      .length

  const buying: BuyingPulse = {
    successionWindows: 0,
    ownerReachable: 0,
    multiLocation: 0,
    saleOrRetirementCues: 0,
    licensedOrBonded: 0,
    concentrationFlags: 0,
  }
  for (const l of clean) {
    const deal = l.profile?.deal || buildDealSignals(l.lead)
    if (deal.succession.businessAgeOver15 && deal.succession.noVisibleSuccessor) {
      buying.successionWindows++
    }
    if (deal.ownerReachability === 'direct') {
      buying.ownerReachable++
    }
    if (deal.multiLocation) {
      buying.multiLocation++
    }
    if (deal.saleOrRetirementLanguage) {
      buying.saleOrRetirementCues++
    }
    if (deal.licensedOrBonded || deal.bbbAccredited) {
      buying.licensedOrBonded++
    }
    if (deal.concentrationRisk) {
      buying.concentrationFlags++
    }
  }

  const inMotion = clean.filter(l => {
    const s = stageOf(l)
    return funnelIndex(s) >= funnelIndex('contacted') && s !== 'lost'
  }).length

  return {
    steps,
    byTier: toNamed(byTierMap),
    byIndustry: toNamed(byIndMap).slice(0, 12),
    byState: toNamed(byStateMap).slice(0, 12),
    creditsSaved: {
      enriched,
      total: clean.length,
      ratio: clean.length ? Math.round((1 - enriched / clean.length) * 1000) / 10 : 0,
    },
    workflowImpact: opts?.workflowMoves || [],
    closed: clean.filter(l => stageOf(l) === 'closed').length,
    lost: clean.filter(l => stageOf(l) === 'lost').length,
    cleanTotal: clean.length,
    tierA: clean.filter(l => l.tier === 'A').length,
    inMotion,
    buying,
  }
}

export type ReportAction = {
  id: string
  title: string
  detail: string
  leadId?: string
}

/** Plain-English next steps for Today (no chart math). */
export function buildReportActions(
  leads: ScoredLead[],
  opts?: { enrichedIds?: Set<string> },
): ReportAction[] {
  const clean = leads.filter(l => !l.junk && !l.duplicateOf)
  const actions: ReportAction[] = []

  const aNeedOutreach = clean.filter(l => {
    const s = stageOf(l)
    return l.tier === 'A' && (s === 'new' || s === 'enriched')
  })
  if (aNeedOutreach.length) {
    const first = aNeedOutreach[0]
    actions.push({
      id: 'outreach',
      title: `Reach out to ${aNeedOutreach.length} A-tier lead${aNeedOutreach.length === 1 ? '' : 's'}`,
      detail: 'Scored as a fit, still before Contacted.',
      leadId: first.id,
    })
  }

  const succession = clean.filter(l => {
    const deal = l.profile?.deal || buildDealSignals(l.lead)
    return (
      l.tier === 'A' &&
      deal.succession.businessAgeOver15 &&
      deal.succession.noVisibleSuccessor
    )
  })
  if (succession.length) {
    actions.push({
      id: 'succession',
      title: `${succession.length} succession window${succession.length === 1 ? '' : 's'} on A-tier`,
      detail: 'Long-tenured owner, no visible successor — classic ETA why-now.',
      leadId: succession[0].id,
    })
  }

  const needEnrich = clean.filter(l => {
    if (l.tier !== 'A') {
      return false
    }
    const enriched =
      opts?.enrichedIds?.has(l.id) ||
      (l.stage != null && funnelIndex(stageOf(l)) >= funnelIndex('enriched'))
    return !enriched
  })
  if (needEnrich.length) {
    actions.push({
      id: 'enrich',
      title: `Fill website details on ${needEnrich.length} A-tier lead${needEnrich.length === 1 ? '' : 's'}`,
      detail: 'Enrich only the ones you plan to call — saves SaaSquatch credits.',
      leadId: needEnrich[0].id,
    })
  }

  const stuck = clean.filter(l => stageOf(l) === 'contacted')
  if (stuck.length) {
    actions.push({
      id: 'followup',
      title: `Follow up ${stuck.length} contacted lead${stuck.length === 1 ? '' : 's'}`,
      detail: 'Already in outreach — nudge or move stage on the lead page.',
      leadId: stuck[0].id,
    })
  }

  return actions.slice(0, 4)
}
