import { describe, it, expect } from 'vitest'
import { isFuzzyCompanyMatch, nameSimilarity, normalizeCompany } from './fuzzy'

describe('fuzzy company match', () => {
  it('normalizes legal suffixes', () => {
    expect(normalizeCompany('Northwind HVAC LLC')).toBe('northwind hvac')
    expect(normalizeCompany('Northwind HVAC')).toBe('northwind hvac')
  })
  it('matches near-identical names', () => {
    expect(isFuzzyCompanyMatch('Northwind HVAC LLC', 'Northwind HVAC')).toBe(true)
    expect(nameSimilarity('Acme Plumbing Co', 'Acme Plumbing')).toBeGreaterThan(0.85)
    expect(isFuzzyCompanyMatch('Acme Plumbing', 'Zeta Roofing')).toBe(false)
  })
})
