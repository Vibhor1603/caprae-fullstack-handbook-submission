'use client'

import { ArrowLeft, Workflow, Zap } from 'lucide-react'
import type { ScoredLead } from '@/lib/scoring'
import type { EnrichmentSnapshot } from '@/lib/enrichment'
import type { LeadActivityItem } from '@/lib/profile'
import { buildLeadProfile } from '@/lib/profile'
import { factsWithEnrichment } from '@/lib/leadDisplay'
import { CompanyAvatar } from '@/components/CompanyAvatar'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { ReasonChips } from '@/components/ReasonChips'
import { ScoreBreakdown } from '@/components/ScoreBreakdown'
import { ScoreMeter } from '@/components/ScoreMeter'
import { StageSelect, StageBadge } from '@/components/StageSelect'
import { TierBadge, StatusBadge } from '@/components/StatusBadge'
import { FactScrollValue } from '@/components/FactScrollValue'
import { LeadActivityTimeline } from '@/components/LeadActivityTimeline'
import { LeadCrmConnectStrip } from '@/components/LeadCrmConnectStrip'
import { ExportPresetsMenu } from '@/components/ExportPresetsMenu'
import type { PipelineStage } from '@/lib/pipeline'

type GuideFact = { key: string; label: string; value: string }

function guideFactsFromDeal(
  deal: ReturnType<typeof buildLeadProfile>['deal'],
): GuideFact[] {
  const rows: GuideFact[] = []
  if (deal.locationsCount != null) {
    rows.push({
      key: 'locations',
      label: 'Locations',
      value: String(deal.locationsCount),
    })
  } else if (deal.multiLocation) {
    rows.push({ key: 'locations', label: 'Locations', value: 'Multi-location' })
  }
  if (deal.googleRating != null) {
    rows.push({
      key: 'reputation',
      label: 'Reputation',
      value:
        deal.reviewCount != null
          ? `${deal.googleRating.toFixed(1)}★ · ${deal.reviewCount} reviews`
          : `${deal.googleRating.toFixed(1)}★`,
    })
  }
  if (deal.licensedOrBonded || deal.bbbAccredited) {
    rows.push({
      key: 'license',
      label: 'Licensed / bonded',
      value:
        [deal.licensesNote, deal.bbbAccredited ? 'BBB accredited' : null]
          .filter(Boolean)
          .join(' · ') || 'Yes',
    })
  }
  if (deal.saleLanguageSnippet) {
    rows.push({
      key: 'sale',
      label: 'Sale / retirement cue',
      value: deal.saleLanguageSnippet,
    })
  }
  if (deal.customerConcentration) {
    rows.push({
      key: 'concentration',
      label: 'Customer concentration',
      value: deal.customerConcentration,
    })
  }
  if (deal.ownerReachLabel) {
    rows.push({
      key: 'reach',
      label: 'Owner reach',
      value: deal.ownerReachLabel,
    })
  }
  return rows
}

