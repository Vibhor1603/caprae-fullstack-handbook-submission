import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const runs = await prisma.workflowRun.findMany({
    where: status && status !== 'all' ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { workflow: { select: { name: true } } },
  })
  return NextResponse.json({
    runs: runs.map(r => ({
      ...r,
      workflowName: r.workflow.name,
      nodeResults: JSON.parse(r.nodeResults || '[]'),
    })),
  })
}

export async function POST(req: Request) {
  const body = await req.json()
  if (body.action === 'retry' && body.id) {
    const run = await prisma.workflowRun.findUnique({ where: { id: String(body.id) } })
    if (!run) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    const updated = await prisma.workflowRun.update({
      where: { id: run.id },
      data: { status: 'pending', error: null, finishedAt: null },
    })
    // Mark pending — client should re-POST /api/workflows/run with lead context.
    return NextResponse.json({ run: updated, needsRerun: true })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
