/**
 * Persist demo session in localStorage so a refresh keeps leads, tab, ICP, and search.
 * Server components never call these — window checks are belt-and-suspenders only.
 */
import type { Icp, ScoredLead } from '@/lib/scoring'
import { DEFAULT_FILTERS, type SharedFilters } from '@/lib/filters'
import type { LeadActivityItem } from '@/lib/profile'

const STORAGE_KEY = 'sq-session-v2'
const LEGACY_KEY = 'sq-session-v1'

const TABS = ['today', 'leads', 'automate', 'runs', 'report'] as const

export type AppTab = (typeof TABS)[number]

export type SessionSnapshot = {
  rawLeads: ScoredLead[]
  enrichments: Record<string, unknown>
  activities: Record<string, LeadActivityItem[]>
  icp: Icp
  filters: SharedFilters
  tab: AppTab
  openId: string | null
  profileId: string | null
}

function isTab(value: unknown): value is AppTab {
  return typeof value === 'string' && (TABS as readonly string[]).includes(value)
}

function normalizeFilters(raw: unknown): SharedFilters {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_FILTERS }
  }
  const f = raw as Partial<SharedFilters>
  return {
    tier: (f.tier as SharedFilters['tier']) || 'ALL',
    industries: Array.isArray(f.industries) ? f.industries : [],
    states: Array.isArray(f.states) ? f.states : [],
    stages: Array.isArray(f.stages) ? f.stages : [],
    minConfidence: typeof f.minConfidence === 'number' ? f.minConfidence : null,
    query: typeof f.query === 'string' ? f.query : '',
  }
}

function normalizeSnapshot(parsed: Partial<SessionSnapshot> & {
  filter?: string
  query?: string
}): SessionSnapshot {
  const legacyFilters =
    parsed.filters ||
    ({
      ...DEFAULT_FILTERS,
      tier: (parsed.filter as SharedFilters['tier']) || 'ALL',
      query: typeof parsed.query === 'string' ? parsed.query : '',
    } as SharedFilters)

  return {
    rawLeads: Array.isArray(parsed.rawLeads) ? parsed.rawLeads : [],
    enrichments:
      parsed.enrichments && typeof parsed.enrichments === 'object' ? parsed.enrichments : {},
    activities:
      parsed.activities && typeof parsed.activities === 'object' ? parsed.activities : {},
    icp: parsed.icp as Icp,
    filters: normalizeFilters(legacyFilters),
    tab: isTab(parsed.tab) ? parsed.tab : 'today',
    openId: typeof parsed.openId === 'string' ? parsed.openId : null,
    profileId: typeof parsed.profileId === 'string' ? parsed.profileId : null,
  }
}

export function loadSession(): SessionSnapshot | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<SessionSnapshot> & { filter?: string; query?: string }
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
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    // Ignore storage failures.
  }
}
