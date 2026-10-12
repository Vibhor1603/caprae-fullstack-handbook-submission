import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import Papa from 'papaparse'
import {
  parseNumber, normalizeDomain, normalizePhone, junkReasons, scoreLead, triage, toCrmRows,
  rescore, summarize, capReasons, isFreeMail, DEFAULT_ICP, type RawLead,
} from './scoring'

const NOW = new Date('2026-10-11')

describe('parsers', () => {
  it('parses numbers, ranges and suffixes', () => {
    expect(parseNumber('$2.5M')).toBe(2_500_000)
    expect(parseNumber('11-50')).toBe(30.5)
    expect(parseNumber('1,200')).toBe(1200)
    expect(parseNumber('500k')).toBe(500_000)
    expect(parseNumber('n/a')).toBeNull()
  })
  it('normalizes domains and phones', () => {
    expect(normalizeDomain('https://www.Acme.com/about')).toBe('acme.com')
    expect(normalizeDomain('', 'jo@acme.com')).toBe('acme.com')
    expect(normalizeDomain('', 'jo@gmail.com')).toBeNull()
    expect(normalizePhone('+1 (312) 555-0100')).toBe('3125550100')
    expect(normalizePhone('555')).toBeNull()
  })
})

describe('junk', () => {
  it('flags uncontactable and malformed', () => {
    expect(junkReasons({ company: 'X' })).toContain('No way to contact (no email, phone, or LinkedIn)')
    expect(junkReasons({ company: 'X', email: 'bad@' })).toContain('Malformed email')
    expect(junkReasons({ email: 'a@b.com' })).toContain('Missing company name')
    expect(junkReasons({ company: 'X', email: 'jo@x.com' })).toEqual([])
  })
})

describe('scoring', () => {
  const ideal: RawLead = { company: 'Acme HVAC', industry: 'HVAC Services', country: 'US', employees: '25',
    revenue: '$5M', yearFounded: 1998, title: 'Owner', email: 'jo@acmehvac.com', phone: '3125550100', linkedin: 'x' }
  it('scores an ideal lead high with explanations and why-now', () => {
    const r = scoreLead(ideal, undefined, NOW)
    expect(r.score).toBe(100)
    expect(r.reasons.length).toBeGreaterThan(5)
    expect(r.reasons.length).toBeLessThanOrEqual(6)
    expect(r.whyNow.toLowerCase()).toMatch(/succession|established|prioritize/)
  })
  it('penalizes out-of-range firmographics', () => {
    expect(scoreLead({ ...ideal, employees: 5000, revenue: '$2B' }, undefined, NOW).score).toBeLessThan(80)
  })
  it('penalizes free-mail contacts and does not award work-email bonus', () => {
    expect(isFreeMail('pat@gmail.com')).toBe(true)
    const work = scoreLead(ideal, undefined, NOW)
    const free = scoreLead({ ...ideal, email: 'pat@gmail.com' }, undefined, NOW)
    expect(free.score).toBeLessThan(work.score)
    expect(free.reasons.some(r => r.includes('Free-mail'))).toBe(true)
    expect(free.reasons.some(r => r.includes('Direct work email'))).toBe(false)
    // lose +5 work-email bonus + free-mail penalty; both may still clamp near top
    expect(free.score).toBeLessThanOrEqual(work.score)
    expect(work.score - free.score).toBeGreaterThanOrEqual(5)
  })
  it('caps reasons to strongest contributions', () => {
    const many = Array.from({ length: 10 }, (_, i) => `+${10 - i} reason ${i}`)
    expect(capReasons(many, 3)).toEqual(['+10 reason 0', '+9 reason 1', '+8 reason 2'])
  })
})

describe('triage on labeled sample data', () => {
  const rows = Papa.parse<RawLead>(readFileSync('data/sample_leads.csv', 'utf8'), { header: true, skipEmptyLines: true }).data
  const out = triage(rows, undefined, NOW)
  it('detects duplicates and junk, ranks clean leads first', () => {
    expect(out.filter(o => o.duplicateOf).length).toBeGreaterThanOrEqual(1)
    expect(out.filter(o => o.junk).length).toBeGreaterThanOrEqual(2)
    const firstBad = out.findIndex(o => o.junk || o.duplicateOf)
    expect(out.slice(firstBad).every(o => o.junk || o.duplicateOf)).toBe(true)
    expect(out[0].tier).toBe('A')
  })
  it('exports only clean rows; A-tier filter works', () => {
    expect(toCrmRows(out).length).toBe(out.filter(o => !o.junk && !o.duplicateOf).length)
    expect(toCrmRows(out, { tier: 'A' }).every(r => r['Lead tier'] === 'A')).toBe(true)
  })
  it('keeps free-mail Green Acre below work-email peers', () => {
    const green = out.find(o => o.lead.company?.includes('Green Acre'))
    expect(green).toBeTruthy()
    expect(green!.score).toBeLessThan(95)
    expect(green!.reasons.some(r => r.includes('Free-mail'))).toBe(true)
  })
  it('summarize counts match filters', () => {
    const s = summarize(out)
    expect(s.total).toBe(out.length)
    expect(s.clean + s.junk).toBeGreaterThanOrEqual(out.length - s.duplicates) // junk may overlap? junk and dupe are separate flags
    expect(s.tierA + s.tierB + s.tierC).toBe(s.clean)
  })
  it('rescore updates tiers when ICP narrows', () => {
    const tight = { ...DEFAULT_ICP, industries: ['hvac'] }
    const again = rescore(out, tight, NOW)
    const green = again.find(o => o.lead.company?.includes('Green Acre'))
    expect(green!.score).toBeLessThan(out.find(o => o.lead.company?.includes('Green Acre'))!.score)
  })
})
