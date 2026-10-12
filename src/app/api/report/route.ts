import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const events = await prisma.reportEvent.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  const aTier = events.filter(e => e.kind === 'a_tier')
  const runs = events.filter(e => e.kind === 'workflow_run')
  const crm = events.filter(e => e.kind === 'crm_push')
  const enrich = events.filter(e => e.kind === 'enrich')
  const emailDrafts = events.filter(e => e.kind === 'email_draft')
  const sheets = events.filter(e => e.kind === 'sheets_append')
  const webhooks = events.filter(e => e.kind === 'webhook')
  return NextResponse.json({
    since: since.toISOString(),
    summary: {
      aTierMentions: aTier.length,
      workflowRuns: runs.length,
      crmPushes: crm.length,
      enrichments: enrich.length,
      emailDrafts: emailDrafts.length,
      sheetsAppends: sheets.length,
      webhooks: webhooks.length,
    },
    events: events.map(e => ({
      ...e,
      payload: JSON.parse(e.payload || '{}'),
    })),
  })
}
