/**
 * Caprae-oriented acquisition signals for ETA / search-fund shortlists.
 * Prefer private LMM buyer cues over public-market noise.
 * Pure — works from CSV columns + optional website / demo text.
 */
import type { RawLead } from '@/lib/scoring'
import { isFreeMail, parseNumber } from '@/lib/scoring'

export type SuccessionSignals = {
  longTenure: boolean
  noVisibleSuccessor: boolean
  businessAgeOver15: boolean
}

export type OwnerReachability = 'direct' | 'generic' | 'none'

const SUCCESSOR_HINT = /\b(jr|junior|ii|iii|successor|son|daughter|heir)\b/i

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

export type DealSignals = {
  succession: SuccessionSignals
  /** Locations / service-area footprint (1 = single shop). */
  locationsCount: number | null
  multiLocation: boolean
  googleRating: number | null
  reviewCount: number | null
  /** Bonded / licensed / BBB-style credibility. */
  licensedOrBonded: boolean
  bbbAccredited: boolean
  licensesNote: string | null
  /** High concentration risk if noted. */
  customerConcentration: string | null
  concentrationRisk: boolean
  /** Site/CSV language about sale, retirement, succession. */
  saleOrRetirementLanguage: boolean
  saleLanguageSnippet: string | null
  ownerReachability: OwnerReachability
  ownerReachLabel: string
  /** Compact badges for list + dossier. */
  badges: string[]
}

const SALE_LANG =
  /\b(retir(e|ing|ement)|succession|for\s*sale|selling\s+the\s+business|ready\s+to\s+sell|next\s+chapter|stepping\s+down|looking\s+for\s+a\s+buyer)\b/i

