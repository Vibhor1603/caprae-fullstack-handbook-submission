/**
 * Lead profile dossier — company + owner intelligence with field provenance.
 * Scoring, enrichment, and workflows read/write through this shape.
 */
import type { EnrichmentSnapshot } from '@/lib/enrichment'
import type { RawLead, ScoredLead, ScoreFactor } from '@/lib/scoring'
import { parseNumber } from '@/lib/scoring'
import type { PipelineStage } from '@/lib/pipeline'

export type FieldSource = 'csv' | 'enrichment' | 'demo' | 'inferred'

export type ProfileField<T = string | null> = {
  value: T
  source: FieldSource
  confidence?: number
  verifiedAt?: string
}

export type SuccessionSignals = {
  longTenure: boolean
  noVisibleSuccessor: boolean
  businessAgeOver15: boolean
}

export type LeadProfile = {
  company: {
    industry: ProfileField
    location: ProfileField
    foundedYear: ProfileField
    ageYears: ProfileField<number | null>
    revenueBand: ProfileField
    employeeBand: ProfileField
    services: ProfileField
    websiteStatus: ProfileField
  }
  owner: {
    name: ProfileField
    role: ProfileField
    estimatedTenure: ProfileField
    succession: SuccessionSignals
    contactability: ProfileField
  }
  insights: {
    whyNow: string
    riskFlags: string[]
    lastVerified: string | null
  }
}

const SUCCESSOR_HINT = /\b(jr|junior|ii|iii|successor|son|daughter|heir)\b/i

function field<T>(
  value: T,
  source: FieldSource,
  confidence?: number,
  verifiedAt?: string,
): ProfileField<T> {
  return { value, source, confidence, verifiedAt }
}

function revenueBand(raw: unknown): string | null {
  const n = parseNumber(raw)
  if (n == null) {
    return raw != null && String(raw).trim() ? String(raw) : null
  }
  if (n < 1_000_000) {
    return '<$1M'
  }
  if (n < 5_000_000) {
    return '$1–5M'
  }
  if (n < 10_000_000) {
    return '$5–10M'
  }
  if (n < 25_000_000) {
    return '$10–25M'
  }
  if (n < 50_000_000) {
    return '$25–50M'
  }
  return '$50M+'
}

function employeeBand(raw: unknown): string | null {
  const n = parseNumber(raw)
  if (n == null) {
    return raw != null && String(raw).trim() ? String(raw) : null
  }
  if (n <= 10) {
    return '1–10'
  }
  if (n <= 50) {
    return '11–50'
  }
  if (n <= 200) {
    return '51–200'
  }
  if (n <= 500) {
    return '201–500'
  }
  return '500+'
}

function locationLine(lead: RawLead): string | null {
  const parts = [lead.city, lead.state, lead.country].filter(Boolean).map(String)
  return parts.length ? parts.join(', ') : null
}

function contactability(lead: RawLead): string {
  const bits: string[] = []
  if (lead.email) {
    bits.push('email')
  }
  if (lead.phone) {
    bits.push('phone')
  }
  if (lead.linkedin) {
    bits.push('LinkedIn')
  }
  return bits.length ? bits.join(' · ') : 'No direct contact'
}

export function buildSuccessionSignals(lead: RawLead, now = new Date()): SuccessionSignals {
  const yr = parseNumber(lead.yearFounded)
  const age = yr != null ? now.getFullYear() - yr : null
  const title = String(lead.title || '').toLowerCase()
  const founderLike = /\b(owner|founder|ceo|president|principal)\b/.test(title)
  const successorVisible =
    SUCCESSOR_HINT.test(String(lead.ownerName || '')) || SUCCESSOR_HINT.test(title)
  return {
    longTenure: age != null && age >= 10,
    noVisibleSuccessor: founderLike && !successorVisible,
    businessAgeOver15: age != null && age >= 15,
  }
}

