'use client'

import type { ReactNode } from 'react'

/** Vertical KPI tile — label, value, and subtext always stacked (never inline). */
export function KpiStat({
  label,
  value,
  sub,
  subMuted,
  onClick,
  valueClassName = '',
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  subMuted?: boolean
  onClick?: () => void
  valueClassName?: string
}) {
  const body = (
    <>
      <span className="kpi-stat-label">{label}</span>
      <span className={`kpi-stat-value ${valueClassName}`.trim()}>{value}</span>
      {sub != null ? (
        <span className={`kpi-stat-sub ${subMuted ? 'kpi-stat-sub--muted' : ''}`.trim()}>{sub}</span>
      ) : null}
    </>
  )

  if (onClick) {
    return (
      <button type="button" className="kpi-stat-card" onClick={onClick}>
        {body}
      </button>
    )
  }

  return <div className="kpi-stat-card">{body}</div>
}
