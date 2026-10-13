'use client'

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  GitBranch,
  Loader2,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import type { ScoredLead } from '@/lib/scoring'
import { buildFunnelReport } from '@/lib/funnel'
import type { AutomationFeedItem } from '@/lib/todayFeed'
import { StageBadge } from '@/components/StageSelect'
import { TierBadge } from '@/components/StatusBadge'
import { KpiStat } from '@/components/KpiStat'

export type { AutomationFeedItem } from '@/lib/todayFeed'

export type TodayNav =
  | { tab: 'leads'; leadId?: string }
  | { tab: 'automate' }
  | { tab: 'runs' }
  | { tab: 'report' }

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

function Section({
  title,
  hint,
  icon: Icon,
  color,
  children,
  empty,
}: {
  title: string
  hint?: string
  icon: typeof Sparkles
  color: string
  children: React.ReactNode
  empty?: string
}) {
  const hasKids = Array.isArray(children)
    ? children.length > 0
    : Boolean(children)
  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-[var(--sq-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="icon-well icon-well-sm" style={{ background: `${color}22`, color }}>
            <Icon strokeWidth={1.75} />
          </span>
          <h2 className="text-[13px] font-semibold tracking-tight text-white">{title}</h2>
        </div>
        {hint ? (
          <p className="mt-1.5 pl-[calc(1.75rem+0.5rem)] text-[11px] leading-relaxed text-[var(--sq-text-muted)]">
            {hint}
          </p>
        ) : null}
      </div>
      <div className="divide-y divide-[var(--sq-border)]">
        {hasKids ? children : (
          <p className="px-4 py-6 text-center text-[13px] text-[var(--sq-text-muted)]">
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
      className="row-enter flex w-full items-center gap-3 px-4 py-3 text-left transition-[background,transform] duration-150 ease-[var(--ease-out)] hover:bg-white/[0.03] active:scale-[0.995]"
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

function ActivityRow({ item, index = 0 }: { item: AutomationFeedItem; index?: number }) {
  return (
    <div
      className="row-enter flex items-start gap-3 px-4 py-3"
      style={{ animationDelay: `${Math.min(index, 8) * 36}ms` }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-snug text-white">{item.title}</p>
        {item.subtitle ? (
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--sq-text-muted)]">{item.subtitle}</p>
        ) : null}
      </div>
      <FeedStatus label={item.statusLabel} tone={item.statusTone} />
    </div>
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
  const newA = clean.filter(l => l.tier === 'A' && (l.stage === 'new' || l.stage === 'enriched')).slice(0, 8)
  const changed = clean
    .filter(l => l.prevTier && l.prevTier !== l.tier)
    .slice(0, 8)
  const pending = runs.filter(r => r.status === 'pending').slice(0, 6)
  const done = runs.filter(r => r.status === 'done').slice(0, 4)
  const failed = runs.filter(r => r.status === 'failed').slice(0, 4)
  const followUps = clean
    .filter(l => l.followUpAt && new Date(l.followUpAt).getTime() <= Date.now() + 3 * 86400000)
    .slice(0, 8)
  const funnel = buildFunnelReport(leads)

  if (!leads.length) {
    return (
      <div className="panel px-6 py-16 text-center">
        <span
          className="icon-well mx-auto mb-4"
          style={{ background: 'rgba(251, 191, 36, 0.14)', color: '#fbbf24', width: '2.75rem', height: '2.75rem' }}
        >
          <Sparkles strokeWidth={1.75} />
        </span>
        <p className="text-xl font-semibold tracking-[-0.03em] text-white">Your day starts with a list</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--sq-text-secondary)]">
          Load fictional demo data to see A-tier matches, workflow runs, follow-ups, and the funnel — fully connected.
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

  return (
    <div className="space-y-4">
      {loading && (
        <p className="flex items-center gap-2 text-xs text-[var(--sq-text-muted)]">
          <Loader2 className="size-3.5 animate-spin" /> Refreshing…
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {funnel.steps.slice(0, 3).map(step => {
          const copy =
            step.stage === 'new'
              ? {
                  label: 'In your list',
                  sub: 'Clean leads after triage (not junk/dupes)',
                }
              : step.stage === 'enriched'
                ? {
                    label: 'Looked up',
                    sub:
                      step.conversionFromPrev != null
                        ? `${step.conversionFromPrev}% of list — website details filled in`
                        : 'Website details filled in',
                  }
                : {
                    label: 'Contacted',
                    sub:
                      step.conversionFromPrev != null
                        ? `${step.conversionFromPrev}% of looked-up — outreach started`
                        : 'Outreach started',
                  }
          return (
            <KpiStat
              key={step.stage}
              label={copy.label}
              value={step.count}
              sub={copy.sub}
              subMuted={step.stage === 'new'}
              onClick={() => onNavigate({ tab: 'report' })}
            />
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="New A-tier matches" icon={Sparkles} color="#fbbf24" empty="No fresh A-tier leads.">
          {newA.map((l, i) => (
            <Row
              key={l.id}
              index={i}
              title={l.lead.company || l.id}
              meta={l.whyNow}
              onClick={() => onNavigate({ tab: 'leads', leadId: l.id })}
              trailing={
                <span className="flex items-center gap-1.5">
                  <TierBadge tier={l.tier} />
                  <StageBadge stage={l.stage} />
                </span>
              }
            />
          ))}
        </Section>

        <Section title="Score / tier changes" icon={TrendingUp} color="#60a5fa" empty="No tier flips yet.">
          {changed.map((l, i) => (
            <Row
              key={l.id}
              index={i}
              title={l.lead.company || l.id}
              meta={`${l.prevTier} → ${l.tier} · ${l.prevScore ?? '—'} → ${l.score}`}
              onClick={() => onNavigate({ tab: 'leads', leadId: l.id })}
              trailing={<TierBadge tier={l.tier} />}
            />
          ))}
        </Section>

        <Section title="Triggers" icon={GitBranch} color="#a78bfa" empty="No runs yet — arm Automate.">
          {[...pending, ...failed, ...done].slice(0, 8).map((r, i) => (
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
          ))}
        </Section>

        <Section
          title="Automation output"
          hint="Steps already completed by armed workflows — no inbox approval."
          icon={FileText}
          color="#fbbf24"
          empty="Run a template on Automate to see sends and CRM syncs here."
        >
          {automationFeed.slice(0, 8).map((item, i) => (
            <ActivityRow key={item.id} item={item} index={i} />
          ))}
        </Section>

        <Section
          title="Follow-ups due"
          icon={Clock}
          color="#fb923c"
          empty="No follow-ups scheduled."
        >
          {followUps.map((l, i) => (
            <Row
              key={l.id}
              index={i}
              title={l.lead.company || l.id}
              meta={
                l.followUpAt
                  ? `Due ${new Date(l.followUpAt).toLocaleDateString()}`
                  : 'Follow up'
              }
              onClick={() => onNavigate({ tab: 'leads', leadId: l.id })}
              trailing={<StageBadge stage={l.stage} />}
            />
          ))}
        </Section>

        <Section title="Funnel snapshot" icon={TrendingUp} color="#94a3b8" empty="">
          <div className="space-y-2 px-4 py-3">
            {funnel.steps.map(step => {
              const max = funnel.steps[0]?.count || 1
              const pct = Math.max(4, Math.round((step.count / max) * 100))
              return (
                <button
                  key={step.stage}
                  type="button"
                  className="block w-full text-left"
                  onClick={() => onNavigate({ tab: 'report' })}
                >
                  <div className="mb-1 flex justify-between text-[11px]">
                    <span className="text-[var(--sq-text-secondary)]">{step.label}</span>
                    <span className="font-mono tabular-nums text-white">{step.count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-[#fbbf24] transition-[width] duration-300 ease-[var(--ease-out)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </Section>
      </div>
    </div>
  )
}
