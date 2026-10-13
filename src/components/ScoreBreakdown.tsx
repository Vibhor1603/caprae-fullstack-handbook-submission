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
    <ul className="space-y-2">
      {list.map((f, i) => {
        const pos = f.points >= 0
        return (
          <li
            key={`${f.key}-${i}`}
            className="flex items-start justify-between gap-4 text-[13px]"
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
