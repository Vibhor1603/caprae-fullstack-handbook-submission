import { describe, expect, it } from 'vitest'
import { buildFunnelReport, buildReportActions, countReachedStage } from './funnel'
import type { ScoredLead } from './scoring'

function lead(partial: Partial<ScoredLead> & { id: string; stage?: string }): ScoredLead {
  return {
    lead: { company: partial.id },
    score: 70,
    tier: 'A',
    reasons: [],
    junk: false,
    junkReasons: [],
    whyNow: '',
    tags: [],
    ...partial,
  } as ScoredLead
}

describe('funnel math', () => {
  const leads = [
    lead({ id: '1', stage: 'new', tier: 'A' }),
    lead({ id: '2', stage: 'enriched', tier: 'A' }),
    lead({ id: '3', stage: 'contacted', tier: 'B' }),
    lead({ id: '4', stage: 'replied', tier: 'A' }),
    lead({ id: '5', stage: 'loi', tier: 'A' }),
    lead({ id: '6', stage: 'closed', tier: 'A' }),
    lead({ id: '7', junk: true, stage: 'new', tier: 'C' }),
  ]

  it('counts reached stages cumulatively', () => {
    expect(countReachedStage(leads, 'new')).toBe(6)
    expect(countReachedStage(leads, 'contacted')).toBe(4)
    expect(countReachedStage(leads, 'loi')).toBe(2)
  })

  it('builds report with conversion and credits', () => {
    const report = buildFunnelReport(leads)
    expect(report.steps[0].label).toBe('New')
    expect(report.steps[0].count).toBe(6)
    expect(report.steps[2].conversionFromPrev).not.toBeNull()
    expect(report.creditsSaved.total).toBe(6)
    expect(report.byTier.some(t => t.key === 'A')).toBe(true)
    expect(report.cleanTotal).toBe(6)
    expect(report.tierA).toBe(5)
    expect(report.inMotion).toBeGreaterThanOrEqual(4)
    expect(report.buying).toBeDefined()
  })

  it('lists plain-english next actions', () => {
    const actions = buildReportActions(leads)
    expect(actions.length).toBeGreaterThan(0)
    expect(actions.some(a => a.title.toLowerCase().includes('a-tier'))).toBe(true)
  })
})
