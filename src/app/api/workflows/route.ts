import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  EMPTY_GRAPH,
  sanitizeGraph,
  validateCanvasGraph,
  type WorkflowGraph,
} from '@/lib/workflow'
import { DEAL_TEMPLATES } from '@/lib/templates'

function parseWorkflowGraph(graphJson: string) {
  return JSON.parse(graphJson) as WorkflowGraph
}

function prepareGraph(raw: unknown): { ok: true; graph: WorkflowGraph } | { ok: false; error: string } {
  const graph = sanitizeGraph((raw || EMPTY_GRAPH) as WorkflowGraph)
  const check = validateCanvasGraph(graph)
  if (!check.ok) {
    return { ok: false, error: check.reason }
  }
  return { ok: true, graph }
}

async function ensureTemplates() {
  try {
    for (const tpl of DEAL_TEMPLATES) {
      const existing = await prisma.workflow.findFirst({
        where: { templateKey: tpl.key },
      })
      if (!existing) {
        await prisma.workflow.create({
          data: {
            name: tpl.name,
            enabled: true,
            graph: JSON.stringify(tpl.graph),
            templateKey: tpl.key,
            isTemplate: true,
          },
        })
      }
    }
  } catch {
    // Schema may lack templateKey until migration — seed DEFAULT path only.
    const count = await prisma.workflow.count()
    if (count === 0) {
      const first = DEAL_TEMPLATES[0]
      await prisma.workflow.create({
        data: {
          name: first.name,
          enabled: true,
          graph: JSON.stringify(first.graph),
        },
      })
    }
  }
}

export async function GET() {
  await ensureTemplates()
  let items = await prisma.workflow.findMany({ orderBy: { updatedAt: 'desc' } })

  if (!items.length) {
    const first = DEAL_TEMPLATES[0]
    const seeded = await prisma.workflow.create({
      data: {
        name: first.name,
        enabled: true,
        graph: JSON.stringify(first.graph),
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
  const name = String(body.name || 'Untitled automation').trim() || 'Untitled automation'
  const prepared = prepareGraph(body.graph ?? EMPTY_GRAPH)
  if (!prepared.ok) {
    return NextResponse.json({ error: prepared.error }, { status: 400 })
  }

  const enabled = body.enabled !== false
  const templateKey = body.templateKey ? String(body.templateKey) : null
  const isTemplate = !!body.isTemplate || !!templateKey

  try {
    if (templateKey) {
      const existing = await prisma.workflow.findFirst({ where: { templateKey } })
      if (existing) {
        const workflow = await prisma.workflow.update({
          where: { id: existing.id },
          data: {
            name,
            enabled,
            graph: JSON.stringify(prepared.graph),
            isTemplate: true,
          },
        })
        return NextResponse.json({ workflow: { ...workflow, graph: prepared.graph } })
      }
    }

    const workflow = await prisma.workflow.create({
      data: {
        name,
        enabled,
        graph: JSON.stringify(prepared.graph),
        ...(templateKey
          ? { templateKey, isTemplate }
          : isTemplate
            ? { isTemplate: true }
            : {}),
      },
    })
    return NextResponse.json({ workflow: { ...workflow, graph: prepared.graph } })
  } catch {
    const workflow = await prisma.workflow.create({
      data: { name, enabled, graph: JSON.stringify(prepared.graph) },
    })
    return NextResponse.json({ workflow: { ...workflow, graph: prepared.graph } })
  }
}

export async function PUT(req: Request) {
  const body = await req.json()
  const id = String(body.id || '')
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const data: { name?: string; enabled?: boolean; graph?: string } = {}
  if (body.name != null) {
    data.name = String(body.name).trim() || 'Untitled automation'
  }
  if (body.enabled != null) {
    data.enabled = !!body.enabled
  }
  if (body.graph != null) {
    const prepared = prepareGraph(body.graph)
    if (!prepared.ok) {
      return NextResponse.json({ error: prepared.error }, { status: 400 })
    }
    data.graph = JSON.stringify(prepared.graph)
  }

  const workflow = await prisma.workflow.update({ where: { id }, data })
  return NextResponse.json({
    workflow: { ...workflow, graph: parseWorkflowGraph(workflow.graph) },
  })
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}))
  const id = String(body.id || new URL(req.url).searchParams.get('id') || '')
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const remaining = await prisma.workflow.count()
  if (remaining <= 1) {
    return NextResponse.json(
      { error: 'Keep at least one automation canvas' },
      { status: 400 },
    )
  }

  await prisma.workflow.delete({ where: { id } })
  return NextResponse.json({ ok: true, id })
}
