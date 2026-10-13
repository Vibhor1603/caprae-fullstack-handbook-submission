'use client'

import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'

export function CollapsibleSection({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string
  hint?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="lead-panel-block !p-0 overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.02]"
        aria-expanded={open}
        onClick={e => {
          e.stopPropagation()
          setOpen(v => !v)
        }}
      >
        <span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--sq-text-muted)]">
            {title}
          </span>
          {hint && !open ? (
            <span className="mt-0.5 block text-[12px] text-[var(--sq-text-secondary)]">{hint}</span>
          ) : null}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-[var(--sq-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={1.75}
        />
      </button>
      {open ? <div className="border-t border-[var(--sq-border)] px-4 pb-4 pt-3">{children}</div> : null}
    </div>
  )
}
