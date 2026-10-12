import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'

vi.mock('@/lib/db', () => ({
  prisma: {
    importRun: {
      create: vi.fn(async ({ data }: { data: { fileName: string; total: number; clean: number } }) => ({
        id: 'run_test',
        ...data,
      })),
    },
  },
}))

import { POST } from './route'
import { prisma } from '@/lib/db'

describe('POST /api/score', () => {
  beforeEach(() => {
    vi.mocked(prisma.importRun.create).mockClear()
  })

  it('triages sample CSV and persists a run', async () => {
    const csv = readFileSync('data/sample_leads.csv', 'utf8')
    const req = new Request('http://localhost/api/score?name=sample_leads.csv', {
      method: 'POST',
      body: csv,
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.runId).toBe('run_test')
    expect(body.total).toBe(9)
    expect(body.clean).toBe(6)
    expect(body.junk).toBeGreaterThanOrEqual(2)
    expect(body.duplicates).toBeGreaterThanOrEqual(1)
    expect(body.leads).toHaveLength(9)
    expect(prisma.importRun.create).toHaveBeenCalledOnce()
  })

  it('rejects empty body', async () => {
    const res = await POST(new Request('http://localhost/api/score', { method: 'POST', body: '  ' }))
    expect(res.status).toBe(400)
  })

  it('rejects bad ICP header', async () => {
    const res = await POST(
      new Request('http://localhost/api/score', {
        method: 'POST',
        body: 'company\nAcme',
        headers: { 'x-icp-json': '{nope' },
      }),
    )
    expect(res.status).toBe(400)
  })
})
