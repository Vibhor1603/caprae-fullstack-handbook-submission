/**
 * Persist demo session in localStorage so a refresh keeps leads, tab, ICP, and search.
 * Server components never call these — window checks are belt-and-suspenders only.
 */
import type { Icp, ScoredLead } from '@/lib/scoring'

const STORAGE_KEY = 'sq-session-v1'

const TIER_FILTERS = ['ALL', 'A', 'B', 'C', 'JUNK'] as const
const TABS = ['leads', 'automate', 'runs', 'report'] as const

export type SessionSnapshot = {
  rawLeads: ScoredLead[]
  enrichments: Record<string, unknown>
  icp: Icp
  filter: (typeof TIER_FILTERS)[number]
  query: string
  tab: (typeof TABS)[number]
  openId: string | null
}

function isTierFilter(value: unknown): value is SessionSnapshot['filter'] {
  return typeof value === 'string' && (TIER_FILTERS as readonly string[]).includes(value)
}

function isTab(value: unknown): value is SessionSnapshot['tab'] {
  return typeof value === 'string' && (TABS as readonly string[]).includes(value)
}

function normalizeSnapshot(parsed: Partial<SessionSnapshot>): SessionSnapshot {
  return {
    rawLeads: Array.isArray(parsed.rawLeads) ? parsed.rawLeads : [],
    enrichments:
      parsed.enrichments && typeof parsed.enrichments === 'object' ? parsed.enrichments : {},
    icp: parsed.icp as Icp,
    filter: isTierFilter(parsed.filter) ? parsed.filter : 'ALL',
    query: typeof parsed.query === 'string' ? parsed.query : '',
    tab: isTab(parsed.tab) ? parsed.tab : 'leads',
    openId: typeof parsed.openId === 'string' ? parsed.openId : null,
  }
}

export function loadSession(): SessionSnapshot | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<SessionSnapshot>
    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    return normalizeSnapshot(parsed)
  } catch {
    return null
  }
}

export function saveSession(snapshot: SessionSnapshot): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Quota exceeded or private mode — demo still works without persistence.
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage failures.
  }
}
