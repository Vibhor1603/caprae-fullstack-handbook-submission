'use client'

import { ChevronDown } from 'lucide-react'
import type { ScoredLead } from '@/lib/scoring'
import { contactLine, factsFromLead } from '@/lib/leadDisplay'
import { CompanyAvatar } from '@/components/CompanyAvatar'
import { ReasonChips } from '@/components/ReasonChips'
import { ScoreMeter } from '@/components/ScoreMeter'
import { StatusBadge, TierBadge } from '@/components/StatusBadge'

type Props = {
  item: ScoredLead
  open: boolean
  onToggle: () => void
  index?: number
}

function statusHint(l: ScoredLead) {
  if (l.duplicateOf) {return `Duplicate of ${l.duplicateOf}`}
  if (l.junk) {return l.junkReasons[0] || 'Junk'}
  return null
}

export function LeadCard({ item, open, onToggle, index = 0 }: Props) {
  const { lead, score, tier, reasons, junk, duplicateOf } = item
  const dimmed = junk || !!duplicateOf
  const facts = factsFromLead(lead)
  const company = lead.company?.trim() || 'Untitled company'
  const hint = statusHint(item)

  return (
    <article
      className="lead-card lead-row row-enter"
      data-open={open}
      data-dim={dimmed}
      style={{ animationDelay: `${Math.min(index, 10) * 28}ms` }}
    >
      <button type="button" className="lead-card-summary" aria-expanded={open} onClick={onToggle}>
        <CompanyAvatar company={company} website={lead.website} email={lead.email} />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate text-[15px] font-semibold tracking-[-0.025em] text-white">
              {company}
            </h3>
            {!open && <TierBadge tier={tier} />}
            {!open && <StatusBadge item={item} />}
            {lead.industry ? (
              <span className="truncate text-[12px] font-medium text-[var(--sq-text-muted)]">
                {lead.industry}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[13px] tracking-tight text-[var(--sq-text-secondary)]">
            {contactLine(lead)}
            {!open && lead.email ? (
              <span className="ml-2 font-mono text-[11px] text-[var(--sq-text-muted)]">{lead.email}</span>
            ) : null}
          </p>
          {dimmed && !open && hint && (
            <p className="mt-1 text-xs font-medium text-[var(--sq-text-muted)]">{hint}</p>
          )}
        </div>

        {!open && <ScoreMeter score={score} />}
        <ChevronDown className="chevron" strokeWidth={1.75} aria-hidden />
      </button>

      <div className="lead-card-panel">
        <div className="lead-card-panel-inner">
          <div className="space-y-4 border-t border-[var(--sq-border)] px-5 pb-5 pt-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p
                className="fit-score shrink-0 font-mono text-[1.35rem] font-bold tabular-nums tracking-tight text-white"
                aria-label={`Fit score ${score} of 100`}
              >
                {score}
                <span className="text-[0.85em] font-semibold text-[var(--sq-text-muted)]">/100</span>
              </p>
              <TierBadge tier={tier} />
              <StatusBadge item={item} />
              <span className="text-[11px] font-medium text-[var(--sq-text-muted)]">{item.id}</span>
            </div>

            {item.junkReasons.length > 0 && (
              <p className="text-sm font-medium text-sq-danger">{item.junkReasons.join(' · ')}</p>
            )}

            {facts.length > 0 && (
              <dl className="fact-grid">
                {facts.map(f => {
                  const Icon = f.icon
                  return (
                    <div key={f.key} className="fact-row">
                      <span
                        className="icon-well icon-well-sm"
                        style={{ background: `${f.color}22`, color: f.color }}
                        aria-hidden
                      >
                        <Icon strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0">
                        <dt>{f.label}</dt>
                        <dd>{f.value}</dd>
                      </div>
                    </div>
                  )
                })}
              </dl>
            )}

            {item.whyNow && (
              <p className="text-sm leading-relaxed text-[var(--sq-text-secondary)]">
                <span className="font-semibold text-[#fbbf24]">Why now · </span>
                {item.whyNow}
              </p>
            )}

            {item.tags?.length > 0 && (
              <p className="text-xs text-[var(--sq-text-muted)]">
                Tags: {item.tags.join(', ')}
              </p>
            )}

            {!dimmed && reasons.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--sq-text-muted)]">
                  Why this score
                </p>
                <ReasonChips reasons={reasons} max={12} />
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
