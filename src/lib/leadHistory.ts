import type { LeadActivityItem } from '@/lib/profile'
import type { NodeResult } from '@/lib/workflow'

export function activityLabel(kind: string): string {
  const map: Record<string, string> = {
    email_sent: 'Email',
    email_draft: 'Email preview',
    email_preview: 'Email preview',
    crm_sync: 'CRM',
    crm_push: 'CRM',
    enrich: 'Website fill',
    stage_change: 'Stage',
    notify: 'Alert',
    workflow_run: 'Workflow',
    sheets_append: 'Google Sheets',
    webhook: 'Webhook',
  }
  return map[kind] || kind.replace(/_/g, ' ')
}

export function activityFromNodeResult(
  nr: NodeResult,
  leadId: string,
  at = new Date().toISOString(),
): LeadActivityItem | null {
  if (!nr.ok) {
    return null
  }
  const id = `run-${nr.nodeId}-${at}`

  if (nr.type === 'action_draft_email') {
    const sent = nr.artifacts?.sent === true
    return {
      id,
      kind: sent ? 'email_sent' : 'email_preview',
      summary: String(nr.detail || (sent ? 'Email sent' : 'Email preview')),
      payload: { ...nr.artifacts, leadId },
      createdAt: at,
    }
  }
  if (nr.type === 'action_crm_push') {
    return {
      id,
      kind: 'crm_sync',
      summary: String(nr.detail || 'CRM sync'),
      payload: { ...nr.artifacts, leadId },
      createdAt: at,
    }
  }
  if (nr.type === 'action_notify') {
    return {
      id,
      kind: 'notify',
      summary: String(nr.detail || 'Notification'),
      payload: { ...nr.artifacts, leadId },
      createdAt: at,
    }
  }
  if (nr.type === 'action_move_stage' && nr.artifacts?.activity) {
    const act = nr.artifacts.activity as LeadActivityItem
    return {
      id: act.id || id,
      kind: act.kind,
      summary: act.summary,
      payload: { ...act.payload, leadId },
      createdAt: at,
    }
  }
  if (nr.type === 'action_enrich') {
    return {
      id,
      kind: 'enrich',
      summary: String(nr.detail || 'Workflow enrich'),
      payload: { leadId },
      createdAt: at,
    }
  }
  if (nr.type === 'action_tag') {
    return {
      id,
      kind: 'tag',
      summary: String(nr.detail || 'Tag added'),
      payload: { leadId },
      createdAt: at,
    }
  }
  return null
}

export function activityFromReportEvent(event: {
  id: string
  kind: string
  summary: string
  payload?: Record<string, unknown>
  createdAt?: string | Date
}): LeadActivityItem | null {
  const leadId = event.payload?.leadId
  if (typeof leadId !== 'string' || !leadId) {
    return null
  }
  const createdAt =
    event.createdAt instanceof Date
      ? event.createdAt.toISOString()
      : typeof event.createdAt === 'string'
        ? event.createdAt
        : new Date().toISOString()

  return {
    id: `evt-${event.id}`,
    kind: event.kind,
    summary: event.summary,
    payload: event.payload,
    createdAt,
  }
}

export function mergeLeadActivities(
  existing: LeadActivityItem[],
  incoming: LeadActivityItem[],
  max = 24,
): LeadActivityItem[] {
  const byId = new Map<string, LeadActivityItem>()
  for (const item of [...incoming, ...existing]) {
    const key = item.id || `${item.kind}-${item.createdAt}-${item.summary}`
    if (!byId.has(key)) {
      byId.set(key, item)
    }
  }
  return [...byId.values()]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, max)
}
