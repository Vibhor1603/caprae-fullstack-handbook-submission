'use client'

import { useState } from 'react'
import type { Icp } from '@/lib/scoring'
import { DEFAULT_ICP } from '@/lib/scoring'

type Props = {
  icp: Icp
  onChange: (next: Icp) => void
  /** Start expanded (empty state) or collapsed summary (loaded list). */
  defaultOpen?: boolean
}

function listField(value: string[], onEdit: (next: string[]) => void, placeholder: string) {
  return (
    <input
      className="field"
      value={value.join(', ')}
      placeholder={placeholder}
      onChange={e =>
        onEdit(
          e.target.value
            .split(',')
            .map(s => s.trim().toLowerCase())
            .filter(Boolean),
        )
      }
    />
  )
}

function formatRev(n: number) {
  if (n >= 1_000_000) {return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`}
  if (n >= 1_000) {return `$${(n / 1_000).toFixed(0)}K`}
  return `$${n}`
}

/** Compact criteria: summary chips when closed, form when open. Lives above the list. */
export function IcpPanel({ icp, onChange, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const set = <K extends keyof Icp>(key: K, value: Icp[K]) => onChange({ ...icp, [key]: value })

  const chips = [
    icp.industries.slice(0, 3).join(', ') + (icp.industries.length > 3 ? '…' : ''),
    icp.countries[0]?.toUpperCase() ?? 'Any geo',
    `${icp.employees[0]}–${icp.employees[1]} people`,
    `${formatRev(icp.revenueUsd[0])}–${formatRev(icp.revenueUsd[1])}`,
  ].filter(Boolean)

  return (
    <section className="panel">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--sq-text-muted)]">
            Who you want
          </p>
          {!open && (
            <p className="mt-1 truncate text-sm tracking-tight text-[var(--sq-text-secondary)]">
              {chips.join(' · ')}
            </p>
          )}
          {open && (
            <p className="mt-1 text-sm text-[var(--sq-text-secondary)]">
              Scores update as you type.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {open && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                onChange({
                  ...DEFAULT_ICP,
                  industries: [...DEFAULT_ICP.industries],
                  countries: [...DEFAULT_ICP.countries],
                  employees: [DEFAULT_ICP.employees[0], DEFAULT_ICP.employees[1]],
                  revenueUsd: [DEFAULT_ICP.revenueUsd[0], DEFAULT_ICP.revenueUsd[1]],
                  decisionMakerTitles: [...DEFAULT_ICP.decisionMakerTitles],
                })
              }
            >
              Reset
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            aria-expanded={open}
            onClick={() => setOpen(v => !v)}
          >
            {open ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[var(--sq-border)] px-4 py-4 sm:px-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 text-xs text-[var(--sq-text-muted)]">
              Industries
              {listField(icp.industries, v => set('industries', v), 'hvac, plumbing…')}
            </label>
            <label className="block space-y-1.5 text-xs text-[var(--sq-text-muted)]">
              Countries
              {listField(icp.countries, v => set('countries', v), 'us, usa…')}
            </label>
            <label className="block space-y-1.5 text-xs text-[var(--sq-text-muted)]">
              Employees (min–max)
              <div className="flex gap-2">
                <input
                  type="number"
                  className="field"
                  value={icp.employees[0]}
                  onChange={e => set('employees', [Number(e.target.value) || 0, icp.employees[1]])}
                />
                <input
                  type="number"
                  className="field"
                  value={icp.employees[1]}
                  onChange={e => set('employees', [icp.employees[0], Number(e.target.value) || 0])}
                />
              </div>
            </label>
            <label className="block space-y-1.5 text-xs text-[var(--sq-text-muted)]">
              Revenue USD (min–max)
              <div className="flex gap-2">
                <input
                  type="number"
                  className="field font-mono"
                  value={icp.revenueUsd[0]}
                  onChange={e => set('revenueUsd', [Number(e.target.value) || 0, icp.revenueUsd[1]])}
                />
                <input
                  type="number"
                  className="field font-mono"
                  value={icp.revenueUsd[1]}
                  onChange={e => set('revenueUsd', [icp.revenueUsd[0], Number(e.target.value) || 0])}
                />
              </div>
            </label>
            <label className="block space-y-1.5 text-xs text-[var(--sq-text-muted)]">
              Min years in business
              <input
                type="number"
                className="field"
                value={icp.minYearsInBusiness ?? 0}
                onChange={e => set('minYearsInBusiness', Number(e.target.value) || 0)}
              />
            </label>
            <label className="block space-y-1.5 text-xs text-[var(--sq-text-muted)]">
              Decision-maker titles
              {listField(icp.decisionMakerTitles, v => set('decisionMakerTitles', v), 'owner, founder, ceo…')}
            </label>
          </div>
        </div>
      )}
    </section>
  )
}
