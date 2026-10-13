'use client'

import { Check, Plus, Power } from 'lucide-react'
import { DEAL_TEMPLATES, type TemplateKey } from '@/lib/templates'

export type TemplateStatus = {
  key: TemplateKey
  installed: boolean
  enabled: boolean
  workflowId?: string
}

export function TemplateGallery({
  status,
  busyKey,
  onAdd,
  onToggle,
}: {
  status: TemplateStatus[]
  busyKey?: string | null
  onAdd: (key: TemplateKey) => void
  onToggle: (key: TemplateKey, enabled: boolean) => void
}) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      {DEAL_TEMPLATES.map((t, i) => {
        const st = status.find(s => s.key === t.key)
        const installed = !!st?.installed
        const enabled = !!st?.enabled
        const busy = busyKey === t.key
        return (
          <article
            key={t.key}
            className="panel row-enter flex flex-col px-4 py-4"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--sq-text-muted)]">
              Template
            </p>
            <h3 className="mt-1 text-[14px] font-semibold tracking-tight text-white">{t.name}</h3>
            <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-[var(--sq-text-secondary)]">
              {t.description}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!installed ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => onAdd(t.key)}
                >
                  <Plus className="size-3.5" strokeWidth={1.75} />
                  {busy ? 'Adding…' : 'Add'}
                </button>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4ade80]">
                    <Check className="size-3" strokeWidth={2} /> On canvas
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => onToggle(t.key, !enabled)}
                  >
                    <Power className="size-3.5" strokeWidth={1.75} />
                    {enabled ? 'Disable' : 'Enable'}
                  </button>
                </>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
