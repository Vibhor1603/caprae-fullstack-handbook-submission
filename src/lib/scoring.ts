/**
 * Deal-sourcing triage for ETA / search-fund buyers.
 * Clean → fuzzy+domain dedupe → junk → acquisition-fit score with why-now.
 * Pure functions, no I/O. Tunable ICP lives here.
 */
import { isFuzzyCompanyMatch, normalizeCompany } from '@/lib/fuzzy'

export interface RawLead {
  company?: string; website?: string; industry?: string; city?: string; state?: string; country?: string
  employees?: string | number; revenue?: string | number; ownerName?: string; title?: string
  email?: string; phone?: string; linkedin?: string; yearFounded?: string | number
  /** Extra CSV columns pass through for flexible display. */
  [key: string]: string | number | undefined
}

export interface Icp {
  industries: string[]
  countries: string[]
  employees: [number, number]
  revenueUsd: [number, number]
  minYearsInBusiness?: number
  decisionMakerTitles: string[]
  /** Succession / acquisition signal: treat businesses older than this as stronger. */
  successionYears?: number
}

export const DEFAULT_ICP: Icp = {
  industries: ['hvac', 'plumbing', 'landscaping', 'manufacturing', 'logistics', 'accounting'],
  countries: ['us', 'united states', 'usa'],
  employees: [10, 200],
  revenueUsd: [1_000_000, 50_000_000],
  minYearsInBusiness: 10,
  decisionMakerTitles: ['owner', 'founder', 'ceo', 'president', 'principal'],
  successionYears: 15,
}

export interface ScoredLead {
  id: string
  lead: RawLead
  score: number
  tier: 'A' | 'B' | 'C'
  reasons: string[]
  junk: boolean
  junkReasons: string[]
  duplicateOf?: string
  /** One-line acquisition timing narrative for searchers. */
  whyNow: string
  tags: string[]
}

export interface TriageSummary {
  total: number
  clean: number
  junk: number
  duplicates: number
  tierA: number
  tierB: number
  tierC: number
}

export const MAX_REASONS = 6
/** Strong enough to surface below perfect work-email peers after clamp. */
export const FREE_MAIL_PENALTY = -18

const FREE_MAIL = new Set(['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'])
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i
const GENERIC_LOCAL = /^(info|noreply|no-reply|admin|support|sales|contact|hello)@/
const SUCCESSOR_HINT = /\b(jr|junior|ii|iii|successor|son|daughter|heir)\b/i
const STABLE_INDUSTRIES = ['hvac', 'plumbing', 'landscaping', 'accounting', 'manufacturing', 'logistics', 'electrical', 'roofing']

export function parseNumber(v: unknown): number | null {
  if (v === undefined || v === null || v === '') {return null}
  if (typeof v === 'number') {return Number.isFinite(v) ? v : null}
  const s = String(v).trim().toLowerCase().replace(/[$,\s]/g, '')
  const range = s.match(/^(\d+(?:\.\d+)?)([km]?)-(\d+(?:\.\d+)?)([km]?)$/)
  const mult = (u: string) => (u === 'k' ? 1e3 : u === 'm' ? 1e6 : 1)
  if (range) {return (parseFloat(range[1]) * mult(range[2] || range[4]) + parseFloat(range[3]) * mult(range[4])) / 2}
  const m = s.match(/^(\d+(?:\.\d+)?)([kmb]?)\+?$/)
  if (!m) {return null}
  return parseFloat(m[1]) * (m[2] === 'b' ? 1e9 : mult(m[2]))
}

export function isFreeMail(email?: string): boolean {
  const domain = norm(email).split('@')[1]
  return !!domain && FREE_MAIL.has(domain)
}

export function normalizeDomain(website?: string, email?: string): string | null {
  const src = website?.trim() || (email && !isFreeMail(email) ? email.split('@')[1] : '')
  if (!src) {return null}
  return src.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0] || null
}

export function normalizePhone(p?: string): string | null {
  const d = (p ?? '').replace(/\D/g, '')
  if (d.length < 10) {return null}
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d
}

const norm = (s?: string) => (s ?? '').trim().toLowerCase()
const companyKey = (s?: string) => normalizeCompany(s)

