'use client'

import type { ScoreFactor } from '@/lib/scoring'

export function ScoreBreakdown({
  factors,
  max = 16,
}: {
  factors?: ScoreFactor[]
  max?: number
}) {
  const list = (factors || []).slice(0, max)
  if (!list.length) {
    return (
      <p className="text-sm text-[var(--sq-text-muted)]">No score factors yet.</p>
    )
  }

  return (
    <ul className="divide-y divide-[var(--sq-border)] rounded-[var(--radius-xs)] border border-[var(--sq-border)] bg-[var(--ash-900)]/60">
      {list.map((f, i) => {
        const pos = f.points >= 0
        return (
          <li
            key={`${f.key}-${i}`}
            className="flex items-start justify-between gap-4 px-3 py-2.5 text-[13px] first:rounded-t-[var(--radius-xs)] last:rounded-b-[var(--radius-xs)]"
          >
            <span className="min-w-0 leading-snug text-[var(--sq-text-secondary)]">{f.label}</span>
            <span
              className={`shrink-0 font-mono text-[12px] font-semibold tabular-nums ${
                pos ? 'text-[#fbbf24]' : 'text-sq-danger'
              }`}
            >
              {pos ? '+' : ''}
              {f.points}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
