import { describe, expect, it } from 'vitest'
import { buyingGuideBits } from './leadDisplay'

describe('buyingGuideBits', () => {
  it('surfaces ETA acquisition signals for collapsed rows', () => {
    const bits = buyingGuideBits(
      {
        company: 'Northwind HVAC',
        city: 'Columbus',
        state: 'OH',
        employees: 35,
        revenue: '$6M',
        yearFounded: 1995,
        ownerName: 'Dana Reyes',
        title: 'Owner',
      },
      '31-yr HVAC with long-tenured owner — succession window.',
      new Date('2026-10-13'),
    )

    expect(bits.map(b => b.key)).toEqual(['geo', 'headcount', 'revenue', 'tenure', 'owner'])
    expect(bits.find(b => b.key === 'tenure')?.label).toBe('31y business')
    expect(bits.find(b => b.key === 'geo')?.label).toBe('Columbus, OH')
  })

  it('falls back to why-now when size fields are thin', () => {
    const bits = buyingGuideBits(
      { company: 'Thin Co', city: 'Austin', state: 'TX' },
      'Owner-operated niche services shop.',
    )
    expect(bits.some(b => b.key === 'why')).toBe(true)
  })
})