export function junkReasons(l: RawLead): string[] {
  const r: string[] = []
  if (!norm(l.company)) {r.push('Missing company name')}
  const email = norm(l.email)
  const phone = normalizePhone(l.phone)
  if (email && !EMAIL_RE.test(email)) {r.push('Malformed email')}
  if (!email && !phone && !norm(l.linkedin)) {r.push('No way to contact (no email, phone, or LinkedIn)')}
  if (/^(info|noreply|no-reply|admin|support)@/.test(email) && !phone) {r.push('Only a generic inbox, no phone')}
  return r
}

function reasonPts(line: string): number {
  const m = line.match(/^([+-]?\d+)\s/)
  return m ? Number(m[1]) : 0
}

export function capReasons(reasons: string[], max = MAX_REASONS): string[] {
  if (reasons.length <= max) {return reasons}
  const indexed = reasons.map((r, i) => ({ r, i, pts: reasonPts(r), abs: Math.abs(reasonPts(r)) }))
  const penalties = indexed.filter(x => x.pts < 0)
  const restSlots = Math.max(0, max - penalties.length)
  const positives = indexed
    .filter(x => x.pts >= 0)
    .sort((a, b) => b.abs - a.abs || a.i - b.i)
    .slice(0, restSlots)
  return [...penalties, ...positives].sort((a, b) => a.i - b.i).map(x => x.r)
}

/** One-line “why now” for ETA buyers — succession + fit timing. */
export function whyNowLine(l: RawLead, icp: Icp = DEFAULT_ICP, now = new Date()): string {
  const yr = parseNumber(l.yearFounded)
  const age = yr ? now.getFullYear() - yr : null
  const title = norm(l.title)
  const founderLike = /\b(owner|founder|principal|president)\b/.test(title)
  const successorVisible = SUCCESSOR_HINT.test(String(l.ownerName || '')) || SUCCESSOR_HINT.test(title)
  const successionCut = icp.successionYears ?? 15

  if (age !== null && age >= successionCut && founderLike && !successorVisible) {
    return `${age}-yr ${l.industry || 'business'} with long-tenured ${l.title || 'owner'} and no visible successor — classic succession window.`
  }
  if (age !== null && age >= (icp.minYearsInBusiness ?? 10) && icp.industries.some(k => norm(l.industry).includes(k))) {
    return `Established ${age}-yr operator in target vertical — prioritize outreach before brokers list it.`
  }
  if (icp.countries.includes(norm(l.country)) && parseNumber(l.employees) !== null) {
    return `In-geo ${l.industry || 'company'} in your size band — worth a first conversation.`
  }
  return 'Fits ICP filters; verify contactability before spending enrichment credits.'
}

export function scoreLead(
  l: RawLead,
  icp: Icp = DEFAULT_ICP,
  now = new Date(),
): { score: number; reasons: string[]; whyNow: string } {
  let score = 0
  const reasons: string[] = []
  const add = (pts: number, why: string) => {
    score += pts
    reasons.push(`${pts >= 0 ? '+' : ''}${pts} ${why}`)
  }

  const ind = norm(l.industry)
  if (ind && icp.industries.some(k => ind.includes(k))) {add(22, `Industry match (${l.industry})`)}
  if (ind && STABLE_INDUSTRIES.some(k => ind.includes(k))) {add(6, 'Industry stability (services / essential)')}

  if (icp.countries.includes(norm(l.country))) {add(10, 'In target geography')}

  const emp = parseNumber(l.employees)
  if (emp !== null) {
    if (emp >= icp.employees[0] && emp <= icp.employees[1]) {add(14, `Headcount ${emp} in size band`)}
    else {add(-5, `Headcount ${emp} outside ${icp.employees.join('-')}`)}
  }
  const rev = parseNumber(l.revenue)
  if (rev !== null) {
    if (rev >= icp.revenueUsd[0] && rev <= icp.revenueUsd[1]) {add(18, 'Revenue estimate in range')}
    else {add(-5, 'Revenue estimate outside range')}
  }

  const yr = parseNumber(l.yearFounded)
  const age = yr ? now.getFullYear() - yr : null
  if (age !== null && icp.minYearsInBusiness && age >= icp.minYearsInBusiness) {
    add(8, `Established (${age} yrs)`)
  }
  const successionCut = icp.successionYears ?? 15
  if (age !== null && age >= successionCut) {add(10, `Succession window (${age} yrs in business)`)}

  const title = norm(l.title)
  const founderLike = title && icp.decisionMakerTitles.some(t => title.includes(t))
  if (founderLike) {add(10, 'Contact is a decision maker / owner')}
  const successorVisible = SUCCESSOR_HINT.test(String(l.ownerName || '')) || SUCCESSOR_HINT.test(title)
  if (founderLike && !successorVisible && age !== null && age >= successionCut) {
    add(8, 'No visible successor on file')
  }

  const email = norm(l.email)
  const free = isFreeMail(email)
  if (email && EMAIL_RE.test(email) && !GENERIC_LOCAL.test(email) && !free) {add(5, 'Direct work email')}
  if (free) {add(FREE_MAIL_PENALTY, 'Free-mail domain (enrich carefully)')}

  if (normalizePhone(l.phone)) {add(3, 'Phone available')}
  if (norm(l.linkedin)) {add(2, 'LinkedIn available')}

  const capped = capReasons(reasons)
  return {
    score: Math.max(0, Math.min(100, score)),
    reasons: capped,
    whyNow: whyNowLine(l, icp, now),
  }
}

