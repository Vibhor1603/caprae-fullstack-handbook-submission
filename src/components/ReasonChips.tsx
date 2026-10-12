'use client'

import { Minus, Plus } from 'lucide-react'

/** Colored text + dark tint — not heavy pill boxes. */
export function ReasonChips({ reasons, max = 4 }: { reasons: string[]; max?: number }) {
  if (!reasons.length) {
    return <span className="text-xs font-medium text-[var(--sq-text-muted)]">No score factors</span>
  }

  const shown = reasons.slice(0, max)
  const rest = reasons.length - shown.length

  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
      {shown.map(r => {
        const negative = r.trim().startsWith('-')
        return (
          <li
            key={r}
            className={`inline-flex items-center gap-1 text-[12px] font-medium leading-snug tracking-tight ${
              negative ? 'text-sq-danger' : 'text-[var(--ok)]'
            }`}
          >
            {negative ? (
              <Minus className="size-3 shrink-0" strokeWidth={2.5} aria-hidden />
            ) : (
              <Plus className="size-3 shrink-0" strokeWidth={2.5} aria-hidden />
            )}
            {r.replace(/^[+-]/, '')}
          </li>
        )
      })}
      {rest > 0 && (
        <li className="text-[12px] font-medium text-[var(--sq-text-muted)]">+{rest} more</li>
      )}
    </ul>
  )
}
