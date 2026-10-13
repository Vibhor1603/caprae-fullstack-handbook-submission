'use client'

import { ChevronDown, Workflow, Zap } from 'lucide-react'
import type { ScoredLead } from '@/lib/scoring'
import type { EnrichmentSnapshot } from '@/lib/enrichment'
import { contactLine, factsWithEnrichment } from '@/lib/leadDisplay'
import { CompanyAvatar } from '@/components/CompanyAvatar'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { ReasonChips } from '@/components/ReasonChips'
import { ScoreBreakdown } from '@/components/ScoreBreakdown'
import { ScoreMeter } from '@/components/ScoreMeter'
import { StatusBadge, TierBadge } from '@/components/StatusBadge'
import { StageBadge } from '@/components/StageSelect'
import { FactScrollValue } from '@/components/FactScrollValue'
import { LeadActivityTimeline } from '@/components/LeadActivityTimeline'
import { LeadCrmConnectStrip } from '@/components/LeadCrmConnectStrip'
import type { LeadActivityItem } from '@/lib/profile'

type Props = {
  item: ScoredLead
  open: boolean
  onToggle: () => void
  index?: number
  enrichment?: EnrichmentSnapshot | null
  enriching?: boolean
  onEnrich?: () => void
  onRunAutomation?: () => void
  activities?: LeadActivityItem[]
}

function statusHint(l: ScoredLead) {
  if (l.duplicateOf) {return `Duplicate of ${l.duplicateOf}`}
  if (l.junk) {return l.junkReasons[0] || 'Junk'}
  return null
}

function scoreHint(item: ScoredLead): string {
  const n = item.scoreBreakdown?.length || item.reasons.length
  return n ? `${n} factors · fit ${item.score}/100` : `Fit ${item.score}/100`
}

export function LeadCard({
  item,
  open,
  onToggle,
  index = 0,
  enrichment,
  enriching,
  onEnrich,
  onRunAutomation,
  activities = [],
}: Props) {
  const { lead, score, tier, reasons, junk, duplicateOf } = item
  const dimmed = junk || !!duplicateOf
  const facts = factsWithEnrichment(lead, enrichment)
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
            {!open && <StageBadge stage={item.stage} />}
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
          <div className="space-y-3 border-t border-[var(--sq-border)] px-5 pb-5 pt-4 sm:px-6">
            <div className="lead-panel-block">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p
                  className="fit-score shrink-0 font-mono text-[1.35rem] font-bold tabular-nums tracking-tight text-white"
                  aria-label={`Fit score ${score} of 100`}
                >
                  {score}
                  <span className="text-[0.85em] font-semibold text-[var(--sq-text-muted)]">/100</span>
                </p>
                <TierBadge tier={tier} />
                <StageBadge stage={item.stage} />
                <StatusBadge item={item} />
              </div>
              {item.junkReasons.length > 0 && (
                <p className="mt-3 text-sm font-medium text-sq-danger">{item.junkReasons.join(' · ')}</p>
              )}
            </div>

            {(facts.length > 0 || onEnrich || onRunAutomation) && (
              <div className="lead-panel-block space-y-3">
                {(onEnrich || onRunAutomation) && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {onEnrich && (
                      <button
                        type="button"
                        className="btn btn-ghost w-full sm:w-auto"
                        disabled={enriching}
                        onClick={e => {
                          e.stopPropagation()
                          onEnrich()
                        }}
                      >
                        <Zap className="size-3.5" strokeWidth={1.75} />
                        {enriching ? 'Filling in…' : 'Fill from website'}
                      </button>
                    )}
                    {onRunAutomation && (
                      <button
                        type="button"
                        className="btn btn-ghost w-full sm:w-auto"
                        onClick={e => {
                          e.stopPropagation()
                          onRunAutomation()
                        }}
                      >
                        <Workflow className="size-3.5" strokeWidth={1.75} />
                        Run automation
                      </button>
                    )}
                  </div>
                )}
                {enrichment && (
                  <p className="text-[11px] leading-relaxed text-[var(--sq-text-muted)]">
                    <span className="text-[var(--sq-text-secondary)]">% sure</span> = how reliable that
                    field looks (not the fit score).
                  </p>
                )}
                {facts.length > 0 && (
                  <dl className="fact-grid">
                    {facts.map(f => {
                      const Icon = f.icon
                      const pct =
                        f.confidence != null && f.confidence > 0
                          ? Math.round(f.confidence * 100)
                          : null
                      return (
                        <div key={f.key} className="fact-row">
                          <span
                            className="icon-well icon-well-sm"
                            style={{ background: `${f.color}22`, color: f.color }}
                            aria-hidden
                          >
                            <Icon strokeWidth={1.75} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="fact-row-head">
                              <dt>{f.label}</dt>
                              {pct != null ? (
                                <span className="fact-conf" title="How reliable this field looks">
                                  {pct}% sure
                                </span>
                              ) : null}
                            </div>
                            <dd>
                              <FactScrollValue value={f.value} />
                            </dd>
                          </div>
                        </div>
                      )
                    })}
                  </dl>
                )}
              </div>
            )}

            {item.whyNow && (
              <div className="lead-panel-block">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--sq-text-muted)]">
                  Why now
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--sq-text-secondary)]">{item.whyNow}</p>
              </div>
            )}

            {!dimmed && (item.scoreBreakdown?.length || reasons.length > 0) && (
              <CollapsibleSection title="Score reasons" hint={scoreHint(item)} defaultOpen={false}>
                {item.scoreBreakdown?.length ? (
                  <ScoreBreakdown factors={item.scoreBreakdown} max={12} />
                ) : (
                  <ReasonChips reasons={reasons} max={12} />
                )}
              </CollapsibleSection>
            )}

            <CollapsibleSection
              title="Recent history"
              hint={
                activities.length
                  ? `${activities.length} event${activities.length === 1 ? '' : 's'}`
                  : 'No interactions yet'
              }
              defaultOpen={false}
            >
              <LeadActivityTimeline activities={activities} max={6} />
              <div className="mt-4 border-t border-[var(--sq-border)] pt-4">
                <LeadCrmConnectStrip lead={item} />
              </div>
            </CollapsibleSection>
          </div>
        </div>
      </div>
    </article>
  )
}
