import { describe, expect, it } from 'vitest'
import { buildDealSignals } from './dealSignals'

describe('buildDealSignals', () => {
  it('flags succession, multi-location, reputation, and owner reach', () => {
    const signals = buildDealSignals(
      {
        company: 'Northwind HVAC',
        title: 'Owner',
        ownerName: 'Dana Reyes',
        email: 'dana@northwindhvac.example',
        phone: '614-555-0101',
        yearFounded: 1995,
        locations: 3,
        googleRating: 4.7,
        reviewCount: 186,
        licenses: 'OH HVAC #44192',
        bonding: 'yes',
        bbb: 'yes',
        saleSignal: 'Owner exploring succession after 30 years',
      },
      { now: new Date('2026-10-13') },
    )

    expect(signals.succession.businessAgeOver15).toBe(true)
    expect(signals.succession.noVisibleSuccessor).toBe(true)
    expect(signals.multiLocation).toBe(true)
    expect(signals.locationsCount).toBe(3)
    expect(signals.googleRating).toBe(4.7)
    expect(signals.licensedOrBonded).toBe(true)
    expect(signals.bbbAccredited).toBe(true)
    expect(signals.saleOrRetirementLanguage).toBe(true)
    expect(signals.ownerReachability).toBe('direct')
    expect(signals.badges.length).toBeGreaterThan(0)
  })

  it('marks generic inbox and concentration risk', () => {
    const signals = buildDealSignals({
      email: 'info@shop.example',
      customerConcentration: 'Top client 40% of revenue',
    })
    expect(signals.ownerReachability).toBe('generic')
    expect(signals.concentrationRisk).toBe(true)
  })
})
