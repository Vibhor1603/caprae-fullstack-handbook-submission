import { describe, expect, it } from 'vitest'
import { EXPORT_PRESETS, mapLeadsToPreset, previewMapping } from './exportPresets'
import type { ScoredLead } from './scoring'

const sample: ScoredLead = {
  id: 'L1',
  lead: {
    company: 'Acme HVAC',
    ownerName: 'Pat',
    title: 'Owner',
    email: 'pat@acme.example',
    industry: 'HVAC',
    state: 'OH',
  },
  score: 88,
  tier: 'A',
  reasons: ['+22 Industry match'],
  junk: false,
  junkReasons: [],
  whyNow: 'Succession window',
  tags: ['demo'],
  stage: 'contacted',
}

describe('export presets', () => {
  it('defines five presets with distinct headers', () => {
    expect(EXPORT_PRESETS).toHaveLength(5)
    expect(new Set(EXPORT_PRESETS.map(p => p.id)).size).toBe(5)
  })

  it('maps hubspot columns', () => {
    const rows = mapLeadsToPreset([sample], 'hubspot')
    expect(rows).toHaveLength(1)
    expect(rows[0]['Company name']).toBe('Acme HVAC')
    expect(rows[0]['Deal stage']).toBe('Contacted')
    expect(rows[0]['Why now']).toBe('Succession window')
  })

  it('previews mapping', () => {
    const preview = previewMapping([sample], 'salesforce', 1)
    expect(preview.headers).toContain('Company')
    expect(preview.rows[0].Company).toBe('Acme HVAC')
  })
})
