/**
 * Ethical public-site enrichment.
 * - Honours robots.txt Disallow for User-agent: *
 * - Rate-limited (≥1.5s between live fetches)
 * - Cached (Prisma EnrichmentCache, 7-day TTL)
 * - Fictional *.example domains use seeded heuristics (demo-safe, no network)
 */
import type { RawLead } from '@/lib/scoring'
import { normalizeDomain } from '@/lib/scoring'
import { buildDealSignals, extractDealCorpusFromHtml } from '@/lib/dealSignals'

export type FieldConfidence = { value: string | null; confidence: number }

export type EnrichmentSnapshot = {
  domain: string | null
  live: boolean
  robotsAllowed: boolean
  source: 'live' | 'cache' | 'demo' | 'skipped'
  email: FieldConfidence
  phone: FieldConfidence
  yearFounded: FieldConfidence
  services: FieldConfidence
  /** Optional Caprae deal-intel fields (CSV + site heuristics). */
  googleRating?: FieldConfidence
  reviewCount?: FieldConfidence
  locationsCount?: FieldConfidence
  licensesNote?: FieldConfidence
  saleLanguageSnippet?: FieldConfidence
  customerConcentration?: FieldConfidence
  /** Free-text corpus used to recompute deal signals. */
  dealCorpus?: string
  lastVerified: string // ISO
  notes: string[]
}

function dealFieldsFromLead(lead: RawLead, corpus = '') {
  const signals = buildDealSignals(lead, { corpus })
  return {
    googleRating: fc(
      signals.googleRating != null ? String(signals.googleRating) : null,
      signals.googleRating != null ? 0.75 : 0.1,
    ),
    reviewCount: fc(
      signals.reviewCount != null ? String(signals.reviewCount) : null,
      signals.reviewCount != null ? 0.7 : 0.1,
    ),
    locationsCount: fc(
      signals.locationsCount != null ? String(signals.locationsCount) : null,
      signals.locationsCount != null ? 0.8 : 0.15,
    ),
    licensesNote: fc(signals.licensesNote, signals.licensesNote ? 0.7 : 0.1),
    saleLanguageSnippet: fc(
      signals.saleLanguageSnippet,
      signals.saleLanguageSnippet ? 0.65 : 0.1,
    ),
    customerConcentration: fc(
      signals.customerConcentration,
      signals.customerConcentration ? 0.6 : 0.1,
    ),
    dealCorpus: corpus,
  }
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
let lastFetchAt = 0
const MIN_GAP_MS = 1500

function fc(value: string | null, confidence: number): FieldConfidence {
  return { value, confidence: Math.max(0, Math.min(1, confidence)) }
}

async function delay(ms: number) {
  await new Promise(r => setTimeout(r, ms))
}

async function robotsAllows(origin: string, path = '/'): Promise<boolean> {
  try {
    const res = await fetch(new URL('/robots.txt', origin).toString(), {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'CapraeLeadTriageBot/1.0 (+handbook-demo; respectful)' },
    })
    if (!res.ok) {return true} // fail-open for missing robots (common); still rate-limit
    const text = await res.text()
    const lines = text.split(/\r?\n/)
    let inStar = false
    for (const raw of lines) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) {continue}
      const lower = line.toLowerCase()
      if (lower.startsWith('user-agent:')) {
        inStar = lower.slice('user-agent:'.length).trim() === '*'
        continue
      }
      if (!inStar) {continue}
      if (lower.startsWith('disallow:')) {
        const rule = line.slice(line.indexOf(':') + 1).trim() || '/'
        if (rule === '/' || path.startsWith(rule)) {return false}
      }
    }
    return true
  } catch {
    return false
  }
}

function extractFromHtml(html: string): {
  email: string | null
  phone: string | null
  year: string | null
  services: string | null
} {
  const emailMatch = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,})/i)
  const emailText = html.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,})\b/)
  const phoneMatch =
    html.match(/tel:([+\d][\d\s().-]{8,})/i) ||
    html.match(/\b(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/)
  const yearMatch =
    html.match(/(?:since|est\.?|founded|established)\s*(?:in\s*)?(19|20)\d{2}/i) ||
    html.match(/\b(19[5-9]\d|20[0-2]\d)\b/)
  const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
  const h1 = html.match(/<h1[^>]*>([^<]{3,120})<\/h1>/i)
  const services = (metaDesc?.[1] || h1?.[1] || '').replace(/\s+/g, ' ').trim().slice(0, 160) || null
  return {
    email: emailMatch?.[1] || emailText?.[1] || null,
    phone: phoneMatch?.[1]?.replace(/\s+/g, ' ').trim() || null,
    year: yearMatch ? yearMatch[0].match(/(19|20)\d{2}/)?.[0] || null : null,
    services,
  }
}