export function buildLeadProfile(
  lead: RawLead,
  opts?: {
    enrichment?: EnrichmentSnapshot | null
    whyNow?: string
    riskFlags?: string[]
    now?: Date
  },
): LeadProfile {
  const now = opts?.now ?? new Date()
  const enrich = opts?.enrichment
  const verified = enrich?.lastVerified
  const yr = parseNumber(enrich?.yearFounded.value || lead.yearFounded)
  const age = yr != null ? now.getFullYear() - yr : null
  const succession = buildSuccessionSignals(
    {
      ...lead,
      yearFounded: yr ?? lead.yearFounded,
    },
    now,
  )

  const riskFlags = [...(opts?.riskFlags || [])]
  if (succession.businessAgeOver15 && succession.noVisibleSuccessor) {
    riskFlags.push('Succession risk: long tenure, no visible successor')
  }
  if (!lead.email && !lead.phone) {
    riskFlags.push('Low contactability')
  }

  const servicesVal = enrich?.services.value || null
  const websiteStatus = !lead.website
    ? 'No website'
    : enrich?.source === 'skipped'
      ? 'Skipped'
      : enrich?.robotsAllowed === false
        ? 'Robots blocked'
        : enrich?.live
          ? 'Live'
          : enrich
            ? 'Cached / demo'
            : 'Not checked'

  return {
    company: {
      industry: field(lead.industry ? String(lead.industry) : null, 'csv'),
      location: field(locationLine(lead), 'csv'),
      foundedYear: field(
        yr != null ? String(yr) : lead.yearFounded != null ? String(lead.yearFounded) : null,
        enrich?.yearFounded.value ? 'enrichment' : 'csv',
        enrich?.yearFounded.confidence,
        verified,
      ),
      ageYears: field(age, age != null ? 'inferred' : 'csv'),
      revenueBand: field(revenueBand(lead.revenue), 'csv'),
      employeeBand: field(employeeBand(lead.employees), 'csv'),
      services: field(
        servicesVal,
        servicesVal ? (enrich?.source === 'demo' ? 'demo' : 'enrichment') : 'csv',
        enrich?.services.confidence,
        verified,
      ),
      websiteStatus: field(websiteStatus, enrich ? 'enrichment' : 'inferred', enrich ? 0.9 : 0.3),
    },
    owner: {
      name: field(lead.ownerName ? String(lead.ownerName) : null, 'csv'),
      role: field(lead.title ? String(lead.title) : null, 'csv'),
      estimatedTenure: field(
        age != null ? `~${age} yrs with business` : null,
        age != null ? 'inferred' : 'csv',
      ),
      succession,
      contactability: field(contactability(lead), 'inferred'),
    },
    insights: {
      whyNow: opts?.whyNow || '',
      riskFlags: [...new Set(riskFlags)],
      lastVerified: verified || null,
    },
  }
}

/** Merge enrichment snapshot into an existing profile (high-confidence fields). */
export function mergeEnrichmentIntoProfile(
  profile: LeadProfile,
  snap: EnrichmentSnapshot,
  lead: RawLead,
  whyNow?: string,
): LeadProfile {
  const next = buildLeadProfile(lead, {
    enrichment: snap,
    whyNow: whyNow || profile.insights.whyNow,
    riskFlags: profile.insights.riskFlags,
  })
  return next
}

export type LeadActivityItem = {
  id?: string
  kind: string
  summary: string
  payload?: Record<string, unknown>
  createdAt: string
}

export type LeadDossier = {
  stage: PipelineStage
  profile: LeadProfile
  scoreBreakdown: ScoreFactor[]
  activities: LeadActivityItem[]
}

/** Attach / refresh dossier profile on scored leads (call after triage or rescore). */
export function withProfiles(scored: ScoredLead[]): ScoredLead[] {
  return scored.map(s => ({
    ...s,
    profile: buildLeadProfile(s.lead, {
      whyNow: s.whyNow,
      riskFlags: s.profile?.insights.riskFlags,
    }),
    stage: s.stage || 'new',
  }))
}
