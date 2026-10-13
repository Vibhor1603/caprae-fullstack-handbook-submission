import { describe, expect, it } from 'vitest'
import { toAutomationFeedItem } from './todayFeed'

describe('toAutomationFeedItem', () => {
  it('marks live email events as sent', () => {
    const item = toAutomationFeedItem({
      id: '1',
      kind: 'email_sent',
      summary: 'Email sent · Intro · Acme',
      payload: { subject: 'Intro', to: 'a@example.com', company: 'Acme', sent: true },
    })
    expect(item.statusLabel).toBe('Sent')
    expect(item.title).toBe('Intro')
  })

  it('maps CRM sync with status', () => {
    const item = toAutomationFeedItem({
      id: '2',
      kind: 'crm_push',
      summary: 'CRM row posted (200)',
      payload: { status: 200, company: 'Acme' },
    })
    expect(item.statusLabel).toBe('Synced')
  })
})
