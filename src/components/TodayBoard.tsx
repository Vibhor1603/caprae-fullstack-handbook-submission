'use client'

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  GitBranch,
  Loader2,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ScoredLead } from '@/lib/scoring'
import { buildFunnelReport, buildReportActions } from '@/lib/funnel'
import type { AutomationFeedItem } from '@/lib/todayFeed'
import { StageBadge } from '@/components/StageSelect'
import { TierBadge } from '@/components/StatusBadge'
import { KpiStat } from '@/components/KpiStat'

export type { AutomationFeedItem } from '@/lib/todayFeed'

export type TodayNav =
  | { tab: 'leads'; leadId?: string }
  | { tab: 'automate' }
  | { tab: 'runs' }

export type RunLite = {
  id: string
  status: string
  trigger: string
  leadLabel?: string | null
  workflowName?: string
  createdAt?: string
}

type Props = {
  leads: ScoredLead[]
  runs: RunLite[]
  automationFeed: AutomationFeedItem[]
  loading?: boolean
  onNavigate: (nav: TodayNav) => void
  onLoadDemo?: () => void
  demoBusy?: boolean
}

function Card({
  title,
  hint,
  icon: Icon,
  color,
  action,
  children,
  empty,
  className = '',
}: {
  title: string
  hint?: string
  icon: LucideIcon
  color: string
  action?: { label: string; onClick: () => void }
  children: React.ReactNode
  empty?: string
  className?: string
}) {
  const hasKids = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <section className={`panel overflow-hidden ${className}`.trim()}>
      <div className="flex items-start justify-between gap-3 border-b border-[var(--sq-border)] px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="icon-well icon-well-sm" style={{ background: `${color}22`, color }}>
              <Icon strokeWidth={1.75} />
            </span>
            <h2 className="text-[13px] font-semibold tracking-tight text-white">{title}</h2>
          </div>
          {hint ? (
            <p className="mt-1.5 pl-[calc(1.75rem+0.625rem)] text-[11px] leading-relaxed text-[var(--sq-text-muted)]">
              {hint}
            </p>
          ) : null}
        </div>
        {action ? (
          <button
            type="button"
            className="shrink-0 text-[11px] font-medium text-[var(--sq-text-muted)] transition-colors hover:text-white"
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ) : null}
      </div>
      <div className="divide-y divide-[var(--sq-border)]">
        {hasKids ? (
          children
        ) : (
          <p className="px-5 py-8 text-center text-[13px] text-[var(--sq-text-muted)]">
            {empty || 'Nothing here yet.'}
          </p>
        )}
      </div>
    </section>
  )
}

function Row({
  title,
  meta,
  onClick,
  trailing,
  index = 0,
}: {
  title: string
  meta?: string
  onClick: () => void
  trailing?: React.ReactNode
  index?: number
}) {
  return (
    <button
      type="button"
      className="row-enter flex w-full items-center gap-3 px-5 py-3.5 text-left transition-[background,transform] duration-150 ease-[var(--ease-out)] hover:bg-white/[0.03] active:scale-[0.995]"
      style={{ animationDelay: `${Math.min(index, 8) * 36}ms` }}
      onClick={onClick}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-white">{title}</p>
        {meta ? (
          <p className="mt-0.5 truncate text-[11px] text-[var(--sq-text-muted)]">{meta}</p>
        ) : null}
      </div>
      {trailing}
      <ArrowRight className="size-3.5 shrink-0 text-[var(--sq-text-muted)]" strokeWidth={1.75} />
    </button>
  )
}

function FeedStatus({
  label,
  tone,
}: {
  label: string
  tone: AutomationFeedItem['statusTone']
}) {
  const cls =
    tone === 'ok' ? 'badge-ok' : tone === 'warn' ? 'badge-warn' : 'badge-tier-c'
  return <span className={`badge shrink-0 ${cls}`}>{label}</span>
}

function PulseItem({
  icon: Icon,
  color,
  label,
  value,
  onClick,
}: {
  icon: LucideIcon
  color: string
  label: string
  value: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--sq-border)] bg-black/20 px-3.5 py-3 text-left transition-colors hover:border-[var(--sq-border-strong)] hover:bg-white/[0.03]"
      onClick={onClick}
    >
      <span className="icon-well icon-well-sm shrink-0" style={{ background: `${color}22`, color }}>
        <Icon strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-[var(--sq-text-muted)]">{label}</span>
        <span className="mt-0.5 block truncate text-[13px] font-medium text-white">{value}</span>
      </span>
      <ArrowRight className="size-3.5 shrink-0 text-[var(--sq-text-muted)]" strokeWidth={1.75} />
    </button>
  )
}

