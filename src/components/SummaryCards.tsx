'use client'

import { AlertTriangle, CircleDot, Files, Sparkles } from 'lucide-react'
import type { TriageSummary } from '@/lib/scoring'

/** Uplifted KPI cards with Lucide in tinted wells — matches reference dashboard. */
const parts: {
  key: string
  label: string
  tone: string
  well: string
  icon: typeof Sparkles
  get: (s: TriageSummary) => number
}[] = [
  {
    key: 'tierA',
    label: 'A-tier',
    tone: '#22c55e',
    well: 'rgba(34, 197, 94, 0.14)',
    icon: Sparkles,
    get: s => s.tierA,
  },
  {
    key: 'tierB',
    label: 'B-tier',
    tone: '#f59e0b',
    well: 'rgba(245, 158, 11, 0.14)',
    icon: CircleDot,
    get: s => s.tierB,
  },
  {
    key: 'tierC',
    label: 'C-tier',
    tone: '#a3a3a3',
    well: 'rgba(163, 163, 163, 0.14)',
    icon: Files,
    get: s => s.tierC,
  },
  {
    key: 'skip',
    label: 'Junk / dupes',
    tone: '#f43f5e',
    well: 'rgba(244, 63, 94, 0.14)',
    icon: AlertTriangle,
    get: s => s.junk + s.duplicates,
  },
]

export function SummaryCards({ summary }: { summary: TriageSummary }) {
  return (
    <div className="w-full space-y-3">
      <div className="kpi-grid">
        {parts.map(p => {
          const Icon = p.icon
          const n = p.get(summary)
          return (
            <div key={p.key} className="kpi-card">
              <span className="icon-well" style={{ background: p.well, color: p.tone }} aria-hidden>
                <Icon strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-[var(--sq-text-muted)]">{p.label}</p>
                <p
                  className="mt-0.5 text-[1.65rem] font-bold tabular-nums tracking-tight leading-none text-white"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {n}
                </p>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[12px] text-[var(--sq-text-muted)]">
        {summary.clean} CRM-ready of {summary.total} scored
      </p>
    </div>
  )
}
