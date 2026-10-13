'use client'

import Papa from 'papaparse'
import type { ScoredLead } from '@/lib/scoring'
import { mapLeadsToPreset, type ExportPresetId } from '@/lib/exportPresets'
import {
  GoogleSheetsLogo,
  HubSpotLogo,
  PipedriveLogo,
  SalesforceLogo,
} from '@/components/BrandLogos'

const CRM_OPTIONS: {
  id: ExportPresetId
  name: string
  Logo: typeof HubSpotLogo
}[] = [
  { id: 'hubspot', name: 'HubSpot', Logo: HubSpotLogo },
  { id: 'salesforce', name: 'Salesforce', Logo: SalesforceLogo },
  { id: 'pipedrive', name: 'Pipedrive', Logo: PipedriveLogo },
  { id: 'google_sheets', name: 'Google Sheets', Logo: GoogleSheetsLogo },
]

function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  const blob = new Blob([Papa.unparse(rows)], { type: 'text/csv' })
  const anchor = document.createElement('a')
  anchor.href = URL.createObjectURL(blob)
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(anchor.href)
}

export function LeadCrmConnectStrip({ lead }: { lead: ScoredLead }) {
  const company = (lead.lead.company || lead.id).replace(/\s+/g, '_').slice(0, 32)

  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--sq-text-muted)]">
        Connect & export
      </p>
      <div className="flex flex-wrap gap-2">
        {CRM_OPTIONS.map(({ id, name, Logo }) => (
          <button
            key={id}
            type="button"
            className="flex items-center gap-2 rounded-[var(--radius-xs)] border border-[var(--sq-border)] bg-[var(--ash-900)] px-2.5 py-2 text-left transition-colors hover:border-[var(--sq-border-strong)] hover:bg-[var(--ash-850)]"
            title={`Download ${name} CSV for this lead`}
            onClick={e => {
              e.stopPropagation()
              const rows = mapLeadsToPreset([lead], id)
              downloadCsv(`${company}_${id}.csv`, rows)
            }}
          >
            <Logo className="size-5 shrink-0" />
            <span className="text-[11px] font-medium text-[var(--sq-text-secondary)]">{name}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-[var(--sq-text-muted)]">
        Live sync: set up webhooks under <span className="text-[var(--sq-text-secondary)]">Connect</span>{' '}
        in the header, or export a row to import into your CRM.
      </p>
    </div>
  )
}
