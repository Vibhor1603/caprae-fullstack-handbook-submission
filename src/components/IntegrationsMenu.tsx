'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown, Link2, Sheet } from 'lucide-react'

export type ClientIntegrations = {
  googleSheetsWebhook: string
  hubspotEnabled: boolean
}

const KEY = 'sq-integrations-v1'

const DEFAULTS: ClientIntegrations = {
  googleSheetsWebhook: '',
  hubspotEnabled: false,
}

export function loadIntegrations(): ClientIntegrations {
  if (typeof window === 'undefined') {return DEFAULTS}
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {return DEFAULTS}
    return { ...DEFAULTS, ...JSON.parse(raw) }
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

export function IntegrationsMenu({
  value,
  onChange,
}: {
  value: ClientIntegrations
  onChange: (next: ClientIntegrations) => void
}) {
  const [open, setOpen] = useState(false)
  const sheetsOn = Boolean(value.googleSheetsWebhook.trim())

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest?.('[data-integrations-menu]')) {setOpen(false)}
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div className="relative" data-integrations-menu>
      <button
        type="button"
        className="btn btn-ghost"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <Link2 className="size-3.5" strokeWidth={1.75} />
        Connect
        {sheetsOn && <Check className="size-3 text-[var(--ok)]" strokeWidth={2.5} />}
        <ChevronDown className="size-3.5 opacity-60" strokeWidth={1.75} />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(360px,92vw)] rounded-[var(--radius)] border border-[var(--sq-border)] bg-[var(--ash-850)] p-3 shadow-xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--sq-text-muted)]">
            Integrations
          </p>

          <div className="mt-3 space-y-3">
            <div className="rounded-[var(--radius-sm)] border border-[var(--sq-border)] bg-[var(--ash-900)] p-3">
              <div className="flex items-center gap-2">
                <span
                  className="icon-well icon-well-sm"
                  style={{ background: 'rgba(34, 197, 94, 0.14)', color: '#22c55e' }}
                >
                  <Sheet strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">Google Sheets</p>
                  <p className="text-[11px] text-[var(--sq-text-muted)]">
                    Paste a Zapier / Make / Apps Script webhook — rows POST as JSON
                  </p>
                </div>
                {sheetsOn && (
                  <span className="badge badge-ok">
                    <Check className="size-3" strokeWidth={2} />
                    On
                  </span>
                )}
              </div>
              <label className="sq-field mt-3">
                <span>Sheets webhook URL</span>
                <input
                  className="field"
                  type="url"
                  placeholder="https://hooks.zapier.com/… or Apps Script URL"
                  value={value.googleSheetsWebhook}
                  onChange={e => {
                    const next = { ...value, googleSheetsWebhook: e.target.value }
                    onChange(next)
                    saveIntegrations(next)
                  }}
                />
              </label>
              <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--sq-text-muted)]">
                Tip: Zapier “Catch Hook” → Google Sheets Create Spreadsheet Row. Or deploy an Apps Script{' '}
                <code className="text-[var(--ash-300)]">doPost</code> that appends.
              </p>
            </div>

            <div className="rounded-[var(--radius-sm)] border border-[var(--sq-border)] bg-[var(--ash-900)] p-3 opacity-90">
              <div className="flex items-center gap-2">
                <span
                  className="icon-well icon-well-sm"
                  style={{ background: 'rgba(255, 122, 89, 0.14)', color: '#ff7a59' }}
                >
                  <Link2 strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">HubSpot</p>
                  <p className="text-[11px] text-[var(--sq-text-muted)]">Native OAuth sync — coming soon</p>
                </div>
                <span className="badge badge-tier-c">Soon</span>
              </div>
              <p className="mt-2 text-[11px] text-[var(--sq-text-secondary)]">
                Today: use <strong className="font-medium text-white">CRM push</strong> CSV export, or an{' '}
                <strong className="font-medium text-white">HTTP / Webhook</strong> node aimed at a HubSpot
                workflow URL. The HubSpot canvas node prepares the row and logs intent.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
