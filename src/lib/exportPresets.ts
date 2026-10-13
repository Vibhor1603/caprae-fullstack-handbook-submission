/**
 * One-click CRM / Sheets export column mappings.
 */
import type { ScoredLead } from '@/lib/scoring'
import { normalizeDomain } from '@/lib/scoring'
import { stageLabel } from '@/lib/pipeline'

export type ExportPresetId =
  | 'hubspot'
  | 'salesforce'
  | 'pipedrive'
  | 'google_sheets'
  | 'generic_csv'

export type ExportColumn = {
  header: string
  /** Dot path into a flat export record */
  key: keyof FlatExportRow
}

export type FlatExportRow = {
  company: string
  website: string
  ownerName: string
  title: string
  email: string
  phone: string
  industry: string
  city: string
  state: string
  country: string
  employees: string
  revenue: string
  yearFounded: string
  score: number
  tier: string
  stage: string
  stageLabel: string
  whyNow: string
  tags: string
  reasons: string
}

export type ExportPreset = {
  id: ExportPresetId
  label: string
  description: string
  columns: ExportColumn[]
}

function flatRow(s: ScoredLead): FlatExportRow {
  const stage = s.stage || 'new'
  return {
    company: String(s.lead.company ?? ''),
    website: normalizeDomain(s.lead.website, s.lead.email) ?? String(s.lead.website ?? ''),
    ownerName: String(s.lead.ownerName ?? ''),
    title: String(s.lead.title ?? ''),
    email: String(s.lead.email ?? ''),
    phone: String(s.lead.phone ?? ''),
    industry: String(s.lead.industry ?? ''),
    city: String(s.lead.city ?? ''),
    state: String(s.lead.state ?? ''),
    country: String(s.lead.country ?? ''),
    employees: String(s.lead.employees ?? ''),
    revenue: String(s.lead.revenue ?? ''),
    yearFounded: String(s.lead.yearFounded ?? ''),
    score: s.score,
    tier: s.tier,
    stage,
    stageLabel: stageLabel(stage),
    whyNow: s.whyNow || '',
    tags: (s.tags || []).join(', '),
    reasons: (s.reasons || []).join('; '),
  }
}

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'hubspot',
    label: 'HubSpot',
    description: 'Company + contact properties for HubSpot import',
    columns: [
      { header: 'Company name', key: 'company' },
      { header: 'Website URL', key: 'website' },
      { header: 'Contact name', key: 'ownerName' },
      { header: 'Job title', key: 'title' },
      { header: 'Email', key: 'email' },
      { header: 'Phone number', key: 'phone' },
      { header: 'Industry', key: 'industry' },
      { header: 'City', key: 'city' },
      { header: 'State/Region', key: 'state' },
      { header: 'Lead score', key: 'score' },
      { header: 'Lead tier', key: 'tier' },
      { header: 'Deal stage', key: 'stageLabel' },
      { header: 'Why now', key: 'whyNow' },
      { header: 'Tags', key: 'tags' },
    ],
  },
  {
    id: 'salesforce',
    label: 'Salesforce',
    description: 'Lead object-oriented CSV for Salesforce Data Import',
    columns: [
      { header: 'Company', key: 'company' },
      { header: 'Website', key: 'website' },
      { header: 'LastName', key: 'ownerName' },
      { header: 'Title', key: 'title' },
      { header: 'Email', key: 'email' },
      { header: 'Phone', key: 'phone' },
      { header: 'Industry', key: 'industry' },
      { header: 'City', key: 'city' },
      { header: 'State', key: 'state' },
      { header: 'Country', key: 'country' },
      { header: 'NumberOfEmployees', key: 'employees' },
      { header: 'AnnualRevenue', key: 'revenue' },
      { header: 'LeadSource', key: 'tier' },
      { header: 'Status', key: 'stageLabel' },
      { header: 'Description', key: 'whyNow' },
    ],
  },
  {
    id: 'pipedrive',
    label: 'Pipedrive',
    description: 'Organization + person fields for Pipedrive spreadsheet import',
    columns: [
      { header: 'Organization', key: 'company' },
      { header: 'Person', key: 'ownerName' },
      { header: 'Email', key: 'email' },
      { header: 'Phone', key: 'phone' },
      { header: 'Title', key: 'title' },
      { header: 'Website', key: 'website' },
      { header: 'Industry', key: 'industry' },
      { header: 'Label', key: 'tier' },
      { header: 'Pipeline stage', key: 'stageLabel' },
      { header: 'Notes', key: 'whyNow' },
    ],
  },
  {
    id: 'google_sheets',
    label: 'Google Sheets',
    description: 'Wide row for Sheets / Make / Zapier',
    columns: [
      { header: 'Company', key: 'company' },
      { header: 'Website', key: 'website' },
      { header: 'Owner', key: 'ownerName' },
      { header: 'Role', key: 'title' },
      { header: 'Email', key: 'email' },
      { header: 'Phone', key: 'phone' },
      { header: 'Industry', key: 'industry' },
      { header: 'State', key: 'state' },
      { header: 'Employees', key: 'employees' },
      { header: 'Revenue', key: 'revenue' },
      { header: 'Founded', key: 'yearFounded' },
      { header: 'Score', key: 'score' },
      { header: 'Tier', key: 'tier' },
      { header: 'Stage', key: 'stageLabel' },
      { header: 'Why now', key: 'whyNow' },
      { header: 'Reasons', key: 'reasons' },
    ],
  },
  {
    id: 'generic_csv',
    label: 'Generic CSV',
    description: 'All deal-sourcing fields for any CRM',
    columns: [
      { header: 'company', key: 'company' },
      { header: 'website', key: 'website' },
      { header: 'owner_name', key: 'ownerName' },
      { header: 'title', key: 'title' },
      { header: 'email', key: 'email' },
      { header: 'phone', key: 'phone' },
      { header: 'industry', key: 'industry' },
      { header: 'city', key: 'city' },
      { header: 'state', key: 'state' },
      { header: 'country', key: 'country' },
      { header: 'employees', key: 'employees' },
      { header: 'revenue', key: 'revenue' },
      { header: 'year_founded', key: 'yearFounded' },
      { header: 'score', key: 'score' },
      { header: 'tier', key: 'tier' },
      { header: 'stage', key: 'stage' },
      { header: 'why_now', key: 'whyNow' },
      { header: 'tags', key: 'tags' },
    ],
  },
]

export function getPreset(id: string): ExportPreset | undefined {
  return EXPORT_PRESETS.find(p => p.id === id)
}

export function mapLeadsToPreset(
  leads: ScoredLead[],
  presetId: ExportPresetId | string,
): Record<string, string | number>[] {
  const preset = getPreset(presetId) || EXPORT_PRESETS[EXPORT_PRESETS.length - 1]
  return leads
    .filter(s => !s.junk && !s.duplicateOf)
    .map(s => {
      const row = flatRow(s)
      const out: Record<string, string | number> = {}
      for (const col of preset.columns) {
        out[col.header] = row[col.key]
      }
      return out
    })
}

export function previewMapping(
  leads: ScoredLead[],
  presetId: ExportPresetId | string,
  sampleSize = 3,
): { preset: ExportPreset; headers: string[]; rows: Record<string, string | number>[] } {
  const preset = getPreset(presetId) || EXPORT_PRESETS[0]
  const rows = mapLeadsToPreset(leads, preset.id).slice(0, sampleSize)
  return {
    preset,
    headers: preset.columns.map(c => c.header),
    rows,
  }
}
