'use client'

import { ChevronRight } from 'lucide-react'
import type { ScoredLead } from '@/lib/scoring'
import { CompanyAvatar } from '@/components/CompanyAvatar'
import { ScoreMeter } from '@/components/ScoreMeter'
import { TierBadge } from '@/components/StatusBadge'

type Props = {
  item: ScoredLead
  index?: number
  selected?: boolean
  onToggleSelect?: () => void
  onOpen: () => void
}

function statusHint(l: ScoredLead) {
  if (l.duplicateOf) {
    return `Duplicate of ${l.duplicateOf}`
  }
  if (l.junk) {
    return l.junkReasons[0] || 'Junk'
  }
  return null
}

/** Compact list row — details live on the dossier subpage. */
export function LeadCard({
  item,
  index = 0,
  selected = false,
  onToggleSelect,
  onOpen,
}: Props) {
  const { lead, score, tier, junk, duplicateOf } = item
  const dimmed = junk || !!duplicateOf
  const company = lead.company?.trim() || 'Untitled company'
  const hint = statusHint(item)
  const place = [lead.city, lead.state].filter(Boolean).join(', ')
  const sub = [lead.ownerName || lead.title, place || lead.industry].filter(Boolean).join(' · ')

  return (
    <article
      className="lead-card lead-row row-enter"
      data-dim={dimmed}
      data-selected={selected ? 'true' : undefined}
      style={{ animationDelay: `${Math.min(index, 10) * 28}ms` }}
    >
      <div className="lead-card-summary lead-card-summary--select">
        {onToggleSelect ? (
          <label className="lead-select" onClick={e => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              aria-label={`Mark ${company}`}
            />
          </label>
        ) : (
          <span />
        )}

        <button type="button" className="lead-card-open" onClick={onOpen}>
          <CompanyAvatar company={company} website={lead.website} email={lead.email} />

          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-[15px] font-semibold tracking-[-0.025em] text-white">
                {company}
              </h3>
              <TierBadge tier={tier} />
            </div>
            <p className="mt-0.5 truncate text-[13px] tracking-tight text-[var(--sq-text-secondary)]">
              {sub || 'Open for details'}
            </p>
            {dimmed && hint && (
              <p className="mt-1 text-xs font-medium text-[var(--sq-text-muted)]">{hint}</p>
            )}
          </div>

          <ScoreMeter score={score} />
          <ChevronRight className="chevron" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </article>
  )
}
