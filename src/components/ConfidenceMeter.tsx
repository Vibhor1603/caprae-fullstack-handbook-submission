'use client'

/** Compact confidence meter in an uplifted mini card. */
export function ConfidenceMeter({
  label,
  value,
  confidence,
}: {
  label: string
  value: string | null
  confidence: number
}) {
  const pct = Math.round(Math.max(0, Math.min(1, confidence)) * 100)
  return (
    <div className="min-w-0 rounded-[var(--radius-sm)] border border-[var(--sq-border)] bg-[var(--ash-850)] px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium text-[var(--sq-text-muted)]">{label}</p>
        <p className="text-[10px] font-semibold tabular-nums text-[var(--sq-text-muted)]">{pct}%</p>
      </div>
      <p className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-snug tracking-tight text-white">
        {value || '—'}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-[rgba(251,191,36,0.75)] transition-[width] duration-200"
          style={{ width: `${Math.max(6, pct)}%` }}
        />
      </div>
    </div>
  )
}
