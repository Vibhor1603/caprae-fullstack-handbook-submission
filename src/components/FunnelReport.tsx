'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Coins, GitBranch } from 'lucide-react'
import type { ScoredLead } from '@/lib/scoring'
import { buildFunnelReport } from '@/lib/funnel'
import { applySharedFilters, DEFAULT_FILTERS, type SharedFilters } from '@/lib/filters'
import { SharedFilterBar } from '@/components/SharedFilterBar'
import { summarize } from '@/lib/scoring'
import { ExportPresetsMenu } from '@/components/ExportPresetsMenu'
import type { EnrichmentSnapshot } from '@/lib/enrichment'

export function FunnelReport({
  leads,
  enrichments,
  refreshKey,
  filters,
  onFiltersChange,
}: {
  leads: ScoredLead[]
  enrichments?: Record<string, EnrichmentSnapshot>
  refreshKey?: number
  filters?: SharedFilters
  onFiltersChange?: (f: SharedFilters) => void
}) {
  const [localFilters, setLocalFilters] = useState<SharedFilters>(filters || DEFAULT_FILTERS)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [impact, setImpact] = useState<{ workflowKey: string; name: string; leadsMoved: number }[]>([])

  const active = filters || localFilters
  const setActive = onFiltersChange || setLocalFilters

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const q = new URLSearchParams()
        if (from) {
          q.set('from', from)
        }
        if (to) {
          q.set('to', to)
        }
        const res = await fetch(`/api/report?${q}`)
        if (!res.ok) {
          return
        }
        const data = await res.json()
        if (!cancelled && Array.isArray(data.workflowImpact)) {
          setImpact(data.workflowImpact)
        }
      } catch {
        // Client funnel still works offline.
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [refreshKey, from, to])

  const filtered = useMemo(
    () => applySharedFilters(leads, active, enrichments),
    [leads, active, enrichments],
  )

  const dated = useMemo(() => {
    if (!from && !to) {
      return filtered
    }
    const fromMs = from ? new Date(from).getTime() : 0
    const toMs = to ? new Date(to).getTime() + 86400000 : Infinity
    return filtered.filter(l => {
      const t = l.stageChangedAt ? new Date(l.stageChangedAt).getTime() : Date.now()
      return t >= fromMs && t <= toMs
    })
  }, [filtered, from, to])

  const report = useMemo(
    () =>
      buildFunnelReport(dated, {
        enrichedIds: new Set(
          dated.filter(l => enrichments?.[l.id] || l.stage !== 'new').map(l => l.id),
        ),
        workflowMoves: impact,
      }),
    [dated, enrichments, impact],
  )

  const summary = useMemo(() => summarize(leads), [leads])
  const maxCount = report.steps[0]?.count || 1

  if (!leads.length) {
    return (
      <p className="panel px-5 py-14 text-center text-sm text-[var(--sq-text-muted)]">
        Load demo data to see the acquisition funnel.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">Funnel report</h2>
          <p className="text-sm text-[var(--sq-text-secondary)]">
            Targets → LOI with conversion, credits saved, and workflow impact.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[11px] text-[var(--sq-text-muted)]">
            From
            <input
              type="date"
              className="field ml-1.5 !py-1 !px-2 !text-[11px] !w-auto"
              value={from}
              onChange={e => setFrom(e.target.value)}
            />
          </label>
          <label className="text-[11px] text-[var(--sq-text-muted)]">
            To
            <input
              type="date"
              className="field ml-1.5 !py-1 !px-2 !text-[11px] !w-auto"
              value={to}
              onChange={e => setTo(e.target.value)}
            />
          </label>
          <ExportPresetsMenu leads={dated} label="Export cohort" />
        </div>
      </div>

      <SharedFilterBar
        leads={leads}
        summary={summary}
        filters={active}
        onChange={setActive}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="kpi-card">
          <div className="flex items-center gap-2">
            <span className="icon-well icon-well-sm" style={{ background: 'rgba(251,191,36,0.14)', color: '#fbbf24' }}>
              <Coins strokeWidth={1.75} />
            </span>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--sq-text-muted)]">
              Credits saved
            </p>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white">
            {report.creditsSaved.ratio}%
          </p>
          <p className="mt-1 text-[11px] text-[var(--sq-text-muted)]">
            Enriched {report.creditsSaved.enriched} of {report.creditsSaved.total} clean leads
          </p>
        </div>
        <div className="kpi-card">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--sq-text-muted)]">
            Closed
          </p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#4ade80]">
            {report.closed}
          </p>
        </div>
        <div className="kpi-card">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--sq-text-muted)]">
            Lost
          </p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-sq-danger">
            {report.lost}
          </p>
        </div>
      </div>

      <section className="panel px-5 py-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="icon-well icon-well-sm" style={{ background: 'rgba(96,165,250,0.14)', color: '#60a5fa' }}>
            <BarChart3 strokeWidth={1.75} />
          </span>
          <h3 className="text-[13px] font-semibold text-white">Pipeline funnel</h3>
        </div>
        <div className="space-y-3">
          {report.steps.map((step, i) => {
            const width = Math.max(6, Math.round((step.count / maxCount) * 100))
            return (
              <div key={step.stage} className="row-enter" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-[12px]">
                  <span className="font-medium text-white">{step.label}</span>
                  <span className="font-mono tabular-nums text-[var(--sq-text-secondary)]">
                    {step.count}
                    {step.conversionFromPrev != null ? (
                      <span className="ml-2 text-[11px] text-[var(--sq-text-muted)]">
                        {step.conversionFromPrev}%
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full transition-[width] duration-300 ease-[var(--ease-out)]"
                    style={{
                      width: `${width}%`,
                      background:
                        i === 0
                          ? '#f5f5f5'
                          : i < 3
                            ? '#fbbf24'
                            : '#34d399',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {(
          [
            ['By tier', report.byTier],
            ['By industry', report.byIndustry],
            ['By state', report.byState],
          ] as const
        ).map(([title, rows]) => (
          <section key={title} className="panel px-4 py-4">
            <h3 className="mb-3 text-[12px] font-semibold text-white">{title}</h3>
            <ul className="space-y-2">
              {rows.slice(0, 8).map(row => {
                const w = Math.max(4, Math.round((row.count / (rows[0]?.count || 1)) * 100))
                return (
                  <li key={row.key}>
                    <div className="mb-0.5 flex justify-between text-[11px]">
                      <span className="truncate text-[var(--sq-text-secondary)]">{row.key}</span>
                      <span className="font-mono tabular-nums text-white">{row.count}</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-[#a78bfa] transition-[width] duration-300 ease-[var(--ease-out)]"
                        style={{ width: `${w}%` }}
                      />
                    </div>
                  </li>
                )
              })}
              {!rows.length && (
                <li className="text-[12px] text-[var(--sq-text-muted)]">No data</li>
              )}
            </ul>
          </section>
        ))}
      </div>

      <section className="panel px-5 py-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="icon-well icon-well-sm" style={{ background: 'rgba(167,139,250,0.14)', color: '#a78bfa' }}>
            <GitBranch strokeWidth={1.75} />
          </span>
          <h3 className="text-[13px] font-semibold text-white">Workflow impact</h3>
        </div>
        {report.workflowImpact.length === 0 ? (
          <p className="text-sm text-[var(--sq-text-muted)]">
            Run templates to see how many leads each workflow moved.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--sq-border)]">
            {report.workflowImpact.map(w => (
              <li key={w.workflowKey} className="flex justify-between py-2 text-[13px]">
                <span className="text-white">{w.name}</span>
                <span className="font-mono tabular-nums text-[var(--sq-text-secondary)]">
                  {w.leadsMoved} moved
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
