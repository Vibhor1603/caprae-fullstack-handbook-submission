import type { PipelineStage } from '@/lib/pipeline'
import type { ScoredLead } from '@/lib/scoring'

/** Demo pipeline placement keyed by CSV `company` (fallback: row index as string). */
export const DEMO_STAGE_PLAN: Record<string, PipelineStage> = {
  'Northwind HVAC LLC': 'enriched',
  'Northwind HVAC': 'enriched',
  'Bluegate Plumbing Co': 'contacted',
  'Blue Gate Plumbing': 'lost',
  'Summit Precision Manufacturing': 'loi',
  'Summit Precision Mfg': 'owner_call',
  'Ghost Leads Inc': 'lost',
  'CloudNova SaaS': 'lost',
  'Broken Email Logistics': 'new',
  'VaporWare Analytics': 'lost',
  'Arctic Air HVAC': 'new',
  'Sunbelt Comfort Systems': 'closed',
  'Lakeview Heating & Cooling': 'enriched',
  'PipeRight Plumbing': 'contacted',
  'CopperLine Plumbing': 'new',
  'RootWorks Plumbing': 'replied',
  'Green Acre Landscaping': 'closed',
  'Evergreen Turf & Tree': 'contacted',
  'Stonebridge Landscapes': 'new',
  'Midwest Metal Works': 'owner_call',
  'Precision Coil Fabricators': 'closed',
  'Atlas Packaging LLC': 'closed',
  'Heartland Freight Lines': 'replied',
  'QuickRoute Delivery': 'enriched',
  'Pioneer Warehousing': 'contacted',
  'Harbor Accounting Group': 'loi',
  'LedgerPoint CPA': 'replied',
  'TaxWise Advisors': 'closed',
  'BrightWire Electric': 'contacted',
  'PowerGrid Electric Co': 'owner_call',
  'SparkLine Electrical': 'new',
  'Peak Roofing Solutions': 'replied',
  'ShieldTop Roofing': 'lost',
  'Heritage Shingle Co': 'owner_call',
  'CoolBreeze Mechanical': 'contacted',
  'FlowMaster Plumbing': 'replied',
  'Brush & Bloom Landscaping': 'contacted',
  'IronBridge Manufacturing': 'owner_call',
  'CrossDock Logistics': 'replied',
  'Summit Books & Tax': 'new',
  'VoltEdge Electric': 'contacted',
  'Skyline Roofing Partners': 'owner_call',
  'ThermalPro HVAC': 'contacted',
  'AquaFix Plumbing': 'enriched',
  'LawnLogic Landscaping': 'replied',
  'ForgeLine Manufacturing': 'closed',
  'RailSpan Logistics': 'enriched',
  'ClearLedger Accounting': 'loi',
  'CircuitNorth Electric': 'enriched',
  'TileGuard Roofing': 'replied',
  'ComfortZone HVAC': 'new',
  'DrainDoctor Plumbing': 'owner_call',
  'PalmScape Landscaping': 'loi',
  'BayState Manufacturing': 'loi',
  'Metro Haul Logistics': 'new',
  'NumbersFirst Accounting': 'enriched',
  'WireWorks Electric': 'closed',
  'RedTile Roofing': 'lost',
  'FrostLine HVAC': 'owner_call',
  'MainLine Plumbing': 'loi',
}

const CONTACTED_FOLLOW_UP = new Set([
  'Bluegate Plumbing Co',
  'PipeRight Plumbing',
  'Evergreen Turf & Tree',
  'Pioneer Warehousing',
  'BrightWire Electric',
  'CoolBreeze Mechanical',
  'Brush & Bloom Landscaping',
  'VoltEdge Electric',
])

const PREV_SCORE_SNAPSHOT: Partial<
  Record<string, { prevTier: 'A' | 'B' | 'C'; prevScore: number }>
> = {
  'Summit Precision Manufacturing': { prevTier: 'B', prevScore: 58 },
  'Harbor Accounting Group': { prevTier: 'B', prevScore: 52 },
  'Heartland Freight Lines': { prevTier: 'C', prevScore: 41 },
  'Midwest Metal Works': { prevTier: 'A', prevScore: 68 },
  'Green Acre Landscaping': { prevTier: 'C', prevScore: 38 },
  'WireWorks Electric': { prevTier: 'B', prevScore: 55 },
  'BayState Manufacturing': { prevTier: 'A', prevScore: 72 },
  'RootWorks Plumbing': { prevTier: 'B', prevScore: 48 },
  'IronBridge Manufacturing': { prevTier: 'A', prevScore: 65 },
  'ClearLedger Accounting': { prevTier: 'B', prevScore: 50 },
  'FrostLine HVAC': { prevTier: 'B', prevScore: 54 },
  'MainLine Plumbing': { prevTier: 'B', prevScore: 57 },
}

function resolveStage(lead: ScoredLead, index: number): PipelineStage {
  const company = lead.lead.company?.trim()
  if (company && DEMO_STAGE_PLAN[company]) {
    return DEMO_STAGE_PLAN[company]
  }
  const byIndex = DEMO_STAGE_PLAN[String(index)]
  return byIndex ?? 'new'
}

function daysAgoIso(now: Date, days: number): string {
  const d = new Date(now)
  d.setUTCDate(d.getUTCDate() - days)
  d.setUTCHours(14, 30, 0, 0)
  return d.toISOString()
}

function daysAheadIso(now: Date, days: number): string {
  const d = new Date(now)
  d.setUTCDate(d.getUTCDate() + days)
  d.setUTCHours(10, 0, 0, 0)
  return d.toISOString()
}

/** Applies demo funnel stages, timestamps, and follow-ups after triage/rescore. */
export function assignDemoStages(leads: ScoredLead[], now = new Date()): ScoredLead[] {
  return leads.map((lead, index) => {
    const company = lead.lead.company?.trim() ?? ''
    const stage = resolveStage(lead, index)
    const daysAgo = (index * 3 + company.length) % 18
    const stageChangedAt = daysAgoIso(now, daysAgo)

    let followUpAt: string | null = null
    if (stage === 'contacted' && CONTACTED_FOLLOW_UP.has(company)) {
      followUpAt = daysAheadIso(now, 1 + (index % 4))
    }

    const prev = PREV_SCORE_SNAPSHOT[company]
    return {
      ...lead,
      stage,
      stageChangedAt,
      followUpAt,
      ...(prev ? { prevTier: prev.prevTier, prevScore: prev.prevScore } : {}),
    }
  })
}