export function TodayBoard({
  leads,
  runs,
  automationFeed,
  loading,
  onNavigate,
  onLoadDemo,
  demoBusy,
}: Props) {
  const clean = leads.filter(l => !l.junk && !l.duplicateOf)
  const aTier = clean.filter(l => l.tier === 'A')
  const newA = aTier
    .filter(l => l.stage === 'new' || l.stage === 'enriched')
    .slice(0, 6)
  const changed = clean
    .filter(l => l.prevTier && l.prevTier !== l.tier)
    .slice(0, 3)
  const recentRuns = [...runs].slice(0, 4)
  const followUps = clean
    .filter(l => l.followUpAt && new Date(l.followUpAt).getTime() <= Date.now() + 3 * 86400000)
    .slice(0, 4)
  const funnel = buildFunnelReport(leads)
  const nextActions = buildReportActions(leads).slice(0, 5)
  const activity = automationFeed.slice(0, 5)

  if (!leads.length) {
    return (
      <div className="panel px-6 py-16 text-center">
        <span
          className="icon-well mx-auto mb-4"
          style={{
            background: 'rgba(251, 191, 36, 0.14)',
            color: '#fbbf24',
            width: '2.75rem',
            height: '2.75rem',
          }}
        >
          <Sparkles strokeWidth={1.75} />
        </span>
        <p className="text-xl font-semibold tracking-[-0.03em] text-white">Start with a lead list</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--sq-text-secondary)]">
          Load demo data to see best matches, workflows, and deal stages.
        </p>
        {onLoadDemo && (
          <button
            type="button"
            className="btn btn-accent mt-8"
            disabled={demoBusy}
            onClick={onLoadDemo}
          >
            <Sparkles className="size-3.5" strokeWidth={1.75} />
            {demoBusy ? 'Loading demo…' : 'Load demo data'}
          </button>
        )}
      </div>
    )
  }

  const contacted = funnel.steps.find(s => s.stage === 'contacted')
  const researched = funnel.steps.find(s => s.stage === 'enriched')

  return (
    <div className="space-y-5">
      {loading && (
        <p className="flex items-center gap-2 text-xs text-[var(--sq-text-muted)]">
          <Loader2 className="size-3.5 animate-spin" /> Refreshing…
        </p>
      )}

      {/* KPI strip — reference: compact metric cards with icon wells */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiStat
          label="Shortlist"
          value={funnel.cleanTotal}
          sub="Clean leads in play"
          subMuted
          icon={Users}
          tone="#94a3b8"
          onClick={() => onNavigate({ tab: 'leads' })}
        />
        <KpiStat
          label="A-tier"
          value={funnel.tierA}
          sub={newA.length ? `${newA.length} ready to work` : 'Best fits'}
          icon={Sparkles}
          tone="#fbbf24"
          onClick={() => onNavigate({ tab: 'leads' })}
        />
        <KpiStat
          label="Researched"
          value={researched?.count ?? 0}
          sub={
            researched?.conversionFromPrev != null
              ? `${researched.conversionFromPrev}% of shortlist`
              : 'Website details filled'
          }
          icon={Target}
          tone="#a78bfa"
          onClick={() => onNavigate({ tab: 'leads' })}
        />
        <KpiStat
          label="In motion"
          value={contacted?.count ?? funnel.inMotion}
          sub={followUps.length ? `${followUps.length} follow-up${followUps.length === 1 ? '' : 's'} due` : 'Outreach started'}
          icon={TrendingUp}
          tone="#4ade80"
          onClick={() => onNavigate({ tab: 'leads' })}
        />
      </div>

      {/* Primary row — actions + matches (asymmetric like reference mid-row) */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card
          className="lg:col-span-3"
          title="Do this next"
          hint="Highest-leverage moves on this shortlist."
          icon={CheckCircle2}
          color="#4ade80"
          empty="Shortlist looks quiet — open Leads or run Automate."
          action={{ label: 'Open leads', onClick: () => onNavigate({ tab: 'leads' }) }}
        >
          {nextActions.map((action, i) => (
            <Row
              key={action.id}
              index={i}
              title={action.title}
              meta={action.detail}
              onClick={() =>
                onNavigate(
                  action.leadId
                    ? { tab: 'leads', leadId: action.leadId }
                    : { tab: 'leads' },
                )
              }
            />
          ))}
        </Card>

        <Card
          className="lg:col-span-2"
          title="Best matches"
          hint="A-tier, still early stage."
          icon={Sparkles}
          color="#fbbf24"
          empty="No A-tier leads yet."
          action={{ label: 'All leads', onClick: () => onNavigate({ tab: 'leads' }) }}
        >
          {newA.map((l, i) => (
            <Row
              key={l.id}
              index={i}
              title={l.lead.company || l.id}
              meta={l.whyNow}
              onClick={() => onNavigate({ tab: 'leads', leadId: l.id })}
              trailing={<TierBadge tier={l.tier} />}
            />
          ))}
        </Card>
      </div>

      {/* Secondary row — activity feed + pulse modules (not six identical lists) */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card
          className="lg:col-span-3"
          title="Activity"
          hint="Workflow runs and what they did."
          icon={GitBranch}
          color="#a78bfa"
          empty="Run a template on Automate to fill this."
          action={{ label: 'View runs', onClick: () => onNavigate({ tab: 'runs' }) }}
        >
          {recentRuns.length === 0 && activity.length === 0
            ? null
            : [
                ...recentRuns.map((r, i) => (
                  <Row
                    key={r.id}
                    index={i}
                    title={r.workflowName || 'Workflow'}
                    meta={`${r.trigger} · ${r.leadLabel || '—'} · ${r.status}`}
                    onClick={() => onNavigate({ tab: 'runs' })}
                    trailing={
                      r.status === 'pending' ? (
                        <Clock className="size-3.5 text-[#fbbf24]" />
                      ) : r.status === 'failed' ? (
                        <AlertTriangle className="size-3.5 text-sq-danger" />
                      ) : (
                        <CheckCircle2 className="size-3.5 text-[#4ade80]" />
                      )
                    }
                  />
                )),
                ...activity.map((item, i) => (
                  <div
                    key={item.id}
                    className="row-enter flex items-start gap-3 px-5 py-3.5"
                    style={{
                      animationDelay: `${Math.min(i + recentRuns.length, 8) * 36}ms`,
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium leading-snug text-white">
                        {item.title}
                      </p>
                      {item.subtitle ? (
                        <p className="mt-1 text-[11px] leading-relaxed text-[var(--sq-text-muted)]">
                          {item.subtitle}
                        </p>
                      ) : null}
                    </div>
                    <FeedStatus label={item.statusLabel} tone={item.statusTone} />
                  </div>
                )),
              ]}
        </Card>

        <section className="panel overflow-hidden px-5 py-4 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2.5">
            <span
              className="icon-well icon-well-sm"
              style={{ background: 'rgba(251, 146, 60, 0.14)', color: '#fb923c' }}
            >
              <Clock strokeWidth={1.75} />
            </span>
            <h2 className="text-[13px] font-semibold tracking-tight text-white">Needs attention</h2>
          </div>
          <div className="space-y-2.5">
            <PulseItem
              icon={Clock}
              color="#fb923c"
              label="Follow-ups"
              value={
                followUps.length
                  ? `${followUps.length} due · ${followUps[0].lead.company || 'lead'}`
                  : 'None scheduled'
              }
              onClick={() =>
                onNavigate(
                  followUps[0]
                    ? { tab: 'leads', leadId: followUps[0].id }
                    : { tab: 'leads' },
                )
              }
            />
            <PulseItem
              icon={TrendingUp}
              color="#60a5fa"
              label="Score changes"
              value={
                changed.length
                  ? `${changed.length} moved · ${changed[0].lead.company || 'lead'}`
                  : 'No tier moves yet'
              }
              onClick={() =>
                onNavigate(
                  changed[0] ? { tab: 'leads', leadId: changed[0].id } : { tab: 'leads' },
                )
              }
            />
            <PulseItem
              icon={GitBranch}
              color="#a78bfa"
              label="Automate"
              value={
                recentRuns.some(r => r.status === 'pending')
                  ? 'Runs in flight'
                  : 'Templates & canvas'
              }
              onClick={() => onNavigate({ tab: 'automate' })}
            />
            {followUps.slice(0, 2).map(l => (
              <button
                key={l.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-1 py-1.5 text-left hover:bg-white/[0.03]"
                onClick={() => onNavigate({ tab: 'leads', leadId: l.id })}
              >
                <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--sq-text-secondary)]">
                  {l.lead.company || l.id}
                  {l.followUpAt
                    ? ` · ${new Date(l.followUpAt).toLocaleDateString()}`
                    : ''}
                </span>
                <StageBadge stage={l.stage} />
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
