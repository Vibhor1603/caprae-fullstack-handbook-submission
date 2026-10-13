import type { LucideIcon } from 'lucide-react'
import {
  BadgeCheck,
  Building2,
  Briefcase,
  Calendar,
  CircleDot,
  DollarSign,
  Globe,
  Link2,
  Mail,
  MapPin,
  Phone,
  User,
  Users,
} from 'lucide-react'
import type { EnrichmentSnapshot } from '@/lib/enrichment'
import type { RawLead } from '@/lib/scoring'

export type LeadFact = {
  key: string
  label: string
  value: string
  icon: LucideIcon
  /** Apple-style: vivid icon color, not a peach wash on everything */
  color: string
  /** Set when enrich ran — confidence the value is correct (0–1). */
  confidence?: number
}

const KNOWN: { key: string; label: string; icon: LucideIcon; color: string }[] = [
  { key: 'company', label: 'Company', icon: Building2, color: '#fb923c' },
  { key: 'industry', label: 'Industry', icon: Briefcase, color: '#a78bfa' },
  { key: 'ownerName', label: 'Contact', icon: User, color: '#4ade80' },
  { key: 'title', label: 'Title', icon: BadgeCheck, color: '#22d3ee' },
  { key: 'email', label: 'Email', icon: Mail, color: '#60a5fa' },
  { key: 'phone', label: 'Phone', icon: Phone, color: '#34d399' },
  { key: 'linkedin', label: 'LinkedIn', icon: Link2, color: '#818cf8' },
  { key: 'website', label: 'Website', icon: Globe, color: '#2dd4bf' },
  { key: 'city', label: 'City', icon: MapPin, color: '#f472b6' },
  { key: 'state', label: 'State', icon: MapPin, color: '#f472b6' },
  { key: 'country', label: 'Country', icon: MapPin, color: '#f472b6' },
  { key: 'employees', label: 'Employees', icon: Users, color: '#fbbf24' },
  { key: 'revenue', label: 'Revenue', icon: DollarSign, color: '#facc15' },
  { key: 'yearFounded', label: 'Founded', icon: Calendar, color: '#94a3b8' },
]

const KNOWN_KEYS = new Set(KNOWN.map(k => k.key))
const HINTS: { test: RegExp; icon: LucideIcon; color: string }[] = [
  { test: /mail|email/i, icon: Mail, color: '#60a5fa' },
  { test: /phone|tel|mobile/i, icon: Phone, color: '#34d399' },
  { test: /linkedin/i, icon: Link2, color: '#818cf8' },
  { test: /web|url|site|domain/i, icon: Globe, color: '#2dd4bf' },
  { test: /city|state|country|location|address|geo/i, icon: MapPin, color: '#f472b6' },
  { test: /emp|headcount|size|staff/i, icon: Users, color: '#fbbf24' },
  { test: /rev|arr|mrr|sales|dollar|money/i, icon: DollarSign, color: '#facc15' },
  { test: /year|found|established|since/i, icon: Calendar, color: '#94a3b8' },
  { test: /indust|sector|vertical/i, icon: Briefcase, color: '#a78bfa' },
  { test: /company|org|business/i, icon: Building2, color: '#fb923c' },
  { test: /name|owner|contact|person/i, icon: User, color: '#4ade80' },
  { test: /title|role|job/i, icon: BadgeCheck, color: '#22d3ee' },
]

function humanize(key: string) {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function fmt(value: unknown): string | null {
  if (value === undefined || value === null) {return null}
  const s = String(value).trim()
  return s ? s : null
}

function styleForKey(key: string): { icon: LucideIcon; color: string } {
  for (const h of HINTS) {
    if (h.test.test(key)) {return { icon: h.icon, color: h.color }}
  }
  return { icon: CircleDot, color: '#a1a1aa' }
}

export function factsFromLead(lead: RawLead): LeadFact[] {
  const row = lead as Record<string, unknown>
  const out: LeadFact[] = []
  const seen = new Set<string>()

  for (const { key, label, icon, color } of KNOWN) {
    const v = fmt(row[key])
    if (!v) {continue}
    out.push({ key, label, value: v, icon, color })
    seen.add(key)
  }

  for (const [key, raw] of Object.entries(row)) {
    if (KNOWN_KEYS.has(key) || seen.has(key) || key === 'id') {continue}
    const v = fmt(raw)
    if (!v) {continue}
    const style = styleForKey(key)
    out.push({ key, label: humanize(key), value: v, icon: style.icon, color: style.color })
    seen.add(key)
  }

  return out
}

const ENRICH_CONF_KEYS = ['email', 'phone', 'yearFounded'] as const

/** Single profile grid: CSV facts plus enrich confidence inline (no duplicate blocks). */
export function factsWithEnrichment(
  lead: RawLead,
  enrichment?: EnrichmentSnapshot | null,
): LeadFact[] {
  const facts = factsFromLead(lead)
  if (!enrichment) {
    return facts
  }

  const confByKey: Record<string, number> = {
    email: enrichment.email.confidence,
    phone: enrichment.phone.confidence,
    yearFounded: enrichment.yearFounded.confidence,
  }
  const valueByKey: Record<string, string | null> = {
    email: enrichment.email.value,
    phone: enrichment.phone.value,
    yearFounded: enrichment.yearFounded.value,
  }

  const out = facts.map(f => {
    const enrichedVal = valueByKey[f.key]
    const conf = confByKey[f.key]
    return {
      ...f,
      value: enrichedVal?.trim() ? enrichedVal : f.value,
      confidence: conf != null && conf > 0 ? conf : f.confidence,
    }
  })

  const hasServices = out.some(f => f.key === 'services' || /services/i.test(f.key))
  if (enrichment.services.value?.trim() && !hasServices) {
    out.push({
      key: 'services',
      label: 'Services',
      value: enrichment.services.value,
      icon: Briefcase,
      color: '#c084fc',
      confidence: enrichment.services.confidence,
    })
  }

  return out
}

export function locationLine(lead: RawLead): string | null {
  const parts = [lead.city, lead.state, lead.country].map(fmt).filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

export function contactLine(lead: RawLead): string {
  const people = [lead.ownerName, lead.title].map(fmt).filter(Boolean)
  return people.length ? people.join(' · ') : 'No contact on file'
}
