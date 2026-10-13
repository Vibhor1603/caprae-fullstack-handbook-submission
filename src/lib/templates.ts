/**
 * Three prebuilt deal-sourcing workflow templates.
 */
import {
  defaultDataFor,
  sanitizeGraph,
  type WorkflowGraph,
} from '@/lib/workflow'

export type TemplateKey = 'a_tier_intro' | 'no_reply_followup' | 'weekly_digest'

export type DealTemplate = {
  key: TemplateKey
  name: string
  description: string
  graph: WorkflowGraph
}

function graph(nodes: WorkflowGraph['nodes'], edges: WorkflowGraph['edges']): WorkflowGraph {
  return sanitizeGraph({ nodes, edges })
}

export const DEAL_TEMPLATES: DealTemplate[] = [
  {
    key: 'a_tier_intro',
    name: 'A-tier owner intro',
    description: 'New/A-tier → enrich → confidence check → intro draft → Contacted → CRM',
    graph: graph(
      [
        {
          id: 't1',
          type: 'trigger',
          position: { x: 40, y: 160 },
          data: { ...defaultDataFor('trigger'), event: 'new_lead', label: 'New lead or A-tier' },
        },
        {
          id: 'c1',
          type: 'condition',
          position: { x: 280, y: 160 },
          data: { ...defaultDataFor('condition'), field: 'tier', op: 'eq', value: 'A', label: 'If tier is A' },
        },
        {
          id: 'a_en',
          type: 'action_enrich',
          position: { x: 520, y: 160 },
          data: { ...defaultDataFor('action_enrich'), label: 'Enrich from website' },
        },
        {
          id: 'c2',
          type: 'condition',
          position: { x: 760, y: 160 },
          data: {
            ...defaultDataFor('condition'),
            field: 'confidence',
            op: 'gte',
            value: 0.55,
            label: 'Owner confidence ≥ 0.55',
          },
        },
        {
          id: 'a_mail',
          type: 'action_draft_email',
          position: { x: 1000, y: 60 },
          data: {
            ...defaultDataFor('action_draft_email'),
            label: 'Draft owner intro',
            subject: 'Intro — {{company}}',
            template:
              'Hi {{owner}}, I partner with operators in {{industry}}. {{company}} stood out — would you be open to a brief conversation about the business?',
          },
        },
        {
          id: 'a_stage',
          type: 'action_move_stage',
          position: { x: 1000, y: 180 },
          data: { ...defaultDataFor('action_move_stage'), stage: 'contacted', label: 'Move to Contacted' },
        },
        {
          id: 'a_crm',
          type: 'action_crm_push',
          position: { x: 1000, y: 300 },
          data: { ...defaultDataFor('action_crm_push'), label: 'Push to CRM' },
        },
      ],
      [
        { id: 'e1', source: 't1', target: 'c1' },
        { id: 'e2', source: 'c1', target: 'a_en' },
        { id: 'e3', source: 'a_en', target: 'c2' },
        { id: 'e4', source: 'c2', target: 'a_mail' },
        { id: 'e5', source: 'c2', target: 'a_stage' },
        { id: 'e6', source: 'c2', target: 'a_crm' },
      ],
    ),
  },
  {
    key: 'no_reply_followup',
    name: 'No reply follow-up',
    description: 'Schedule → Contacted ≥5 days → follow-up draft + notify',
    graph: graph(
      [
        {
          id: 't1',
          type: 'trigger',
          position: { x: 40, y: 140 },
          data: { ...defaultDataFor('trigger'), event: 'schedule', label: 'On schedule' },
        },
        {
          id: 'c1',
          type: 'condition',
          position: { x: 280, y: 80 },
          data: {
            ...defaultDataFor('condition'),
            field: 'stage',
            op: 'eq',
            value: 'contacted',
            label: 'If Contacted',
          },
        },
        {
          id: 'c2',
          type: 'condition',
          position: { x: 520, y: 140 },
          data: {
            ...defaultDataFor('condition'),
            field: 'days_in_stage',
            op: 'gte',
            value: 5,
            label: 'Days in stage ≥ 5',
          },
        },
        {
          id: 'a_mail',
          type: 'action_draft_email',
          position: { x: 760, y: 80 },
          data: {
            ...defaultDataFor('action_draft_email'),
            label: 'Draft follow-up',
            subject: 'Following up — {{company}}',
            template:
              'Hi {{owner}}, circling back on my note about {{company}}. Happy to share how we approach transitions in {{industry}} if useful.',
          },
        },
        {
          id: 'a_n',
          type: 'action_notify',
          position: { x: 760, y: 220 },
          data: {
            ...defaultDataFor('action_notify'),
            label: 'Notify searcher',
            message: 'Follow-up draft ready for {{company}}',
          },
        },
      ],
      [
        { id: 'e1', source: 't1', target: 'c1' },
        { id: 'e2', source: 'c1', target: 'c2' },
        { id: 'e3', source: 'c2', target: 'a_mail' },
        { id: 'e4', source: 'c2', target: 'a_n' },
      ],
    ),
  },
  {
    key: 'weekly_digest',
    name: 'Weekly pipeline digest',
    description: 'Schedule → compile funnel report line → notify',
    graph: graph(
      [
        {
          id: 't1',
          type: 'trigger',
          position: { x: 40, y: 120 },
          data: { ...defaultDataFor('trigger'), event: 'schedule', label: 'Weekly schedule' },
        },
        {
          id: 'a_r',
          type: 'action_weekly_report',
          position: { x: 300, y: 120 },
          data: { ...defaultDataFor('action_weekly_report'), label: 'Compile funnel digest' },
        },
        {
          id: 'a_n',
          type: 'action_notify',
          position: { x: 560, y: 120 },
          data: {
            ...defaultDataFor('action_notify'),
            label: 'Notify digest ready',
            message: 'Weekly pipeline digest ready',
          },
        },
      ],
      [
        { id: 'e1', source: 't1', target: 'a_r' },
        { id: 'e2', source: 'a_r', target: 'a_n' },
      ],
    ),
  },
]

export function templateByKey(key: string): DealTemplate | undefined {
  return DEAL_TEMPLATES.find(t => t.key === key)
}
