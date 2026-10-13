/** Maps report API events into Today “automation activity” rows. */

export type AutomationFeedItem = {
  id: string
  title: string
  subtitle: string
  statusLabel: string
  statusTone: 'ok' | 'neutral' | 'warn'
}

type ReportEventRow = {
  id: string
  kind: string
  summary: string
  payload?: Record<string, unknown>
}

const FEED_KINDS = new Set([
  'email_sent',
  'email_draft',
  'crm_push',
  'sheets_append',
  'webhook',
  'notify',
])

export function isAutomationFeedKind(kind: string): boolean {
  return FEED_KINDS.has(kind)
}

export function toAutomationFeedItem(event: ReportEventRow): AutomationFeedItem {
  const p = event.payload || {}
  const company = typeof p.company === 'string' ? p.company : null

  if (event.kind === 'email_sent' || (event.kind === 'email_draft' && p.sent === true)) {
    const subject = typeof p.subject === 'string' ? p.subject : 'Outbound email'
    const to = typeof p.to === 'string' ? p.to : null
    return {
      id: event.id,
      title: subject,
      subtitle: [to, company].filter(Boolean).join(' · ') || event.summary,
      statusLabel: 'Sent',
      statusTone: 'ok',
    }
  }

  if (event.kind === 'email_draft') {
    return {
      id: event.id,
      title: 'Email preview (dry run)',
      subtitle: event.summary.replace(/^Email preview · /, ''),
      statusLabel: 'Preview',
      statusTone: 'neutral',
    }
  }

  if (event.kind === 'sheets_append') {
    return {
      id: event.id,
      title: 'Google Sheets row appended',
      subtitle: company || event.summary,
      statusLabel: 'Synced',
      statusTone: 'ok',
    }
  }

  if (event.kind === 'webhook') {
    return {
      id: event.id,
      title: 'CRM webhook',
      subtitle: event.summary,
      statusLabel: 'Synced',
      statusTone: 'ok',
    }
  }

  if (event.kind === 'crm_push') {
    const status = typeof p.status === 'number' ? p.status : null
    const synced = status != null ? status >= 200 && status < 300 : !!p.webhook
    return {
      id: event.id,
      title: synced ? 'CRM row synced' : 'CRM row exported',
      subtitle: company || event.summary.replace(/^CRM sync · /, ''),
      statusLabel: synced ? 'Synced' : 'Ready',
      statusTone: synced ? 'ok' : 'neutral',
    }
  }

  if (event.kind === 'notify') {
    return {
      id: event.id,
      title: 'Team notification',
      subtitle: event.summary,
      statusLabel: p.sent === false ? 'Preview' : 'Delivered',
      statusTone: p.sent === false ? 'neutral' : 'ok',
    }
  }

  return {
    id: event.id,
    title: event.summary,
    subtitle: company || '',
    statusLabel: 'Done',
    statusTone: 'neutral',
  }
}
