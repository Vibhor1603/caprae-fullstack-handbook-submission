/**
 * Shared filter model for Leads, Today, and Funnel report.
 */
import type { ScoredLead } from '@/lib/scoring'
import type { EnrichmentSnapshot } from '@/lib/enrichment'
import { isPipelineStage, type PipelineStage } from '@/lib/pipeline'
import { searchLeads, type TierFilter } from '@/lib/leadsQuery'

export type SharedFilters = {
  tier: TierFilter
  industries: string[]
  states: string[]
  stages: PipelineStage[]
  minConfidence: number | null
  query: string
}

export const DEFAULT_FILTERS: SharedFilters = {
  tier: 'ALL',
  industries: [],
  states: [],
  stages: [],
  minConfidence: null,
  query: '',
}

function avgConfidence(snap: EnrichmentSnapshot | undefined): number | null {
  if (!snap) {
    return null
  }
  const vals = [snap.email, snap.phone, snap.yearFounded, snap.services]
    .map(f => f.confidence)
    .filter(n => Number.isFinite(n))
  if (!vals.length) {
    return null
  }
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

export function applySharedFilters(
  leads: ScoredLead[],
  filters: SharedFilters,
  enrichments?: Record<string, EnrichmentSnapshot>,
): ScoredLead[] {
  let list = leads

  if (filters.tier === 'JUNK') {
    list = list.filter(l => l.junk || !!l.duplicateOf)
  } else if (filters.tier !== 'ALL') {
    list = list.filter(l => !l.junk && !l.duplicateOf && l.tier === filters.tier)
  }

  if (filters.industries.length) {
    const set = new Set(filters.industries.map(s => s.toLowerCase()))
    list = list.filter(l => {
      const ind = String(l.lead.industry || '').toLowerCase()
      return [...set].some(k => ind.includes(k))
    })
  }

  if (filters.states.length) {
    const set = new Set(filters.states.map(s => s.toUpperCase()))
    list = list.filter(l => set.has(String(l.lead.state || '').toUpperCase()))
  }

  if (filters.stages.length) {
    const set = new Set(filters.stages)
    list = list.filter(l => {
      const stage = l.stage && isPipelineStage(l.stage) ? l.stage : 'new'
      return set.has(stage)
    })
  }

  if (filters.minConfidence != null && Number.isFinite(filters.minConfidence)) {
    list = list.filter(l => {
      const avg = avgConfidence(enrichments?.[l.id])
      if (avg == null) {
        return false
      }
      return avg >= filters.minConfidence!
    })
  }

  if (filters.query.trim()) {
    list = searchLeads(list, filters.query)
  }

  return list
}

export function uniqueIndustries(leads: ScoredLead[]): string[] {
  const set = new Set<string>()
  for (const l of leads) {
    const ind = String(l.lead.industry || '').trim()
    if (ind) {
      set.add(ind)
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

export function uniqueStates(leads: ScoredLead[]): string[] {
  const set = new Set<string>()
  for (const l of leads) {
    const st = String(l.lead.state || '').trim().toUpperCase()
    if (st) {
      set.add(st)
    }
  }
  return [...set].sort()
}
