'use client'

import { Search } from 'lucide-react'
import { SlidingSeg } from '@/components/SlidingSeg'
import {
  uniqueIndustries,
  uniqueStates,
  type SharedFilters,
} from '@/lib/filters'
import { PIPELINE_STAGES, STAGE_LABELS } from '@/lib/pipeline'
import type { ScoredLead } from '@/lib/scoring'
import type { TriageSummary } from '@/lib/scoring'

export function SharedFilterBar({
  leads,
  summary,
  filters,
  onChange,
}: {
  leads: ScoredLead[]
  summary: TriageSummary
  filters: SharedFilters
  onChange: (next: SharedFilters) => void
}) {
  const industries = uniqueIndustries(leads)
  const states = uniqueStates(leads)

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="lead-search relative block min-w-0 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--sq-text-muted)]"
            strokeWidth={1.75}
            aria-hidden
          />
          <input
            type="search"
            className="field !py-2 !pl-9 !pr-3 !text-[0.8125rem]"
            placeholder="Search company, owner, email…"
            value={filters.query}
            onChange={e => onChange({ ...filters, query: e.target.value })}
            aria-label="Search leads"
          />
        </label>
        <SlidingSeg
          role="group"
          aria-label="Filter by tier"
          value={filters.tier}
          onChange={tier => onChange({ ...filters, tier })}
          items={[
            { id: 'ALL', label: `All (${leads.length})` },
            { id: 'A', label: `A (${summary.tierA})` },
            { id: 'B', label: `B (${summary.tierB})` },
            { id: 'C', label: `C (${summary.tierC})` },
            { id: 'JUNK', label: `Junk / dupes (${summary.junk + summary.duplicates})` },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] text-[var(--sq-text-muted)]">
          Industry
          <select
            className="field !py-1 !px-2 !text-[11px] !w-auto min-w-[8rem]"
            value={filters.industries[0] || ''}
            onChange={e =>
              onChange({
                ...filters,
                industries: e.target.value ? [e.target.value] : [],
              })
            }
          >
            <option value="">All</option>
            {industries.map(ind => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-[var(--sq-text-muted)]">
          State
          <select
            className="field !py-1 !px-2 !text-[11px] !w-auto min-w-[5rem]"
            value={filters.states[0] || ''}
            onChange={e =>
              onChange({
                ...filters,
                states: e.target.value ? [e.target.value] : [],
              })
            }
          >
            <option value="">All</option>
            {states.map(st => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-[var(--sq-text-muted)]">
          Stage
          <select
            className="field !py-1 !px-2 !text-[11px] !w-auto min-w-[7rem]"
            value={filters.stages[0] || ''}
            onChange={e =>
              onChange({
                ...filters,
                stages: e.target.value ? [e.target.value as SharedFilters['stages'][number]] : [],
              })
            }
          >
            <option value="">All</option>
            {PIPELINE_STAGES.map(s => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-[var(--sq-text-muted)]">
          Min confidence
          <select
            className="field !py-1 !px-2 !text-[11px] !w-auto min-w-[5rem]"
            value={filters.minConfidence == null ? '' : String(filters.minConfidence)}
            onChange={e =>
              onChange({
                ...filters,
                minConfidence: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          >
            <option value="">Off</option>
            <option value="0.4">0.4</option>
            <option value="0.55">0.55</option>
            <option value="0.7">0.7</option>
          </select>
        </label>
      </div>
    </div>
  )
}