export const tierOf = (s: number): 'A' | 'B' | 'C' => (s >= 70 ? 'A' : s >= 45 ? 'B' : 'C')

export function triage(leads: RawLead[], icp: Icp = DEFAULT_ICP, now = new Date()): ScoredLead[] {
  const seen = new Map<string, string>()
  const winners: { id: string; company?: string; state?: string }[] = []

  const out = leads.map((lead, i): ScoredLead => {
    const id = `L${i + 1}`
    const keys = [
      normalizeDomain(lead.website, lead.email),
      normalizePhone(lead.phone),
      companyKey(lead.company) && `${companyKey(lead.company)}|${norm(lead.state)}`,
    ].filter(Boolean) as string[]

    let dupe = keys.map(k => seen.get(k)).find(Boolean)
    if (!dupe) {
      const fuzzy = winners.find(
        w =>
          norm(w.state) === norm(lead.state) &&
          isFuzzyCompanyMatch(w.company, lead.company),
      )
      if (fuzzy) {dupe = fuzzy.id}
    }
    keys.forEach(k => {
      if (!seen.has(k)) {seen.set(k, id)}
    })
    if (!dupe) {winners.push({ id, company: lead.company, state: lead.state })}

    const jr = junkReasons(lead)
    const { score, reasons, whyNow } = scoreLead(lead, icp, now)
    return {
      id,
      lead,
      score,
      tier: tierOf(score),
      reasons,
      junk: jr.length > 0,
      junkReasons: jr,
      duplicateOf: dupe,
      whyNow,
      tags: [],
    }
  })
  return out.sort((a, b) => Number(a.junk || !!a.duplicateOf) - Number(b.junk || !!b.duplicateOf) || b.score - a.score)
}

export function rescore(scored: ScoredLead[], icp: Icp, now = new Date()): ScoredLead[] {
  return scored
    .map(s => {
      const { score, reasons, whyNow } = scoreLead(s.lead, icp, now)
      return { ...s, score, tier: tierOf(score), reasons, whyNow }
    })
    .sort((a, b) => Number(a.junk || !!a.duplicateOf) - Number(b.junk || !!b.duplicateOf) || b.score - a.score)
}

export function summarize(scored: ScoredLead[]): TriageSummary {
  const clean = scored.filter(s => !s.junk && !s.duplicateOf)
  return {
    total: scored.length,
    clean: clean.length,
    junk: scored.filter(s => s.junk).length,
    duplicates: scored.filter(s => !!s.duplicateOf).length,
    tierA: clean.filter(s => s.tier === 'A').length,
    tierB: clean.filter(s => s.tier === 'B').length,
    tierC: clean.filter(s => s.tier === 'C').length,
  }
}

export function toCrmRows(scored: ScoredLead[], opts?: { tier?: 'A' | 'B' | 'C' }) {
  return scored
    .filter(s => !s.junk && !s.duplicateOf && (!opts?.tier || s.tier === opts.tier))
    .map(s => ({
      'Company name': s.lead.company ?? '',
      'Website URL': normalizeDomain(s.lead.website, s.lead.email) ?? '',
      'Contact name': s.lead.ownerName ?? '',
      'Job title': s.lead.title ?? '',
      Email: s.lead.email ?? '',
      'Phone number': s.lead.phone ?? '',
      Industry: s.lead.industry ?? '',
      'Lead score': s.score,
      'Lead tier': s.tier,
      'Why now': s.whyNow,
      'Score reasons': s.reasons.join('; '),
      Tags: (s.tags || []).join(', '),
    }))
}
