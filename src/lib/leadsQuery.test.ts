import { describe, expect, it } from 'vitest'
import { filterAndSearchLeads, filterLeadsByTier, searchLeads } from '@/lib/leadsQuery'
import type { ScoredLead } from '@/lib/scoring'

function makeLead(partial: Partial<ScoredLead> & { id: string; company: string }): ScoredLead {
  return {
    id: partial.id,
    lead: {
      company: partial.company,
      industry: 'HVAC',
      city: 'Columbus',
      state: 'OH',
      ownerName: 'Dana',
      email: 'dana@example.com',
      ...(partial.lead || {}),
    },
    score: partial.score ?? 80,
    tier: partial.tier ?? 'A',
    reasons: [],
    junk: partial.junk ?? false,
    junkReasons: [],
    whyNow: partial.whyNow ?? '',
    tags: partial.tags ?? [],
    duplicateOf: partial.duplicateOf,
  }
}

describe('leadsQuery', () => {
  const leads = [
    makeLead({ id: '1', company: 'Northwind HVAC', tier: 'A' }),
    makeLead({ id: '2', company: 'Acme Plumbing', tier: 'B' }),
    makeLead({ id: '3', company: 'Spam Co', tier: 'C', junk: true }),
  ]

  it('filters by tier and junk', () => {
    expect(filterLeadsByTier(leads, 'A')).toHaveLength(1)
    expect(filterLeadsByTier(leads, 'JUNK')[0].id).toBe('3')
    expect(filterLeadsByTier(leads, 'ALL')).toHaveLength(3)
  })

  it('searches across company and owner fields', () => {
    expect(searchLeads(leads, 'northwind')).toHaveLength(1)
    expect(searchLeads(leads, '  ')).toHaveLength(3)
  })

  it('combines filter and search', () => {
    expect(filterAndSearchLeads(leads, 'B', 'plumbing')[0].id).toBe('2')
    expect(filterAndSearchLeads(leads, 'A', 'plumbing')).toHaveLength(0)
  })
})
