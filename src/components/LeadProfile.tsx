'use client'

import { ArrowLeft, Building2, UserRound, Zap, Workflow } from 'lucide-react'
import type { ScoredLead } from '@/lib/scoring'
import type { EnrichmentSnapshot } from '@/lib/enrichment'
import type { LeadActivityItem } from '@/lib/profile'
import { buildLeadProfile } from '@/lib/profile'
import { CompanyAvatar } from '@/components/CompanyAvatar'
import { ConfidenceMeter } from '@/components/ConfidenceMeter'
import { ScoreBreakdown } from '@/components/ScoreBreakdown'
import { StageSelect, StageBadge } from '@/components/StageSelect'
import { TierBadge, StatusBadge } from '@/components/StatusBadge'
import { ExportPresetsMenu } from '@/components/ExportPresetsMenu'
import type { PipelineStage } from '@/lib/pipeline'

function FieldRow({
  label,
  value,
  source,
}: {
  label: string
  value: string | number | null | undefined
  source?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--sq-border)] py-2 last:border-0">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--sq-text-muted)]">
          {label}
        </p>
        <p className="mt-0.5 text-[13px] text-white">{value ?? '—'}</p>
      </div>
      {source ? (
        <span className="shrink-0 text-[10px] text-[var(--sq-text-muted)]">{source}</span>
      ) : null}
    </div>
  )
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
  const profile =
    item.profile ||
    buildLeadProfile(item.lead, { enrichment, whyNow: item.whyNow })
  const company = item.lead.company?.trim() || 'Untitled company'
  const succ = profile.owner.succession

  return (
    <div className="tab-view space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          <ArrowLeft className="size-3.5" strokeWidth={1.75} />
          Back to list
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <ExportPresetsMenu leads={[item]} label="Export lead" />
          <button type="button" className="btn btn-ghost" disabled={enriching} onClick={onEnrich}>
            <Zap className="size-3.5" strokeWidth={1.75} />
            {enriching ? 'Enriching…' : 'Enrich from website'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onRunAutomation}>
            <Workflow className="size-3.5" strokeWidth={1.75} />
            Run automation
          </button>
        </div>
      </div>

      <header className="panel flex flex-wrap items-start gap-4 px-5 py-5">
        <CompanyAvatar company={company} website={item.lead.website} email={item.lead.email} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-[-0.03em] text-white">{company}</h2>
            <TierBadge tier={item.tier} />
            <StatusBadge item={item} />
            <StageBadge stage={item.stage} />
          </div>
          <p className="mt-1 text-sm text-[var(--sq-text-secondary)]">
            {item.lead.ownerName || '—'}
            {item.lead.title ? ` · ${item.lead.title}` : ''}
          </p>
          {item.whyNow && (
            <p className="mt-3 text-sm leading-relaxed text-[var(--sq-text-secondary)]">
              <span className="font-semibold text-[#fbbf24]">Why now · </span>
              {item.whyNow}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className="font-mono text-3xl font-bold tabular-nums text-white">
            {item.score}
            <span className="text-base text-[var(--sq-text-muted)]">/100</span>
          </p>
          <StageSelect value={item.stage} onChange={onStageChange} />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="icon-well icon-well-sm" style={{ background: 'rgba(96,165,250,0.14)', color: '#60a5fa' }}>
              <Building2 strokeWidth={1.75} />
            </span>
            <h3 className="text-[13px] font-semibold text-white">Company</h3>
          </div>
          <FieldRow label="Industry" value={profile.company.industry.value} source={profile.company.industry.source} />
          <FieldRow label="Location" value={profile.company.location.value} source={profile.company.location.source} />
          <FieldRow label="Founded" value={profile.company.foundedYear.value} source={profile.company.foundedYear.source} />
          <FieldRow label="Age" value={profile.company.ageYears.value != null ? `${profile.company.ageYears.value} yrs` : null} source={profile.company.ageYears.source} />
          <FieldRow label="Revenue band" value={profile.company.revenueBand.value} source={profile.company.revenueBand.source} />
          <FieldRow label="Employee band" value={profile.company.employeeBand.value} source={profile.company.employeeBand.source} />
          <FieldRow label="Services" value={profile.company.services.value} source={profile.company.services.source} />
          <FieldRow label="Website" value={profile.company.websiteStatus.value} source={profile.company.websiteStatus.source} />
        </section>

        <section className="panel px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="icon-well icon-well-sm" style={{ background: 'rgba(167,139,250,0.14)', color: '#a78bfa' }}>
              <UserRound strokeWidth={1.75} />
            </span>
            <h3 className="text-[13px] font-semibold text-white">Owner</h3>
          </div>
          <FieldRow label="Name" value={profile.owner.name.value} source={profile.owner.name.source} />
          <FieldRow label="Role" value={profile.owner.role.value} source={profile.owner.role.source} />
          <FieldRow label="Est. tenure" value={profile.owner.estimatedTenure.value} source={profile.owner.estimatedTenure.source} />
          <FieldRow label="Contactability" value={profile.owner.contactability.value} />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {succ.longTenure && (
              <span className="badge" style={{ background: 'rgba(251,191,36,0.14)', color: '#fbbf24' }}>
                Long tenure
              </span>
            )}
            {succ.noVisibleSuccessor && (
              <span className="badge" style={{ background: 'rgba(244,63,94,0.14)', color: '#f43f5e' }}>
                No visible successor
              </span>
            )}
            {succ.businessAgeOver15 && (
              <span className="badge" style={{ background: 'rgba(96,165,250,0.14)', color: '#60a5fa' }}>
                Age 15+ yrs
              </span>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel px-5 py-4">
          <h3 className="mb-3 text-[13px] font-semibold text-white">Score breakdown</h3>
          <ScoreBreakdown factors={item.scoreBreakdown} />
          {profile.insights.riskFlags.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--sq-text-muted)]">
                Risk flags
              </p>
              <ul className="space-y-1">
                {profile.insights.riskFlags.map(flag => (
                  <li key={flag} className="text-[13px] text-sq-danger">
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {profile.insights.lastVerified && (
            <p className="mt-3 text-[11px] text-[var(--sq-text-muted)]">
              Last verified {new Date(profile.insights.lastVerified).toLocaleString()}
            </p>
          )}
        </section>

        <section className="panel px-5 py-4">
          <h3 className="mb-3 text-[13px] font-semibold text-white">Field confidence</h3>
          {enrichment ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <ConfidenceMeter label="Email" value={enrichment.email.value} confidence={enrichment.email.confidence} />
              <ConfidenceMeter label="Phone" value={enrichment.phone.value} confidence={enrichment.phone.confidence} />
              <ConfidenceMeter label="Founded" value={enrichment.yearFounded.value} confidence={enrichment.yearFounded.confidence} />
              <ConfidenceMeter label="Services" value={enrichment.services.value} confidence={enrichment.services.confidence} />
            </div>
          ) : (
            <p className="text-sm text-[var(--sq-text-muted)]">Enrich to see confidence meters.</p>
          )}
        </section>
      </div>

      <section className="panel px-5 py-4">
        <h3 className="mb-3 text-[13px] font-semibold text-white">Activity</h3>
        {activities.length === 0 ? (
          <p className="text-sm text-[var(--sq-text-muted)]">No activity logged yet.</p>
        ) : (
          <ul className="space-y-2">
            {activities.map((a, i) => (
              <li
                key={a.id || `${a.kind}-${i}`}
                className="flex items-start justify-between gap-3 border-b border-[var(--sq-border)] py-2 last:border-0"
              >
                <div>
                  <p className="text-[13px] text-white">{a.summary}</p>
                  <p className="text-[11px] text-[var(--sq-text-muted)]">{a.kind}</p>
                </div>
                <time className="shrink-0 text-[11px] text-[var(--sq-text-muted)]">
                  {new Date(a.createdAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