/** Demo enrichment for fictional sample domains — no network. */
export function demoEnrich(lead: RawLead, domain: string | null): EnrichmentSnapshot {
  const now = new Date().toISOString()
  const yr = lead.yearFounded != null ? String(lead.yearFounded) : null
  const services =
    lead.industry
      ? `${lead.industry} services for local commercial & residential clients`
      : null
  const corpus = [
    services,
    lead.siteSnippet,
    lead.saleSignal,
    lead.licenses,
    lead.customerConcentration,
    lead.locations != null ? `${lead.locations} locations` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return {
    domain,
    live: !!domain,
    robotsAllowed: true,
    source: 'demo',
    email: fc(lead.email ? String(lead.email) : null, lead.email ? 0.7 : 0.2),
    phone: fc(lead.phone ? String(lead.phone) : null, lead.phone ? 0.75 : 0.15),
    yearFounded: fc(yr, yr ? 0.85 : 0.3),
    services: fc(services, lead.industry ? 0.55 : 0.1),
    ...dealFieldsFromLead(lead, corpus),
    lastVerified: now,
    notes: [
      'Demo enrichment (fictional .example domain — no live crawl)',
      'Deal signals from CSV + demo heuristics (not live press/court data)',
    ],
  }
}

export type CacheStore = {
  get: (domain: string) => Promise<{ payload: string; expiresAt: Date; robotsAllowed: boolean } | null>
  set: (domain: string, payload: EnrichmentSnapshot, robotsAllowed: boolean, expiresAt: Date) => Promise<void>
}

export async function enrichFromWebsite(
  lead: RawLead,
  opts?: { cache?: CacheStore; forceLive?: boolean },
): Promise<EnrichmentSnapshot> {
  const domain = normalizeDomain(lead.website, lead.email)
  const now = new Date()

  if (!domain) {
    return {
      domain: null,
      live: false,
      robotsAllowed: false,
      source: 'skipped',
      email: fc(lead.email ? String(lead.email) : null, 0.4),
      phone: fc(lead.phone ? String(lead.phone) : null, 0.4),
      yearFounded: fc(lead.yearFounded != null ? String(lead.yearFounded) : null, 0.4),
      services: fc(null, 0),
      ...dealFieldsFromLead(lead),
      lastVerified: now.toISOString(),
      notes: ['No website/domain to crawl'],
    }
  }

  if (domain.endsWith('.example') || domain.includes('example.')) {
    return demoEnrich(lead, domain)
  }

  if (opts?.cache && !opts.forceLive) {
    const hit = await opts.cache.get(domain)
    if (hit && hit.expiresAt > now) {
      const snap = JSON.parse(hit.payload) as EnrichmentSnapshot
      return { ...snap, source: 'cache', lastVerified: snap.lastVerified }
    }
  }

  const origin = `https://${domain}`
  const allowed = await robotsAllows(origin, '/')
  if (!allowed) {
    const blocked: EnrichmentSnapshot = {
      domain,
      live: false,
      robotsAllowed: false,
      source: 'skipped',
      email: fc(lead.email ? String(lead.email) : null, 0.35),
      phone: fc(lead.phone ? String(lead.phone) : null, 0.35),
      yearFounded: fc(lead.yearFounded != null ? String(lead.yearFounded) : null, 0.35),
      services: fc(null, 0),
      ...dealFieldsFromLead(lead),
      lastVerified: now.toISOString(),
      notes: ['Blocked by robots.txt — kept CSV fields only'],
    }
    if (opts?.cache) {await opts.cache.set(domain, blocked, false, new Date(now.getTime() + CACHE_TTL_MS))}
    return blocked
  }

  const wait = MIN_GAP_MS - (Date.now() - lastFetchAt)
  if (wait > 0) {await delay(wait)}

  try {
    lastFetchAt = Date.now()
    const res = await fetch(origin, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'CapraeLeadTriageBot/1.0 (+handbook-demo; respectful)',
        Accept: 'text/html',
      },
      redirect: 'follow',
    })
    const live = res.ok
    const html = live ? await res.text() : ''
    const slice = html.slice(0, 400_000)
    const extracted = live
      ? extractFromHtml(slice)
      : { email: null, phone: null, year: null, services: null }
    const corpus = live ? extractDealCorpusFromHtml(slice) : ''

    const snap: EnrichmentSnapshot = {
      domain,
      live,
      robotsAllowed: true,
      source: 'live',
      email: fc(extracted.email || (lead.email ? String(lead.email) : null), extracted.email ? 0.9 : lead.email ? 0.5 : 0.1),
      phone: fc(extracted.phone || (lead.phone ? String(lead.phone) : null), extracted.phone ? 0.85 : lead.phone ? 0.5 : 0.1),
      yearFounded: fc(
        extracted.year || (lead.yearFounded != null ? String(lead.yearFounded) : null),
        extracted.year ? 0.8 : lead.yearFounded != null ? 0.55 : 0.15,
      ),
      services: fc(extracted.services, extracted.services ? 0.65 : 0.1),
      ...dealFieldsFromLead(lead, corpus),
      lastVerified: now.toISOString(),
      notes: live
        ? ['Live fetch OK', 'Deal cues from public site text (heuristic — verify)']
        : [`HTTP ${res.status}`],
    }
    if (opts?.cache) {await opts.cache.set(domain, snap, true, new Date(now.getTime() + CACHE_TTL_MS))}
    return snap
  } catch (e) {
    const snap: EnrichmentSnapshot = {
      domain,
      live: false,
      robotsAllowed: true,
      source: 'live',
      email: fc(lead.email ? String(lead.email) : null, 0.35),
      phone: fc(lead.phone ? String(lead.phone) : null, 0.35),
      yearFounded: fc(lead.yearFounded != null ? String(lead.yearFounded) : null, 0.35),
      services: fc(null, 0),
      ...dealFieldsFromLead(lead),
      lastVerified: now.toISOString(),
      notes: [`Fetch failed: ${e instanceof Error ? e.message : 'error'}`],
    }
    if (opts?.cache) {await opts.cache.set(domain, snap, true, new Date(now.getTime() + CACHE_TTL_MS))}
    return snap
  }
}

/** Merge enrichment into RawLead for re-scoring (prefer higher-confidence values). */
export function applyEnrichment(lead: RawLead, snap: EnrichmentSnapshot): RawLead {
  const next = { ...lead }
  if (snap.email.value && snap.email.confidence >= 0.5) {next.email = snap.email.value}
  if (snap.phone.value && snap.phone.confidence >= 0.5) {next.phone = snap.phone.value}
  if (snap.yearFounded.value && snap.yearFounded.confidence >= 0.5) {next.yearFounded = snap.yearFounded.value}
  return next
}
