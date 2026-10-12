import type { ScoredLead } from '@/lib/scoring'

/** Tokens available from upstream lead context (and aliases). */
export const INTERPOLATION_TOKENS: { token: string; desc: string }[] = [
  { token: '{{company}}', desc: 'Company name' },
  { token: '{{lead.company}}', desc: 'Same as company' },
  { token: '{{owner}}', desc: 'Owner / contact name' },
  { token: '{{lead.ownerName}}', desc: 'Same as owner' },
  { token: '{{email}}', desc: 'Contact email' },
  { token: '{{lead.email}}', desc: 'Same as email' },
  { token: '{{industry}}', desc: 'Industry' },
  { token: '{{city}}', desc: 'City' },
  { token: '{{state}}', desc: 'State' },
  { token: '{{score}}', desc: 'Fit score 0–100' },
  { token: '{{tier}}', desc: 'A / B / C' },
  { token: '{{whyNow}}', desc: 'Acquisition why-now line' },
  { token: '{{tags}}', desc: 'Comma-separated tags' },
  { token: '{{id}}', desc: 'Lead id' },
  { token: '{{phone}}', desc: 'Phone' },
  { token: '{{website}}', desc: 'Website' },
  { token: '{{title}}', desc: 'Job title' },
]

function tokenMap(lead: ScoredLead): Record<string, string> {
  const l = lead?.lead || {}
  const company = String(l.company || '')
  const owner = String(l.ownerName || '')
  const email = String(l.email || '')
  const industry = String(l.industry || '')
  const city = String(l.city || '')
  const state = String(l.state || '')
  const tags = Array.isArray(lead.tags) ? lead.tags.join(', ') : ''
  return {
    company,
    'lead.company': company,
    owner,
    'lead.ownerName': owner,
    email,
    'lead.email': email,
    industry,
    'lead.industry': industry,
    city,
    'lead.city': city,
    state,
    'lead.state': state,
    score: String(lead?.score ?? ''),
    tier: String(lead?.tier ?? ''),
    whyNow: String(lead?.whyNow || ''),
    tags,
    id: String(lead?.id || ''),
    phone: String(l.phone || ''),
    website: String(l.website || ''),
    title: String(l.title || ''),
  }
}

/** Replace {{token}} / {{lead.field}} from scored lead context. Unknown tokens left as-is. */
export function interpolate(tpl: string, lead: ScoredLead): string {
  const map = tokenMap(lead)
  return String(tpl || '').replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (full, key: string) => {
    if (Object.prototype.hasOwnProperty.call(map, key)) {return map[key]}
    return full
  })
}

/** Build a JSON-ready lead payload for webhooks / sheets. */
export function leadPayload(lead: ScoredLead): Record<string, unknown> {
  return {
    id: lead.id,
    company: lead.lead.company,
    ownerName: lead.lead.ownerName,
    email: lead.lead.email,
    phone: lead.lead.phone,
    industry: lead.lead.industry,
    city: lead.lead.city,
    state: lead.lead.state,
    website: lead.lead.website,
    title: lead.lead.title,
    score: lead.score,
    tier: lead.tier,
    whyNow: lead.whyNow,
    tags: lead.tags,
    reasons: lead.reasons,
  }
}
