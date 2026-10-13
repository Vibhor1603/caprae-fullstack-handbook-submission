'use client'

import { Mail, GitBranch, Database, Bell, Sparkles, Tag } from 'lucide-react'
import type { LeadActivityItem } from '@/lib/profile'
import { activityLabel } from '@/lib/leadHistory'

function ActivityIcon({ kind }: { kind: string }) {
  const k = kind.toLowerCase()
  if (k.includes('email')) {
    return <Mail className="size-3.5" strokeWidth={1.75} />
  }
  if (k.includes('crm') || k.includes('sheet') || k.includes('webhook')) {
    return <Database className="size-3.5" strokeWidth={1.75} />
  }
  if (k.includes('notify')) {
    return <Bell className="size-3.5" strokeWidth={1.75} />
  }
  if (k.includes('stage')) {
    return <GitBranch className="size-3.5" strokeWidth={1.75} />
  }
  if (k.includes('tag')) {
    return <Tag className="size-3.5" strokeWidth={1.75} />
  }
  return <Sparkles className="size-3.5" strokeWidth={1.75} />
}

function toneForKind(kind: string): { bg: string; color: string } {
  const k = kind.toLowerCase()
  if (k.includes('email_sent') || k === 'email_sent') {
    return { bg: 'rgba(34, 197, 94, 0.14)', color: 'var(--ok)' }
  }
  if (k.includes('crm') || k.includes('sheet')) {
    return { bg: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24' }
  }
  if (k.includes('stage')) {
    return { bg: 'rgba(167, 139, 250, 0.14)', color: '#a78bfa' }
  }
  return { bg: 'rgba(255, 255, 255, 0.06)', color: 'var(--sq-text-secondary)' }
}

export function LeadActivityTimeline({
  activities,
  max = 8,
  empty = 'Nothing yet — fill from website or run a workflow.',
}: {
  activities: LeadActivityItem[]
  max?: number
  empty?: string
}) {
  const list = activities.slice(0, max)
  if (!list.length) {
    return <p className="text-[12px] leading-relaxed text-[var(--sq-text-muted)]">{empty}</p>
  }

  return (
    <ul className="space-y-0">
      {list.map((a, i) => {
        const tone = toneForKind(a.kind)
        return (
          <li
            key={a.id || `${a.kind}-${a.createdAt}-${i}`}
            className="flex gap-3 py-2 first:pt-0"
          >
            <span
              className="icon-well icon-well-sm mt-0.5 shrink-0"
              style={{ background: tone.bg, color: tone.color }}
              aria-hidden
            >
              <ActivityIcon kind={a.kind} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-snug text-white">{a.summary}</p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--sq-text-muted)]">
                {activityLabel(a.kind)}
              </p>
            </div>
            <time
              className="shrink-0 pt-0.5 text-[10px] tabular-nums text-[var(--sq-text-muted)]"
              dateTime={a.createdAt}
            >
              {new Date(a.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
              {' · '}
              {new Date(a.createdAt).toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </time>
          </li>
        )
      })}
    </ul>
  )
}
