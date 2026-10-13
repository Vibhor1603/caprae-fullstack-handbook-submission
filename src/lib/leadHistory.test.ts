import { describe, expect, it } from 'vitest'
import { activityFromNodeResult, mergeLeadActivities } from './leadHistory'

describe('leadHistory', () => {
  it('maps sent email node results', () => {
    const act = activityFromNodeResult(
      {
        nodeId: 'a1',
        type: 'action_draft_email',
        ok: true,
        detail: 'Email sent to a@example.com via automation',
        artifacts: { sent: true, to: 'a@example.com' },
      },
      'L1',
    )
    expect(act?.kind).toBe('email_sent')
  })

  it('merges without duplicate ids', () => {
    const merged = mergeLeadActivities(
      [{ id: '1', kind: 'enrich', summary: 'A', createdAt: '2026-01-02T00:00:00Z' }],
      [{ id: '1', kind: 'enrich', summary: 'A', createdAt: '2026-01-02T00:00:00Z' }],
    )
    expect(merged).toHaveLength(1)
  })
})
