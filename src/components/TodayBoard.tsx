'use client'

import {
  AlertTriangle,
  ArrowRight,
  Bell,
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
import { StageBadge } from '@/components/StageSelect'
import { TierBadge } from '@/components/StatusBadge'

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

export type DraftLite = {
  id: string
  company: string
  subject?: string
  kind: 'email_draft' | 'crm_push' | 'notify'
}

type Props = {
  leads: ScoredLead[]
  runs: RunLite[]
  drafts: DraftLite[]
  loading?: boolean
  onNavigate: (nav: TodayNav) => void
  onLoadDemo?: () => void
  demoBusy?: boolean
}

function Section({
  title,
  icon: Icon,
  color,
  children,
  empty,
}: {
  title: string
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
      <div className="flex items-center gap-2 border-b border-[var(--sq-border)] px-4 py-3">
        <span className="icon-well icon-well-sm" style={{ background: `${color}22`, color }}>
          <Icon strokeWidth={1.75} />
        </span>
        <h2 className="text-[13px] font-semibold tracking-tight text-white">{title}</h2>
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

export function TodayBoard({
  leads,
  runs,
  drafts,
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
        {funnel.steps.slice(0, 3).map(step => (
          <button
            key={step.stage}
            type="button"
            className="kpi-card !flex-col !gap-1.5 text-left transition-transform duration-150 active:scale-[0.98]"
            onClick={() => onNavigate({ tab: 'report' })}
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--sq-text-muted)]">
              {step.label}
            </p>
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="font-mono text-2xl font-bold tabular-nums tracking-tight text-white">
                {step.count}
              </p>
              {step.conversionFromPrev != null && (
                <p className="text-[12px] font-medium tabular-nums text-[var(--sq-text-secondary)]">
                  {step.conversionFromPrev}% from prior
                </p>
              )}
            </div>
          </button>
        ))}
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

        <Section title="Drafts & CRM waiting" icon={FileText} color="#34d399" empty="No drafts waiting.">
          {drafts.slice(0, 8).map((d, i) => (
            <Row
              key={d.id}
              index={i}
              title={d.company}
              meta={d.subject || d.kind}
              onClick={() => onNavigate({ tab: 'runs' })}
              trailing={<Bell className="size-3.5 text-[#fb923c]" />}
            />
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
