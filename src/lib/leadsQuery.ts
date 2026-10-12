/**
 * Client-side lead list helpers: tier filter + free-text search.
 * Pure functions — safe to unit-test and reuse from the Leads tab.
 */
import type { ScoredLead } from '@/lib/scoring'

export type TierFilter = 'ALL' | 'A' | 'B' | 'C' | 'JUNK'

/** Keep junk / duplicates only when the junk filter is selected. */
export function filterLeadsByTier(leads: ScoredLead[], filter: TierFilter): ScoredLead[] {
  if (filter === 'ALL') {
    return leads
  }

  if (filter === 'JUNK') {
    return leads.filter(lead => lead.junk || lead.duplicateOf)
  }

  return leads.filter(lead => !lead.junk && !lead.duplicateOf && lead.tier === filter)
}

function leadSearchHaystack(lead: ScoredLead): string {
  return [
    lead.lead.company,
    lead.lead.ownerName,
    lead.lead.email,
    lead.lead.industry,
    lead.lead.city,
    lead.lead.state,
    lead.lead.phone,
    lead.lead.website,
    lead.whyNow,
    lead.tier,
    ...lead.tags,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/** Case-insensitive substring match across common lead fields. */
export function searchLeads(leads: ScoredLead[], query: string): ScoredLead[] {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return leads
  }

  return leads.filter(lead => leadSearchHaystack(lead).includes(needle))
}

export function filterAndSearchLeads(
  leads: ScoredLead[],
  filter: TierFilter,
  query: string,
): ScoredLead[] {
  return searchLeads(filterLeadsByTier(leads, filter), query)
}
