'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import {
  GoogleSheetsLogo,
  HubSpotLogo,
  PipedriveLogo,
  SalesforceLogo,
} from '@/components/BrandLogos'

export type ClientIntegrations = {
  googleSheetsWebhook: string
  hubspotEnabled: boolean
  salesforceEnabled: boolean
  pipedriveEnabled: boolean
}

const KEY = 'sq-integrations-v2'

const DEFAULTS: ClientIntegrations = {
  googleSheetsWebhook: '',
  hubspotEnabled: false,
  salesforceEnabled: false,
  pipedriveEnabled: false,
}

export function loadIntegrations(): ClientIntegrations {
  if (typeof window === 'undefined') {
    return DEFAULTS
  }
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem('sq-integrations-v1')
    if (!raw) {
      return DEFAULTS
    }
    const parsed = JSON.parse(raw) as Partial<ClientIntegrations>
    return {
      ...DEFAULTS,
      ...parsed,
      googleSheetsWebhook: parsed.googleSheetsWebhook || '',
    }
  } catch {
    return DEFAULTS
  }
}

export function saveIntegrations(next: ClientIntegrations) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

function IntegrationTile({
  name,
  description,
  Logo,
  connected,
  soon,
  children,
}: {
  name: string
  description: string
  Logo: typeof HubSpotLogo
  connected?: boolean
  soon?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--sq-border)] bg-[var(--ash-900)] p-3">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-[var(--sq-border)] bg-[var(--ash-850)]">
          <Logo className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-white">{name}</p>
            {connected ? (
              <span className="badge badge-ok">
                <Check className="size-3" strokeWidth={2} />
                Connected
              </span>
            ) : null}
            {soon ? <span className="badge badge-tier-c">OAuth soon</span> : null}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--sq-text-muted)]">{description}</p>
        </div>
      </div>
      {children ? <div className="mt-3 pl-[3.25rem]">{children}</div> : null}
    </div>
  )
}

export function IntegrationsMenu({
  value,
  onChange,
}: {
  value: ClientIntegrations
  onChange: (next: ClientIntegrations) => void
}) {
  const [open, setOpen] = useState(false)
  const sheetsOn = Boolean(value.googleSheetsWebhook.trim())
  const anyOn =
    sheetsOn || value.hubspotEnabled || value.salesforceEnabled || value.pipedriveEnabled

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest?.('[data-integrations-menu]')) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function toggleFlag(key: keyof Pick<
    ClientIntegrations,
    'hubspotEnabled' | 'salesforceEnabled' | 'pipedriveEnabled'
  >) {
    const next = { ...value, [key]: !value[key] }
    onChange(next)
    saveIntegrations(next)
  }

  return (
    <div className="relative" data-integrations-menu>
      <button
        type="button"
        className="btn btn-ghost"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <span className="flex -space-x-1">
          <HubSpotLogo className="size-4 rounded-sm bg-[var(--ash-900)] ring-1 ring-[var(--sq-border)]" />
          <SalesforceLogo className="size-4 rounded-sm bg-[var(--ash-900)] ring-1 ring-[var(--sq-border)]" />
        </span>
        Connect
        {anyOn && <Check className="size-3 text-[var(--ok)]" strokeWidth={2.5} />}
        <ChevronDown className="size-3.5 opacity-60" strokeWidth={1.75} />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(400px,92vw)] rounded-[var(--radius)] border border-[var(--sq-border)] bg-[var(--ash-850)] p-3 shadow-xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--sq-text-muted)]">
            CRM & data connections
          </p>
          <p className="mt-1 text-[12px] text-[var(--sq-text-secondary)]">
            Wire live sync or export per lead from the list expand panel.
          </p>

          <div className="mt-3 space-y-3">
            <IntegrationTile
              name="Google Sheets"
              Logo={GoogleSheetsLogo}
              connected={sheetsOn}
              description="Zapier, Make, or Apps Script webhook — CRM push nodes append rows as JSON."
            >
              <label className="sq-field">
                <span>Webhook URL</span>
                <input
                  className="field"
                  type="url"
                  placeholder="https://hooks.zapier.com/…"
                  value={value.googleSheetsWebhook}
                  onChange={e => {
                    const next = { ...value, googleSheetsWebhook: e.target.value }
                    onChange(next)
                    saveIntegrations(next)
                  }}
                />
              </label>
            </IntegrationTile>

            <IntegrationTile
              name="HubSpot"
              Logo={HubSpotLogo}
              connected={value.hubspotEnabled}
              soon
              description="Mark ready for OAuth; today use CRM push + HubSpot workflow URL or CSV export."
            >
              <button
                type="button"
                className="btn btn-ghost text-[12px]"
                onClick={() => toggleFlag('hubspotEnabled')}
              >
                {value.hubspotEnabled ? 'Disconnect' : 'Mark as connected (demo)'}
              </button>
            </IntegrationTile>

            <IntegrationTile
              name="Salesforce"
              Logo={SalesforceLogo}
              connected={value.salesforceEnabled}
              soon
              description="Salesforce preset export + HTTP node to your REST endpoint."
            >
              <button
                type="button"
                className="btn btn-ghost text-[12px]"
                onClick={() => toggleFlag('salesforceEnabled')}
              >
                {value.salesforceEnabled ? 'Disconnect' : 'Mark as connected (demo)'}
              </button>
            </IntegrationTile>

            <IntegrationTile
              name="Pipedrive"
              Logo={PipedriveLogo}
              connected={value.pipedriveEnabled}
              soon
              description="Pipedrive column mapping in Export — one-click CSV per lead."
            >
              <button
                type="button"
                className="btn btn-ghost text-[12px]"
                onClick={() => toggleFlag('pipedriveEnabled')}
              >
                {value.pipedriveEnabled ? 'Disconnect' : 'Mark as connected (demo)'}
              </button>
            </IntegrationTile>
          </div>
        </div>
      )}
    </div>
  )
}
