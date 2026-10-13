/**
 * Pipeline funnel math for the Funnel report.
 */
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
    label:
      stage === 'new'
        ? 'In list'
        : stage === 'enriched'
          ? 'Looked up'
          : STAGE_LABELS[stage],
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
  }
}
