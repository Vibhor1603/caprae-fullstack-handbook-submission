'use client'

/** Collapsed-row fit only — plain 93/100, no underline bar. */
export function ScoreMeter({ score }: { score: number; tier?: 'A' | 'B' | 'C' }) {
  return (
    <p
      className="shrink-0 font-mono text-[13px] font-bold tabular-nums tracking-tight text-white"
      aria-label={`Fit score ${score} of 100`}
    >
      {score}
      <span className="text-[var(--sq-text-muted)]">/100</span>
    </p>
  )
}
