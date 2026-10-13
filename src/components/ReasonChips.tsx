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
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {shown.map(r => {
        const negative = r.trim().startsWith('-')
        return (
          <li
            key={r}
            className={`inline-flex min-w-0 items-start gap-1.5 text-[12px] font-medium leading-snug tracking-tight ${
              negative ? 'text-sq-danger' : 'text-[var(--sq-text-secondary)]'
            }`}
          >
            {negative ? (
              <Minus className="mt-0.5 size-3 shrink-0" strokeWidth={2.5} aria-hidden />
            ) : (
              <Plus className="mt-0.5 size-3 shrink-0 text-[#fbbf24]" strokeWidth={2.5} aria-hidden />
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
