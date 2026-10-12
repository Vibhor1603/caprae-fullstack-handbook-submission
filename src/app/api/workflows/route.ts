import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { DEFAULT_GRAPH } from '@/lib/workflow'

function parseWorkflowGraph(graphJson: string) {
  return JSON.parse(graphJson)
}

export async function GET() {
  let items = await prisma.workflow.findMany({ orderBy: { updatedAt: 'desc' } })

  if (!items.length) {
    const seeded = await prisma.workflow.create({
      data: {
        name: 'A-tier deal path',
        enabled: true,
        graph: JSON.stringify(DEFAULT_GRAPH),
      },
    })
    items = [seeded]
  }

  return NextResponse.json({
    workflows: items.map(workflow => ({
      ...workflow,
      graph: parseWorkflowGraph(workflow.graph),
    })),
  })
}

export async function POST(req: Request) {
  const body = await req.json()
  const name = String(body.name || 'Untitled workflow')
  const graph = body.graph || DEFAULT_GRAPH
  const enabled = body.enabled !== false

  const workflow = await prisma.workflow.create({
    data: { name, enabled, graph: JSON.stringify(graph) },
  })

  return NextResponse.json({ workflow: { ...workflow, graph } })
}

export async function PUT(req: Request) {
  const body = await req.json()
  const id = String(body.id || '')
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const data: { name?: string; enabled?: boolean; graph?: string } = {}
  if (body.name != null) {
    data.name = String(body.name)
  }
  if (body.enabled != null) {
    data.enabled = !!body.enabled
  }
  if (body.graph != null) {
    data.graph = JSON.stringify(body.graph)
  }

  const workflow = await prisma.workflow.update({ where: { id }, data })
  return NextResponse.json({
    workflow: { ...workflow, graph: parseWorkflowGraph(workflow.graph) },
  })
}
