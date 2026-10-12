import { NextResponse } from 'next/server'
import Papa from 'papaparse'
import { DEFAULT_ICP, summarize, triage, type Icp, type RawLead } from '@/lib/scoring'
import { prisma } from '@/lib/db'

/**
 * POST raw CSV text (body) ?name=file.csv
 * Optional header `x-icp-json`: JSON Icp override (else DEFAULT_ICP).
 * Returns triaged leads and persists an ImportRun + Lead rows.
 */
export async function POST(req: Request) {
  const csv = await req.text()
  if (!csv.trim()) {
    return NextResponse.json({ error: 'Empty CSV' }, { status: 400 })
  }

  let icp: Icp = DEFAULT_ICP
  const icpHeader = req.headers.get('x-icp-json')
  if (icpHeader) {
    try {
      icp = { ...DEFAULT_ICP, ...JSON.parse(icpHeader) }
    } catch {
      return NextResponse.json({ error: 'Invalid x-icp-json header' }, { status: 400 })
    }
  }

  const { data, errors } = Papa.parse<RawLead>(csv, { header: true, skipEmptyLines: true })
  if (errors.length && !data.length) {
    return NextResponse.json({ error: errors[0].message }, { status: 400 })
  }

  const scored = triage(data, icp)
  const stats = summarize(scored)
  const name = new URL(req.url).searchParams.get('name') ?? 'upload.csv'

  const run = await prisma.importRun.create({
    data: {
      fileName: name,
      total: stats.total,
      clean: stats.clean,
      leads: {
        create: scored.map(s => ({
          company: s.lead.company ?? '',
          score: s.score,
          tier: s.tier,
          junk: s.junk,
          duplicateOf: s.duplicateOf ?? null,
          reasons: JSON.stringify([...s.reasons, ...s.junkReasons]),
          raw: JSON.stringify(s.lead),
          whyNow: s.whyNow,
          tags: JSON.stringify(s.tags || []),
        })),
      },
    },
  })

  return NextResponse.json({
    runId: run.id,
    ...stats,
    leads: scored,
  })
}
