import { describe, expect, it } from 'vitest'
import { applyStageChange, daysInStage, assertStageTransition } from './pipeline'

describe('pipeline stages', () => {
  it('accepts known stages', () => {
    expect(assertStageTransition('new', 'contacted').ok).toBe(true)
    expect(assertStageTransition('new', 'nope').ok).toBe(false)
  })

  it('applies stage change with activity', () => {
    const r = applyStageChange('new', 'contacted', 'manual', new Date('2026-10-01'))
    expect('ok' in r && r.ok === false).toBe(false)
    if ('ok' in r && r.ok === false) {
      return
    }
    expect(r.stage).toBe('contacted')
    expect(r.previousStage).toBe('new')
    expect(r.activity.kind).toBe('stage_change')
  })

  it('computes days in stage', () => {
    const now = new Date('2026-10-10T12:00:00Z')
    expect(daysInStage('2026-10-05T12:00:00Z', now)).toBe(5)
    expect(daysInStage(null, now)).toBe(0)
  })
})
