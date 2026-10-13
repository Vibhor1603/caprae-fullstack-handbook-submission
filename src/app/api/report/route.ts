import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/** GET /api/report?from=&to= — funnel-oriented pulse + legacy event counts */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const fromParam = url.searchParams.get('from')
  const toParam = url.searchParams.get('to')
  const since = fromParam ? new Date(fromParam) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const until = toParam ? new Date(new Date(toParam).getTime() + 86400000) : new Date()

  const events = await prisma.reportEvent.findMany({
    where: { createdAt: { gte: since, lte: until } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  const summary = {
    aTierMentions: 0,
    workflowRuns: 0,
    crmPushes: 0,
    enrichments: 0,
    emailDrafts: 0,
    sheetsAppends: 0,
    webhooks: 0,
    notifies: 0,
    stageChanges: 0,
  }

  const moves = new Map<string, { workflowKey: string; name: string; leadsMoved: number }>()

  for (const event of events) {
    if (event.kind === 'a_tier') {
      summary.aTierMentions++
    }
    if (event.kind === 'workflow_run') {
      summary.workflowRuns++
    }
    if (event.kind === 'crm_push') {
      summary.crmPushes++
    }
    if (event.kind === 'enrich') {
      summary.enrichments++
    }
    if (event.kind === 'email_draft') {
      summary.emailDrafts++
    }
    if (event.kind === 'sheets_append') {
      summary.sheetsAppends++
    }
    if (event.kind === 'webhook') {
      summary.webhooks++
    }
    if (event.kind === 'notify') {
      summary.notifies++
    }
    if (event.kind === 'stage_change') {
      summary.stageChanges++
      try {
        const payload = JSON.parse(event.payload || '{}') as {
          workflowId?: string
          workflowName?: string
        }
        const key = payload.workflowId || 'manual'
        const name = payload.workflowName || (key === 'manual' ? 'Manual' : key)
        const cur = moves.get(key) || { workflowKey: key, name, leadsMoved: 0 }
        cur.leadsMoved++
        moves.set(key, cur)
      } catch {
        // ignore
      }
    }
  }

  return NextResponse.json({
    since: since.toISOString(),
    until: until.toISOString(),
    summary,
    workflowImpact: [...moves.values()].sort((a, b) => b.leadsMoved - a.leadsMoved),
    events: events.map(e => ({
      ...e,
      payload: (() => {
        try {
          return JSON.parse(e.payload || '{}')
        } catch {
          return {}
        }
      })(),
    })),
  })
}
