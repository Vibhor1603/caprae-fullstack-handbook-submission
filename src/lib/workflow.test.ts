import { describe, it, expect } from 'vitest'
import {
  DEFAULT_GRAPH,
  defaultDataFor,
  executeWorkflow,
  graphHasSuccessfulAction,
  isNodeKind,
  isValidConnection,
  sanitizeGraph,
  type ExecContext,
  type NodeKind,
  type WorkflowGraph,
} from './workflow'
import { interpolate } from './interpolate'
import type { ScoredLead } from './scoring'

const lead: ScoredLead = {
  id: 'L1',
  lead: {
    company: 'Acme HVAC',
    industry: 'HVAC Services',
    city: 'Columbus',
    state: 'OH',
    country: 'US',
    ownerName: 'Pat Lee',
    email: 'pat@acmehvac.example',
  },
  score: 88,
  tier: 'A',
  reasons: [],
  junk: false,
  junkReasons: [],
  whyNow: 'Succession window',
  tags: ['hot'],
}

function ctx(partial: Partial<ExecContext> = {}): ExecContext {
  return { lead, trigger: 'new_lead', fieldConfidence: 0.9, allowNetwork: false, ...partial }
}

describe('isNodeKind / topology', () => {
  it('accepts palette kinds only', () => {
    expect(isNodeKind('trigger')).toBe(true)
    expect(isNodeKind('condition')).toBe(true)
    expect(isNodeKind('action_crm_push')).toBe(true)
    expect(isNodeKind('action_http')).toBe(true)
    expect(isNodeKind('trigger_new_lead')).toBe(false)
  })

  it('enforces connection rules', () => {
    expect(isValidConnection('trigger', 'condition')).toBe(true)
    expect(isValidConnection('condition', 'action_draft_email')).toBe(true)
    expect(isValidConnection('action_crm_push', 'trigger')).toBe(false)
  })
})

describe('interpolate', () => {
  it('fills lead tokens and aliases', () => {
    expect(interpolate('Hi {{owner}} at {{lead.company}} ({{tier}})', lead)).toBe(
      'Hi Pat Lee at Acme HVAC (A)',
    )
    expect(interpolate('{{email}} · {{score}}', lead)).toContain('pat@acmehvac.example')
  })
})

