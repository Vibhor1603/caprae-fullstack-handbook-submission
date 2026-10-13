/**
 * Visual metadata for workflow node kinds (palette + canvas nodes).
 */
import {
  Bell,
  Database,
  FileBarChart,
  Filter,
  Mail,
  ArrowRightLeft,
  Sparkles,
  Tag,
  Webhook,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { MarkerType, type Edge } from '@xyflow/react'
import type { NodeKind } from '@/lib/workflow'
import type { ScoredLead } from '@/lib/scoring'
import type { NodeData } from '@/components/NodeConfigModal'

export const DND_MIME = 'application/sq-node'

export type KindMeta = {
  label: string
  tone: string
  group: 'trigger' | 'condition' | 'action'
  Icon: LucideIcon
}

export const KIND_META: Record<NodeKind, KindMeta> = {
  trigger: { label: 'Trigger', tone: '#60a5fa', group: 'trigger', Icon: Zap },
  condition: { label: 'Condition', tone: '#fbbf24', group: 'condition', Icon: Filter },
  action_enrich: { label: 'Enrich', tone: '#a78bfa', group: 'action', Icon: Sparkles },
  action_draft_email: { label: 'Send email', tone: '#fbbf24', group: 'action', Icon: Mail },
  action_move_stage: { label: 'Move stage', tone: '#f472b6', group: 'action', Icon: ArrowRightLeft },
  action_crm_push: { label: 'CRM / Sheets', tone: '#34d399', group: 'action', Icon: Database },
  action_notify: { label: 'Notify', tone: '#fb923c', group: 'action', Icon: Bell },
  action_tag: { label: 'Tag', tone: '#94a3b8', group: 'action', Icon: Tag },
  action_http: { label: 'HTTP / Webhook', tone: '#38bdf8', group: 'action', Icon: Webhook },
  action_weekly_report: { label: 'Weekly report', tone: '#a3a3a3', group: 'action', Icon: FileBarChart },
}

export const EDGE_DEFAULTS: Partial<Edge> = {
  type: 'smoothstep',
  animated: false,
  style: { stroke: '#52525b', strokeWidth: 1.75 },
  markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: '#71717a' },
}

/** Fixed lead used for dry-run tests on the canvas (never hits the network). */
export const SAMPLE_LEAD: ScoredLead = {
  id: 'L_demo',
  lead: {
    company: 'Northwind HVAC LLC',
    industry: 'HVAC Services',
    city: 'Columbus',
    state: 'OH',
    country: 'US',
    ownerName: 'Dana Reyes',
    title: 'Owner',
    email: 'dana@northwindhvac.example',
    employees: 35,
    revenue: '$6M',
    yearFounded: 1995,
  },
  score: 92,
  tier: 'A',
  reasons: ['+22 Industry match'],
  junk: false,
  junkReasons: [],
  whyNow: '31-yr HVAC with long-tenured owner — succession window.',
  tags: [],
  stage: 'new',
  stageChangedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
}

const OP_SYMBOL: Record<string, string> = {
  gte: '≥',
  lte: '≤',
  contains: '∋',
  neq: '≠',
  eq: '=',
}

/** One-line summary under the node title on the canvas. */
export function subtitleForNode(data: NodeData): string {
  if (data.kind === 'trigger') {
    const event = String(data.event || 'new_lead')
    if (event === 'tier_changed') {
      return `Tier → ${data.tier || 'A'}`
    }
    if (event === 'field_updated') {
      return 'After enrich'
    }
    if (event === 'stage_changed') {
      return 'Stage change'
    }
    if (event === 'schedule') {
      return 'Schedule'
    }
    return 'New lead'
  }

  if (data.kind === 'condition') {
    const field = String(data.field || 'tier')
    const op = String(data.op || 'eq')
    const symbol = OP_SYMBOL[op] || '='
    return `${field} ${symbol} ${data.value ?? ''}`
  }

  if (data.kind === 'action_crm_push') {
    return data.webhook ? 'webhook' : 'CRM row'
  }

  if (data.kind === 'action_http') {
    return data.url ? String(data.method || 'POST') : 'needs URL'
  }

  if (data.kind === 'action_draft_email') {
    return 'never sent'
  }

  if (data.kind === 'action_move_stage') {
    return String(data.stage || 'contacted')
  }

  if (data.kind === 'action_notify') {
    return 'in-app'
  }

  if (data.kind === 'action_tag') {
    return String(data.tag || 'tag')
  }

  if (data.kind === 'action_enrich') {
    return 'ethical crawl'
  }

  return ''
}