const LICENSE_LANG =
  /\b(licensed|bonded|insured|license\s*#|lic\.?\s*#|master\s+plumber|hvac\s+license|bbb\s+accredited)\b/i

const MULTI_LOC =
  /\b(\d+)\s*(locations?|branches|offices|shops|yards)\b/i

const CONCENTRATION =
  /\b(customer\s+concentration|top\s+client|key\s+account|one\s+customer|% of (revenue|sales))\b/i

function str(v: unknown): string | null {
  if (v == null) {
    return null
  }
  const s = String(v).trim()
  return s || null
}

function inferOwnerReachability(lead: RawLead): { kind: OwnerReachability; label: string } {
  const email = str(lead.email)?.toLowerCase()
  const phone = str(lead.phone)
  const hasPhone = Boolean(phone)
  if (!email && !hasPhone) {
    return { kind: 'none', label: 'No direct contact' }
  }
  if (email) {
    const local = email.split('@')[0] || ''
    const generic = /^(info|contact|sales|office|admin|hello|support)$/i.test(local)
    if (generic || isFreeMail(email)) {
      return {
        kind: 'generic',
        label: hasPhone ? 'Generic email · phone on file' : 'Generic / free-mail only',
      }
    }
    return {
      kind: 'direct',
      label: hasPhone ? 'Direct email + phone' : 'Direct work email',
    }
  }
  return { kind: 'generic', label: 'Phone only' }
}

function parseLocations(lead: RawLead, corpus: string): number | null {
  const fromCol = parseNumber(lead.locations ?? lead.locationCount ?? lead.numLocations)
  if (fromCol != null && fromCol > 0) {
    return Math.round(fromCol)
  }
  const m = corpus.match(MULTI_LOC)
  if (m) {
    return Number(m[1])
  }
  return null
}

function parseRating(lead: RawLead): number | null {
  const n = parseNumber(lead.googleRating ?? lead.rating ?? lead.reviewsRating)
  if (n == null) {
    return null
  }
  return Math.max(0, Math.min(5, n))
}

function parseReviews(lead: RawLead): number | null {
  const n = parseNumber(lead.reviewCount ?? lead.reviews ?? lead.googleReviews)
  if (n == null || n < 0) {
    return null
  }
  return Math.round(n)
}

/** Build deal signals from CSV (+ optional website / demo corpus text). */
export function buildDealSignals(
  lead: RawLead,
  opts?: { corpus?: string; now?: Date },
): DealSignals {
  const corpus = [
    opts?.corpus || '',
    str(lead.siteSnippet),
    str(lead.notes),
    str(lead.services),
    str(lead.industry),
    str(lead.saleSignal),
    str(lead.customerConcentration),
    str(lead.licenses),
  ]
    .filter(Boolean)
    .join(' · ')

  const succession = buildSuccessionSignals(lead, opts?.now)
  const locationsCount = parseLocations(lead, corpus)
  const multiLocation = (locationsCount != null && locationsCount >= 2) || MULTI_LOC.test(corpus)

  const googleRating = parseRating(lead)
  const reviewCount = parseReviews(lead)

  const licensesNote =
    str(lead.licenses) ||
    str(lead.bonding) ||
    (LICENSE_LANG.test(corpus) ? corpus.match(LICENSE_LANG)?.[0] || 'Licensed / bonded mention' : null)

  const licensedOrBonded =
    Boolean(str(lead.licenses) || str(lead.bonding)) ||
    /^(yes|y|true|1)$/i.test(str(lead.bonded) || '') ||
    LICENSE_LANG.test(corpus)

  const bbbAccredited =
    /^(yes|y|true|1)$/i.test(str(lead.bbb) || str(lead.bbbAccredited) || '') ||
    /\bbbb\s+accredited\b/i.test(corpus)

  const customerConcentration =
    str(lead.customerConcentration) ||
    (CONCENTRATION.test(corpus) ? 'Concentration language on file' : null)
  const concentrationRisk = Boolean(customerConcentration)

  const saleFromCol = str(lead.saleSignal)
  const saleOrRetirementLanguage = Boolean(saleFromCol) || SALE_LANG.test(corpus)
  const saleLanguageSnippet = saleFromCol
    ? saleFromCol.slice(0, 120)
    : saleOrRetirementLanguage
      ? (corpus.match(SALE_LANG)?.[0] || 'Sale / retirement language').slice(0, 120)
      : null

  const reach = inferOwnerReachability(lead)

  const badges: string[] = []
  if (succession.businessAgeOver15 && succession.noVisibleSuccessor) {
    badges.push('Succession window')
  } else if (succession.longTenure) {
    badges.push('Long tenure')
  }
  if (saleOrRetirementLanguage) {
    badges.push('Sale / retirement cue')
  }
  if (multiLocation) {
    badges.push(locationsCount ? `${locationsCount} locations` : 'Multi-location')
  }
  if (googleRating != null) {
    badges.push(
      reviewCount != null ? `${googleRating.toFixed(1)}★ · ${reviewCount} reviews` : `${googleRating.toFixed(1)}★`,
    )
  }
  if (licensedOrBonded || bbbAccredited) {
    badges.push(bbbAccredited ? 'Licensed · BBB' : 'Licensed / bonded')
  }
  if (concentrationRisk) {
    badges.push('Concentration risk')
  }
  if (reach.kind === 'direct') {
    badges.push('Owner reachable')
  } else if (reach.kind === 'none') {
    badges.push('Hard to reach')
  }

  return {
    succession,
    locationsCount,
    multiLocation,
    googleRating,
    reviewCount,
    licensedOrBonded,
    bbbAccredited,
    licensesNote,
    customerConcentration,
    concentrationRisk,
    saleOrRetirementLanguage,
    saleLanguageSnippet,
    ownerReachability: reach.kind,
    ownerReachLabel: reach.label,
    badges: badges.slice(0, 6),
  }
}

/** Pull sale / multi-loc / license cues from scraped HTML (or demo notes). */
export function extractDealCorpusFromHtml(html: string): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12_000)
  return text
}
