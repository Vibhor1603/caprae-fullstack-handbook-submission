'use client'

import { useEffect, useState } from 'react'
import {
  Download,
  FileBarChart,
  Mail,
  RefreshCw,
  Sheet,
  Sparkles,
  Tag,
  Webhook,
  Workflow,
} from 'lucide-react'
import Papa from 'papaparse'

type Report = {
  since: string
  summary: {
    aTierMentions: number
    workflowRuns: number
    crmPushes: number
    enrichments: number
    emailDrafts?: number
    sheetsAppends?: number
    webhooks?: number
  }
  events: { id: string; kind: string; summary: string; createdAt: string; payload?: Record<string, unknown> }[]
}

function kindMeta(kind: string): { label: string; tone: string; Icon: typeof Mail } {
  switch (kind) {
    case 'email_draft':
      return { label: 'Email draft', tone: '#4ade80', Icon: Mail }
    case 'crm_push':
      return { label: 'CRM', tone: '#34d399', Icon: Workflow }
    case 'sheets_append':
      return { label: 'Sheets', tone: '#86efac', Icon: Sheet }
    case 'webhook':
      return { label: 'Webhook', tone: '#38bdf8', Icon: Webhook }
    case 'a_tier':
      return { label: 'A-tier', tone: '#fbbf24', Icon: Sparkles }
    case 'enrich':
      return { label: 'Enrich', tone: '#22d3ee', Icon: RefreshCw }
    case 'hubspot_soon':
      return { label: 'HubSpot', tone: '#fb923c', Icon: Tag }
    default:
      return { label: kind.replace(/_/g, ' '), tone: '#a3a3a3', Icon: FileBarChart }
  }
}

export function WeeklyReport({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const r = await fetch('/api/report')
        const j = (await r.json()) as Report
        if (!cancelled) {setData(j)}
      } finally {
        if (!cancelled) {setLoading(false)}
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  function exportCsv() {
    if (!data) {return}
    const rows = data.events.map(e => ({
      When: e.createdAt,
      Kind: e.kind,
      Summary: e.summary,
    }))
    const blob = new Blob([Papa.unparse(rows)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'weekly_deal_sourcing_report.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const s = data?.summary

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--sq-text-muted)]">
            Weekly report
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-white">Deal-sourcing pulse</h2>
          <p className="mt-1 text-sm text-[var(--sq-text-secondary)]">
            Last 7 days · drafts, sheets, webhooks, CRM prep (email never auto-sent)
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={exportCsv} disabled={!data?.events.length}>
          <Download className="size-3.5" strokeWidth={1.75} />
          Export report
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {[
          { label: 'A-tier', n: s?.aTierMentions ?? 0, color: '#fbbf24' },
          { label: 'Runs', n: s?.workflowRuns ?? 0, color: '#60a5fa' },
          { label: 'Drafts', n: s?.emailDrafts ?? 0, color: '#4ade80' },
          { label: 'CRM', n: s?.crmPushes ?? 0, color: '#34d399' },
          { label: 'Sheets', n: s?.sheetsAppends ?? 0, color: '#86efac' },
          { label: 'Webhooks', n: s?.webhooks ?? 0, color: '#38bdf8' },
          { label: 'Enrich', n: s?.enrichments ?? 0, color: '#22d3ee' },
        ].map(card => (
          <div key={card.label} className="kpi-card !flex-col !gap-1">
            <p className="text-[11px] font-medium text-[var(--sq-text-muted)]">{card.label}</p>
            <p className="text-[1.5rem] font-bold tabular-nums tracking-tight" style={{ color: card.color }}>
              {loading && !data ? '—' : card.n}
            </p>
          </div>
        ))}
      </div>

      <div className="lead-sheet">
        {loading && !data && (
          <p className="px-5 py-12 text-center text-sm text-[var(--sq-text-muted)]">Loading report…</p>
        )}
        {!loading && !data?.events.length && (
          <p className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-[var(--sq-text-muted)]">
            <FileBarChart className="size-4" strokeWidth={1.75} />
            No events this week yet — run sample data or fire a workflow.
          </p>
        )}
        {data?.events.map(e => {
          const meta = kindMeta(e.kind)
          const Icon = meta.Icon
          const payload = e.payload || {}
          return (
            <div
              key={e.id}
              className="flex flex-wrap items-start gap-3 border-b border-[var(--sq-border)] px-4 py-3.5 last:border-b-0 sm:px-5"
            >
              <span
                className="icon-well icon-well-sm mt-0.5"
                style={{ background: `${meta.tone}22`, color: meta.tone }}
                aria-hidden
              >
                <Icon strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge" style={{ background: `${meta.tone}22`, color: meta.tone }}>
                    {meta.label}
                  </span>
                  <time className="text-[11px] text-[var(--sq-text-muted)]">
                    {new Date(e.createdAt).toLocaleString()}
                  </time>
                </div>
                <p className="mt-1 text-sm font-medium text-white">{e.summary}</p>
                {e.kind === 'email_draft' && (
                  <p className="mt-1 text-[12px] text-[var(--sq-text-secondary)]">
                    {payload.to ? `To ${String(payload.to)}` : 'No recipient on lead'}
                    {payload.from ? ` · From ${String(payload.from)}` : ''}
                    {payload.subject ? ` · ${String(payload.subject)}` : ''}
                    {' · '}
                    <span className="text-[var(--sq-text-muted)]">not sent</span>
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
