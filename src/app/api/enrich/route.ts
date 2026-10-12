import { NextResponse } from 'next/server'
import { applyEnrichment, enrichFromWebsite } from '@/lib/enrichment'
import { prismaEnrichmentCache } from '@/lib/cacheStore'
import { DEFAULT_ICP, scoreLead, tierOf, type RawLead } from '@/lib/scoring'
import { prisma } from '@/lib/db'

/** POST { lead: RawLead } → enrichment snapshot + rescored fields */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const lead = body.lead as RawLead
    if (!lead || typeof lead !== 'object') {
      return NextResponse.json({ error: 'lead required' }, { status: 400 })
    }
    const snap = await enrichFromWebsite(lead, { cache: prismaEnrichmentCache })
    const merged = applyEnrichment(lead, snap)
    const { score, reasons, whyNow } = scoreLead(merged, DEFAULT_ICP)
    await prisma.reportEvent.create({
      data: {
        kind: 'enrich',
        summary: `Enriched ${lead.company || snap.domain || 'lead'} (${snap.source})`,
        payload: JSON.stringify({ domain: snap.domain, live: snap.live }),
      },
    })
    return NextResponse.json({
      enrichment: snap,
      lead: merged,
      score,
      tier: tierOf(score),
      reasons,
      whyNow,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Enrich failed' },
      { status: 500 },
    )
  }
}
