'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/** Compact dashboard KPI tile — icon + label + large value + muted sub. */
export function KpiStat({
  label,
  value,
  sub,
  subMuted,
  onClick,
  valueClassName = '',
  icon: Icon,
  tone = '#94a3b8',
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  subMuted?: boolean
  onClick?: () => void
  valueClassName?: string
  icon?: LucideIcon
  tone?: string
}) {
  const body = (
    <>
      <div className="kpi-stat-top">
        <span className="kpi-stat-label">{label}</span>
        {Icon ? (
          <span className="icon-well icon-well-sm" style={{ background: `${tone}22`, color: tone }}>
            <Icon strokeWidth={1.75} />
          </span>
        ) : null}
      </div>
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