export function LeadProfile({
  item,
  enrichment,
  activities = [],
  enriching,
  onBack,
  onStageChange,
  onEnrich,
  onRunAutomation,
}: {
  item: ScoredLead
  enrichment?: EnrichmentSnapshot | null
  activities?: LeadActivityItem[]
  enriching?: boolean
  onBack: () => void
  onStageChange: (stage: PipelineStage) => void
  onEnrich: () => void
  onRunAutomation: () => void
}) {
  const profile = buildLeadProfile(item.lead, {
    enrichment,
    whyNow: item.whyNow,
    riskFlags: item.profile?.insights.riskFlags,
  })
  const company = item.lead.company?.trim() || 'Untitled company'
  const facts = factsWithEnrichment(item.lead, enrichment)
  const guideFacts = guideFactsFromDeal(profile.deal)
  const dimmed = item.junk || !!item.duplicateOf
  const scoreHint = item.scoreBreakdown?.length
    ? `${item.scoreBreakdown.length} factors · fit ${item.score}/100`
    : item.reasons.length
      ? `${item.reasons.length} factors · fit ${item.score}/100`
      : `Fit ${item.score}/100`

  return (
    <div className="tab-view space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          <ArrowLeft className="size-3.5" strokeWidth={1.75} />
          Back to list
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <ExportPresetsMenu leads={[item]} label="Export lead" />
          <StageSelect value={item.stage} onChange={onStageChange} />
        </div>
      </div>

      <div className="lead-sheet">
        <article className="lead-card" data-open="true" data-dim={dimmed}>
          <div className="lead-card-summary pointer-events-none">
            <CompanyAvatar company={company} website={item.lead.website} email={item.lead.email} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className="truncate text-[15px] font-semibold tracking-[-0.025em] text-white">
                  {company}
                </h2>
                <TierBadge tier={item.tier} />
                <StageBadge stage={item.stage} />
                <StatusBadge item={item} />
                {item.lead.industry ? (
                  <span className="truncate text-[12px] font-medium text-[var(--sq-text-muted)]">
                    {item.lead.industry}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-[13px] tracking-tight text-[var(--sq-text-secondary)]">
                {[item.lead.ownerName, item.lead.title].filter(Boolean).join(' · ') ||
                  'No contact on file'}
                {item.lead.email ? (
                  <span className="ml-2 font-mono text-[11px] text-[var(--sq-text-muted)]">
                    {item.lead.email}
                  </span>
                ) : null}
              </p>
            </div>
            <ScoreMeter score={item.score} />
          </div>

          <div className="lead-card-panel" style={{ gridTemplateRows: '1fr' }}>
            <div className="lead-card-panel-inner">
              <div className="space-y-3 border-t border-[var(--sq-border)] px-5 pb-5 pt-4 sm:px-6">
                <div className="lead-panel-block">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <p
                      className="fit-score shrink-0 font-mono text-[1.35rem] font-bold tabular-nums tracking-tight text-white"
                      aria-label={`Fit score ${item.score} of 100`}
                    >
                      {item.score}
                      <span className="text-[0.85em] font-semibold text-[var(--sq-text-muted)]">
                        /100
                      </span>
                    </p>
                    <TierBadge tier={item.tier} />
                    <StageBadge stage={item.stage} />
                    <StatusBadge item={item} />
                  </div>
                  {item.junkReasons.length > 0 && (
                    <p className="mt-3 text-sm font-medium text-sq-danger">
                      {item.junkReasons.join(' · ')}
                    </p>
                  )}
                </div>

                <div className="lead-panel-block space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      className="btn btn-ghost w-full sm:w-auto"
                      disabled={enriching}
                      onClick={onEnrich}
                    >
                      <Zap className="size-3.5" strokeWidth={1.75} />
                      {enriching ? 'Filling in…' : 'Fill from website'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost w-full sm:w-auto"
                      onClick={onRunAutomation}
                    >
                      <Workflow className="size-3.5" strokeWidth={1.75} />
                      Run automation
                    </button>
                  </div>
                  {enrichment && (
                    <p className="text-[11px] leading-relaxed text-[var(--sq-text-muted)]">
                      <span className="text-[var(--sq-text-secondary)]">% sure</span> = how reliable
                      that field looks (not the fit score).
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

                {item.whyNow && (
                  <div className="lead-panel-block">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--sq-text-muted)]">
                      Why now
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--sq-text-secondary)]">
                      {item.whyNow}
                    </p>
                  </div>
                )}

                {(guideFacts.length > 0 || profile.deal.badges.length > 0) && (
                  <div className="lead-panel-block space-y-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--sq-text-muted)]">
                        Buying guide
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--sq-text-muted)]">
                        ETA signals for outreach — from CSV / site cues, not legal advice.
                      </p>
                    </div>
                    {guideFacts.length > 0 && (
                      <dl className="fact-grid">
                        {guideFacts.map(f => (
                          <div key={f.key} className="fact-row fact-row--text">
                            <div className="min-w-0 flex-1">
                              <div className="fact-row-head">
                                <dt>{f.label}</dt>
                              </div>
                              <dd>
                                <FactScrollValue value={f.value} />
                              </dd>
                            </div>
                          </div>
                        ))}
                      </dl>
                    )}
                    {profile.deal.badges.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {profile.deal.badges.map(badge => (
                          <span
                            key={badge}
                            className="badge"
                            style={{ background: 'rgba(255,255,255,0.06)', color: '#d4d4d8' }}
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!dimmed && (item.scoreBreakdown?.length || item.reasons.length > 0) && (
                  <CollapsibleSection title="Score reasons" hint={scoreHint} defaultOpen={false}>
                    {item.scoreBreakdown?.length ? (
                      <ScoreBreakdown factors={item.scoreBreakdown} max={12} />
                    ) : (
                      <ReasonChips reasons={item.reasons} max={12} />
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
      </div>
    </div>
  )
}