describe('sanitizeGraph', () => {
  it('migrates legacy kinds and drops noise', () => {
    const dirty: WorkflowGraph = {
      nodes: [
        // @ts-expect-error legacy
        { id: 't', type: 'trigger_new_lead', position: { x: NaN, y: 10 }, data: {} },
        // @ts-expect-error legacy
        { id: 'c', type: 'condition_tier', position: { x: 1, y: 2 }, data: { tier: 'A' } },
        // @ts-expect-error legacy
        { id: 'tag', type: 'action_tag', position: { x: 0, y: 0 }, data: { tag: 'x' } },
        // @ts-expect-error intentional bad kind
        { id: 'bad', type: 'not_a_kind', position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [
        { id: 'e1', source: 't', target: 'c' },
        { id: 'loop', source: 'c', target: 'c' },
        { id: 'badtopo', source: 'c', target: 't' },
      ],
    }
    const clean = sanitizeGraph(dirty)
    expect(clean.nodes.map(n => n.type)).toEqual(['trigger', 'condition'])
    expect(clean.edges).toHaveLength(1)
    expect(clean.nodes[0].data.event).toBe('new_lead')
    expect(clean.nodes[1].data.field).toBe('tier')
  })
})

describe('defaultDataFor', () => {
  const kinds: NodeKind[] = [
    'trigger',
    'condition',
    'action_draft_email',
    'action_crm_push',
    'action_http',
    'action_weekly_report',
  ]
  it('returns usable defaults', () => {
    for (const k of kinds) {expect(defaultDataFor(k).label).toBeTruthy()}
    expect(defaultDataFor('trigger').event).toBe('new_lead')
  })
})

describe('executeWorkflow', () => {
  it('runs default graph on new_lead', async () => {
    const results = await executeWorkflow(DEFAULT_GRAPH, ctx())
    expect(results.some(r => r.type === 'trigger' && r.ok)).toBe(true)
    expect(results.some(r => r.type === 'condition' && r.ok)).toBe(true)
    expect(results.some(r => r.type === 'action_draft_email' && r.ok)).toBe(true)
    expect(results.some(r => r.type === 'action_weekly_report' && r.ok)).toBe(true)
    expect(graphHasSuccessfulAction(results)).toBe(true)
  })

  it('drafts email with to address detail', async () => {
    const g: WorkflowGraph = {
      nodes: [
        { id: 't', type: 'trigger', position: { x: 0, y: 0 }, data: { event: 'new_lead' } },
        {
          id: 'a',
          type: 'action_draft_email',
          position: { x: 80, y: 0 },
          data: { template: 'Hi {{owner}}', fromEmail: 'me@firm.example' },
        },
      ],
      edges: [{ id: 'e', source: 't', target: 'a' }],
    }
    const r = (await executeWorkflow(g, ctx())).find(x => x.type === 'action_draft_email')
    expect(r?.ok).toBe(true)
    expect(r?.detail).toContain('pat@acmehvac.example')
    expect(r?.artifacts?.sent).toBe(false)
  })

  it('condition score gte works', async () => {
    const g: WorkflowGraph = {
      nodes: [
        { id: 't', type: 'trigger', position: { x: 0, y: 0 }, data: { event: 'new_lead' } },
        {
          id: 'c',
          type: 'condition',
          position: { x: 40, y: 0 },
          data: { field: 'score', op: 'gte', value: 80 },
        },
        {
          id: 'a',
          type: 'action_weekly_report',
          position: { x: 80, y: 0 },
          data: {},
        },
      ],
      edges: [
        { id: 'e1', source: 't', target: 'c' },
        { id: 'e2', source: 'c', target: 'a' },
      ],
    }
    const results = await executeWorkflow(g, ctx())
    expect(results.some(r => r.type === 'condition' && r.ok)).toBe(true)
    expect(results.some(r => r.type === 'action_weekly_report' && r.ok)).toBe(true)
  })

  it('crm push ready without webhook', async () => {
    const g: WorkflowGraph = {
      nodes: [
        { id: 't', type: 'trigger', position: { x: 0, y: 0 }, data: { event: 'new_lead' } },
        { id: 'a', type: 'action_crm_push', position: { x: 40, y: 0 }, data: { webhook: '' } },
      ],
      edges: [{ id: 'e', source: 't', target: 'a' }],
    }
    const r = (await executeWorkflow(g, ctx())).find(x => x.type === 'action_crm_push')
    expect(r?.ok).toBe(true)
    expect(r?.artifacts?.crmRow).toBeTruthy()
  })

  it('http branches to ok handle on dry-run success', async () => {
    const g: WorkflowGraph = {
      nodes: [
        { id: 't', type: 'trigger', position: { x: 0, y: 0 }, data: { event: 'new_lead' } },
        {
          id: 'h',
          type: 'action_http',
          position: { x: 40, y: 0 },
          data: { url: 'https://hooks.example.com/x', method: 'POST' },
        },
        { id: 'ok', type: 'action_weekly_report', position: { x: 80, y: 0 }, data: { label: 'on ok' } },
        { id: 'fail', type: 'action_weekly_report', position: { x: 80, y: 40 }, data: { label: 'on fail' } },
      ],
      edges: [
        { id: 'e0', source: 't', target: 'h' },
        { id: 'e1', source: 'h', target: 'ok', sourceHandle: 'ok' },
        { id: 'e2', source: 'h', target: 'fail', sourceHandle: 'fail' },
      ],
    }
    const results = await executeWorkflow(g, ctx({ allowNetwork: false }))
    expect(results.some(r => r.type === 'action_http' && r.ok)).toBe(true)
    expect(results.some(r => r.nodeId === 'ok' && r.ok)).toBe(true)
    expect(results.some(r => r.nodeId === 'fail')).toBe(false)
  })

  it('survives cycles', async () => {
    const cyclic: WorkflowGraph = {
      nodes: [
        { id: 't', type: 'trigger', position: { x: 0, y: 0 }, data: { event: 'new_lead' } },
        { id: 'a1', type: 'action_weekly_report', position: { x: 40, y: 0 }, data: {} },
        { id: 'a2', type: 'action_weekly_report', position: { x: 80, y: 0 }, data: {} },
      ],
      edges: [
        { id: 'e1', source: 't', target: 'a1' },
        { id: 'e2', source: 'a1', target: 'a2' },
        { id: 'e3', source: 'a2', target: 'a1' },
      ],
    }
    const results = await executeWorkflow(cyclic, ctx())
    expect(results.length).toBeLessThan(20)
  })
})
