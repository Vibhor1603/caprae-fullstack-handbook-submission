'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ScoredLead } from '@/lib/scoring'
import { buildFunnelReport } from '@/lib/funnel'
import { applySharedFilters, DEFAULT_FILTERS, type SharedFilters } from '@/lib/filters'
import type { TierFilter } from '@/lib/leadsQuery'
import { summarize } from '@/lib/scoring'
import { ExportPresetsMenu } from '@/components/ExportPresetsMenu'
import { SlidingSeg } from '@/components/SlidingSeg'
import type { EnrichmentSnapshot } from '@/lib/enrichment'

function listLabel(filters: SharedFilters, count: number): string {
  const tier =
    filters.tier === 'ALL'
      ? 'All'
      : filters.tier === 'JUNK'
        ? 'Skip'
        : `Tier ${filters.tier}`
  const bits = [tier, `${count} lead${count === 1 ? '' : 's'}`]
  if (filters.query.trim()) {
    bits.push(`“${filters.query.trim().slice(0, 24)}”`)
  }
  return bits.join(' · ')
}

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
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [impact, setImpact] = useState<{ workflowKey: string; name: string; leadsMoved: number }[]>([])

  const active = filters || localFilters
  const setActive = onFiltersChange || setLocalFilters

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/report')
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
  }, [refreshKey])

  const filtered = useMemo(
    () => applySharedFilters(leads, active, enrichments),
    [leads, active, enrichments],
  )

  const report = useMemo(
    () =>
      buildFunnelReport(filtered, {
        enrichedIds: new Set(
          filtered.filter(l => enrichments?.[l.id] || l.stage !== 'new').map(l => l.id),
        ),
        workflowMoves: impact,
      }),
    [filtered, enrichments, impact],
  )

  const summary = useMemo(() => summarize(leads), [leads])
  const maxCount = report.steps[0]?.count || 1
  const cleanCount = filtered.filter(l => !l.junk && !l.duplicateOf).length
  const topWorkflow = report.workflowImpact[0]

  const tierItems: { id: TierFilter; label: string }[] = [
    { id: 'ALL', label: `All (${summary.total})` },
    { id: 'A', label: `A (${summary.tierA})` },
    { id: 'B', label: `B (${summary.tierB})` },
    { id: 'C', label: `C (${summary.tierC})` },
    { id: 'JUNK', label: `Skip (${summary.junk + summary.duplicates})` },
  ]

  if (!leads.length) {
    return (
      <p className="panel px-5 py-14 text-center text-sm text-[var(--sq-text-muted)]">
        Load demo data to see deal stages.
      </p>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-white">Deal stages</h2>
          <p className="mt-1.5 max-w-lg text-[15px] leading-relaxed text-[var(--sq-text-secondary)]">
            How far each lead has moved — from new to LOI.
          </p>
        </div>
        <SlidingSeg
          className="seg--main w-full max-w-md"
          aria-label="Filter by tier"
          value={active.tier}
          onChange={tier => setActive({ ...active, tier })}
          items={tierItems}
        />
        <p className="text-[13px] text-[var(--sq-text-muted)]">{listLabel(active, cleanCount)}</p>
      </header>

      <section className="panel px-5 py-6 sm:px-6">
        <div className="space-y-4">
          {report.steps.map((step, i) => {
            const width = Math.max(8, Math.round((step.count / maxCount) * 100))
            return (
              <div
                key={step.stage}
                className="grid grid-cols-[5.5rem_minmax(0,1fr)_4.5rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[6.5rem_minmax(0,1fr)_5rem]"
              >
                <span className="text-[13px] font-medium text-[var(--sq-text-secondary)]">
                  {step.label}
                </span>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-[#fbbf24] transition-[width] duration-300 ease-[var(--ease-out)]"
                    style={{ width: `${width}%`, opacity: 1 - i * 0.08 }}
                  />
                </div>
                <span className="text-right font-mono text-[13px] font-semibold tabular-nums text-white">
                  {step.count}
                  {step.conversionFromPrev != null ? (
                    <span className="mt-0.5 block text-[10px] font-medium text-[var(--sq-text-muted)]">
                      {step.conversionFromPrev}%
                    </span>
                  ) : null}
                </span>
              </div>
            )
          })}
        </div>

        <p className="mt-6 border-t border-[var(--sq-border)] pt-4 text-[12px] leading-relaxed text-[var(--sq-text-muted)]">
          <span className="text-[var(--sq-text-secondary)]">Research spend:</span> filled in{' '}
          {report.creditsSaved.enriched} of {report.creditsSaved.total} leads (
          {report.creditsSaved.ratio}% skipped).
          {topWorkflow ? (
            <>
              {' '}
              <span className="text-[var(--sq-text-secondary)]">Top workflow:</span>{' '}
              {topWorkflow.name} ({topWorkflow.leadsMoved}).
            </>
          ) : null}
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--sq-text-secondary)] hover:text-white"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen(v => !v)}
        >
          <ChevronDown
            className={`size-4 transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
            strokeWidth={1.75}
          />
          {detailsOpen ? 'Hide details' : 'More details & export'}
        </button>
        <ExportPresetsMenu leads={filtered} label="Export list" />
      </div>

      {detailsOpen && (
        <div className="panel space-y-5 px-5 py-5 sm:px-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--sq-text-muted)]">
                Top industries
              </h3>
              <ul className="space-y-1.5 text-[13px]">
                {report.byIndustry.slice(0, 5).map(row => (
                  <li key={row.key} className="flex justify-between gap-3">
                    <span className="truncate text-[var(--sq-text-secondary)]">{row.key}</span>
                    <span className="font-mono tabular-nums text-white">{row.count}</span>
                  </li>
                ))}
                {!report.byIndustry.length && (
                  <li className="text-[var(--sq-text-muted)]">No data</li>
                )}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--sq-text-muted)]">
                Top states
              </h3>
              <ul className="space-y-1.5 text-[13px]">
                {report.byState.slice(0, 5).map(row => (
                  <li key={row.key} className="flex justify-between gap-3">
                    <span className="truncate text-[var(--sq-text-secondary)]">{row.key}</span>
                    <span className="font-mono tabular-nums text-white">{row.count}</span>
                  </li>
                ))}
                {!report.byState.length && (
                  <li className="text-[var(--sq-text-muted)]">No data</li>
                )}
              </ul>
            </div>
          </div>
          <p className="text-[12px] text-[var(--sq-text-muted)]">
            Closed {report.closed} · Lost {report.lost}. More filters live on the Leads tab.
          </p>
        </div>
      )}
    </div>
  )
}
