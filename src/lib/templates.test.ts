import { describe, expect, it } from 'vitest'
import { DEAL_TEMPLATES } from './templates'
import { executeWorkflow } from './workflow'
import type { ScoredLead } from './scoring'

const aTier: ScoredLead = {
  id: 'L1',
  lead: {
    company: 'Northwind HVAC LLC',
    industry: 'HVAC Services',
    state: 'OH',
    country: 'US',
    ownerName: 'Dana Reyes',
    title: 'Owner',
    email: 'dana@northwindhvac.example',
    website: 'https://northwindhvac.example',
    employees: 35,
    revenue: '$6M',
    yearFounded: 1995,
  },
  score: 92,
  tier: 'A',
  reasons: [],
  junk: false,
  junkReasons: [],
  whyNow: 'Succession',
  tags: [],
  stage: 'new',
  stageChangedAt: new Date().toISOString(),
}

describe('deal templates', () => {
  it('ships three templates', () => {
    expect(DEAL_TEMPLATES.map(t => t.key)).toEqual([
      'a_tier_intro',
      'no_reply_followup',
      'weekly_digest',
    ])
  })

  it('executes A-tier intro on demo lead', async () => {
    const tpl = DEAL_TEMPLATES.find(t => t.key === 'a_tier_intro')!
    const results = await executeWorkflow(tpl.graph, {
      lead: { ...aTier },
      trigger: 'new_lead',
      allowNetwork: false,
    })
    expect(results.some(r => r.type === 'trigger' && r.ok)).toBe(true)
    expect(results.some(r => r.type === 'action_enrich' && r.ok)).toBe(true)
    expect(results.some(r => r.type === 'action_draft_email' && r.ok)).toBe(true)
    expect(results.some(r => r.type === 'action_move_stage' && r.ok)).toBe(true)
  })

  it('executes no-reply when contacted 5+ days', async () => {
    const tpl = DEAL_TEMPLATES.find(t => t.key === 'no_reply_followup')!
    const lead: ScoredLead = {
      ...aTier,
      stage: 'contacted',
      stageChangedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    }
    const results = await executeWorkflow(tpl.graph, {
      lead,
      trigger: 'schedule',
      allowNetwork: false,
      now: new Date(),
    })
    expect(results.some(r => r.type === 'action_draft_email' && r.ok)).toBe(true)
    expect(results.some(r => r.type === 'action_notify' && r.ok)).toBe(true)
  })

  it('executes weekly digest on schedule', async () => {
    const tpl = DEAL_TEMPLATES.find(t => t.key === 'weekly_digest')!
    const results = await executeWorkflow(tpl.graph, {
      lead: aTier,
      trigger: 'schedule',
      allowNetwork: false,
    })
    expect(results.some(r => r.type === 'action_weekly_report' && r.ok)).toBe(true)
    expect(results.some(r => r.type === 'action_notify' && r.ok)).toBe(true)
  })
})
