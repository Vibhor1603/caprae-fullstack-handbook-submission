'use client'

/** Enriched field value + model confidence (0–100%), not fit score. */
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
    <div
      className="min-w-0 rounded-[var(--radius-xs)] bg-[var(--ash-900)]/80 px-3 py-2.5"
      title={`${pct}% confidence — how likely this ${label.toLowerCase()} is correct after enrich (source quality, match on site, etc.).`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium text-[var(--sq-text-muted)]">{label}</p>
        <p className="text-[10px] font-medium tabular-nums text-[var(--sq-text-secondary)]">
          {pct}% sure
        </p>
      </div>
      <p className="mt-1 line-clamp-2 text-[13px] font-medium leading-snug tracking-tight text-white">
        {value || '—'}
      </p>
    </div>
  )
}
