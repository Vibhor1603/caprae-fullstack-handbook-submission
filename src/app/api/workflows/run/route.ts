import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  executeWorkflow,
  graphHasSuccessfulAction,
  type ExecContext,
  type IntegrationConfig,
  type NodeResult,
  type WorkflowGraph,
} from '@/lib/workflow'
import type { ScoredLead } from '@/lib/scoring'

async function recordReportEvents(
  results: NodeResult[],
  lead: ScoredLead,
  workflowId: string,
) {
  const company = String(lead.lead.company || lead.id)

  for (const result of results) {
    if (!result.ok) {
      continue
    }

    if (result.type === 'action_weekly_report') {
      await prisma.reportEvent.create({
        data: {
          kind: 'a_tier',
          summary: String(result.artifacts?.reportLine || company),
          payload: JSON.stringify({ leadId: lead.id, workflowId }),
        },
      })
    }

    if (result.type === 'action_crm_push') {
      await prisma.reportEvent.create({
        data: {
          kind: 'crm_push',
          summary: `CRM push prepared for ${company}`,
          payload: JSON.stringify(result.artifacts || {}),
        },
      })

      if (result.artifacts?.sheets) {
        await prisma.reportEvent.create({
          data: {
            kind: 'sheets_append',
            summary: `Google Sheets row appended for ${company}`,
            payload: JSON.stringify(result.artifacts || {}),
          },
        })
      } else if (result.artifacts?.webhook) {
        await prisma.reportEvent.create({
          data: {
            kind: 'webhook',
            summary: `CRM webhook fired for ${company}`,
            payload: JSON.stringify(result.artifacts || {}),
          },
        })
      }
    }

    if (result.type === 'action_draft_email') {
      const to = result.artifacts?.to ? String(result.artifacts.to) : 'unknown'
      await prisma.reportEvent.create({
        data: {
          kind: 'email_draft',
          summary: `Draft prepared for ${to} · ${company} (not sent)`,
          payload: JSON.stringify({
            to: result.artifacts?.to,
            from: result.artifacts?.from,
            subject: result.artifacts?.subject,
            sent: false,
          }),
        },
      })
    }

    if (result.type === 'action_http') {
      await prisma.reportEvent.create({
        data: {
          kind: 'webhook',
          summary: `HTTP/Webhook ${result.ok ? 'ok' : 'fail'} for ${company}`,
          payload: JSON.stringify(result.artifacts || {}),
        },
      })
    }
  }
}

/** POST { workflowId?, trigger, lead, prevTier?, fieldConfidence?, integrations? } */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const lead = body.lead as ScoredLead
    if (!lead?.id) {
      return NextResponse.json({ error: 'lead required' }, { status: 400 })
    }

    const trigger = String(body.trigger || 'new_lead')
    const integrations = (body.integrations || {}) as IntegrationConfig
    const workflows = body.workflowId
      ? await prisma.workflow.findMany({ where: { id: String(body.workflowId), enabled: true } })
      : await prisma.workflow.findMany({ where: { enabled: true } })

    if (!workflows.length) {
      return NextResponse.json({ error: 'No enabled workflows' }, { status: 400 })
    }

    const runs = []

    for (const workflow of workflows) {
      const graph = JSON.parse(workflow.graph) as WorkflowGraph
      const pending = await prisma.workflowRun.create({
        data: {
          workflowId: workflow.id,
          status: 'pending',
          trigger,
          leadId: lead.id,
          leadLabel: String(lead.lead.company || lead.id),
          nodeResults: '[]',
        },
      })

      try {
        const ctx: ExecContext = {
          lead,
          trigger,
          prevTier: body.prevTier,
          fieldConfidence: body.fieldConfidence,
          integrations,
          allowNetwork: true,
        }
        const nodeResults = await executeWorkflow(graph, ctx)
        const hardFail = nodeResults.some(result => result.type.startsWith('action_') && !result.ok)
        const finished = await prisma.workflowRun.update({
          where: { id: pending.id },
          data: {
            status: hardFail ? 'failed' : 'done',
            nodeResults: JSON.stringify(nodeResults),
            finishedAt: new Date(),
          },
        })

        await recordReportEvents(nodeResults, lead, workflow.id)

        await prisma.reportEvent.create({
          data: {
            kind: 'workflow_run',
            summary: `${workflow.name}: ${finished.status} on ${lead.lead.company}`,
            payload: JSON.stringify({ runId: finished.id, trigger }),
          },
        })

        runs.push({
          ...finished,
          nodeResults,
          workflowName: workflow.name,
          hadAction: graphHasSuccessfulAction(nodeResults),
        })
      } catch (error) {
        const failed = await prisma.workflowRun.update({
          where: { id: pending.id },
          data: {
            status: 'failed',
            error: error instanceof Error ? error.message : 'run failed',
            finishedAt: new Date(),
          },
        })
        runs.push({ ...failed, nodeResults: [], workflowName: workflow.name })
      }
    }

    return NextResponse.json({ runs })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Run failed' },
      { status: 500 },
    )
  }
}
