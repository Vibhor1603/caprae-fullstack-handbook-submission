/**
 * Small n8n-style workflow executor for the deal-sourcing demo.
 * Never sends email. HTTP/Webhook nodes branch on ok vs fail handles.
 * Legacy graphs are migrated in sanitizeGraph.
 */
import type { ScoredLead } from '@/lib/scoring'
import { toCrmRows } from '@/lib/scoring'
import { interpolate, leadPayload } from '@/lib/interpolate'
import { demoEnrich, applyEnrichment } from '@/lib/enrichment'
import { normalizeDomain } from '@/lib/scoring'
import { applyStageChange, daysInStage, type PipelineStage } from '@/lib/pipeline'
import { buildLeadProfile } from '@/lib/profile'

export type NodeKind =
  | 'trigger'
  | 'condition'
  | 'action_draft_email'
  | 'action_crm_push'
  | 'action_http'
  | 'action_weekly_report'
  | 'action_enrich'
  | 'action_move_stage'
  | 'action_notify'
  | 'action_tag'

export type TriggerEvent =
  | 'new_lead'
  | 'tier_changed'
  | 'field_updated'
  | 'stage_changed'
  | 'schedule'
export type ConditionField =
  | 'tier'
  | 'score'
  | 'industry'
  | 'state'
  | 'confidence'
  | 'stage'
  | 'days_in_stage'
export type ConditionOp = 'eq' | 'neq' | 'gte' | 'lte' | 'contains'

export type WorkflowNode = {
  id: string
  type: NodeKind
  position: { x: number; y: number }
  data: Record<string, string | number | boolean | undefined>
}

export type WorkflowEdge = {
  id: string
  source: string
  target: string
  /** For HTTP/Webhook: `ok` (2xx) or `fail` (error / non-2xx) */
  sourceHandle?: string | null
}
export type WorkflowGraph = { nodes: WorkflowNode[]; edges: WorkflowEdge[] }

export function hasBranchOutputs(kind: NodeKind): boolean {
  return kind === 'action_http'
}

export type NodeResult = {
  nodeId: string
  type: NodeKind
  ok: boolean
  detail: string
  artifacts?: Record<string, unknown>
}

export type IntegrationConfig = {
  googleSheetsWebhook?: string
  hubspotConnected?: boolean
}

export type ExecContext = {
  lead: ScoredLead
  trigger: string
  prevTier?: string
  prevStage?: string
  fieldConfidence?: number
  integrations?: IntegrationConfig
  allowNetwork?: boolean
  now?: Date
}

/** Palette order — lean set for the demo story. */
export const PALETTE_KINDS: NodeKind[] = [
  'trigger',
  'condition',
  'action_enrich',
  'action_draft_email',
  'action_move_stage',
  'action_crm_push',
  'action_notify',
  'action_tag',
  'action_http',
  'action_weekly_report',
]

const ALL_KINDS: NodeKind[] = [...PALETTE_KINDS]

export function isNodeKind(v: unknown): v is NodeKind {
  return typeof v === 'string' && (ALL_KINDS as string[]).includes(v)
}

export function groupOf(kind: NodeKind): 'trigger' | 'condition' | 'action' {
  if (kind === 'trigger') {
    return 'trigger'
  }
  if (kind === 'condition') {
    return 'condition'
  }
  return 'action'
}

export function defaultDataFor(kind: NodeKind): Record<string, string | number | boolean | undefined> {
  switch (kind) {
    case 'trigger':
      return { label: 'When lead arrives', event: 'new_lead', tier: 'A' }
    case 'condition':
      return { label: 'If tier is A', field: 'tier', op: 'eq', value: 'A' }
    case 'action_draft_email':
      return {
        label: 'Draft owner email',
        fromEmail: 'searcher@firm.example',
        subject: 'Quick note — {{company}}',
        template:
          'Hi {{owner}}, I work with operators in {{industry}} and admired {{company}}. Open to a short conversation about the business?',
      }
    case 'action_crm_push':
      return {
        label: 'Push to CRM / Sheets',
        webhook: '',
      }
    case 'action_http':
      return {
        label: 'HTTP / Webhook',
        method: 'POST',
        url: '',
        headers: '{"Content-Type":"application/json"}',
        body: '{"company":"{{company}}","tier":"{{tier}}","score":{{score}}}',
      }
    case 'action_weekly_report':
      return { label: 'Add to weekly report' }
    case 'action_enrich':
      return { label: 'Enrich from website' }
    case 'action_move_stage':
      return { label: 'Move stage', stage: 'contacted' }
    case 'action_notify':
      return { label: 'Notify', message: 'Workflow update for {{company}}' }
    case 'action_tag':
      return { label: 'Add tag', tag: 'autopilot' }
    default:
      return { label: 'Node' }
  }
}

/** Map old multi-node graphs into the five-kind model. */
function migrateNode(raw: {
  id?: string
  type?: string
  position?: { x?: number; y?: number }
  data?: Record<string, string | number | boolean | undefined>
}): WorkflowNode | null {
  if (!raw?.id || typeof raw.type !== 'string') {
    return null
  }

  const position = {
    x: Number.isFinite(raw.position?.x) ? Number(raw.position?.x) : 0,
    y: Number.isFinite(raw.position?.y) ? Number(raw.position?.y) : 0,
  }
  const data = raw.data || {}

  if (isNodeKind(raw.type)) {
    return {
      id: raw.id,
      type: raw.type,
      position,
      data: { ...defaultDataFor(raw.type), ...data },
    }
  }

  switch (raw.type) {
    case 'trigger_new_lead':
      return {
        id: raw.id,
        type: 'trigger',
        position,
        data: {
          ...defaultDataFor('trigger'),
          ...data,
          event: 'new_lead',
          label: data.label || 'When lead arrives',
        },
      }
    case 'trigger_tier_changed':
      return {
        id: raw.id,
        type: 'trigger',
        position,
        data: {
          ...defaultDataFor('trigger'),
          ...data,
          event: 'tier_changed',
          tier: data.tier || 'A',
          label: data.label || 'When tier changes',
        },
      }
    case 'trigger_field_updated':
      return {
        id: raw.id,
        type: 'trigger',
        position,
        data: {
          ...defaultDataFor('trigger'),
          ...data,
          event: 'field_updated',
          label: data.label || 'After enrich',
        },
      }
    case 'condition_tier':
      return {
        id: raw.id,
        type: 'condition',
        position,
        data: {
          ...defaultDataFor('condition'),
          ...data,
          field: 'tier',
          op: 'eq',
          value: String(data.tier || 'A'),
          label: data.label || `If tier is ${data.tier || 'A'}`,
        },
      }
    case 'condition_industry':
      return {
        id: raw.id,
        type: 'condition',
        position,
        data: {
          ...defaultDataFor('condition'),
          field: 'industry',
          op: 'contains',
          value: String(data.industry || 'hvac'),
          label: data.label || 'If industry matches',
        },
      }
    case 'condition_state':
      return {
        id: raw.id,
        type: 'condition',
        position,
        data: {
          ...defaultDataFor('condition'),
          field: 'state',
          op: 'eq',
          value: String(data.state || 'OH'),
          label: data.label || 'If state matches',
        },
      }
    case 'condition_score':
      return {
        id: raw.id,
        type: 'condition',
        position,
        data: {
          ...defaultDataFor('condition'),
          field: 'score',
          op: 'gte',
          value: Number(data.minScore ?? 70),
          label: data.label || 'If score ≥ threshold',
        },
      }
    case 'condition_confidence':
      return {
        id: raw.id,
        type: 'condition',
        position,
        data: {
          ...defaultDataFor('condition'),
          field: 'confidence',
          op: 'gte',
          value: Number(data.minConfidence ?? 0.5),
          label: data.label || 'If confidence ≥ threshold',
        },
      }
    case 'action_webhook':
      return {
        id: raw.id,
        type: 'action_http',
        position,
        data: {
          ...defaultDataFor('action_http'),
          label: String(data.label || 'HTTP / Webhook'),
          method: 'POST',
          url: String(data.url || ''),
          body: String(data.body || defaultDataFor('action_http').body),
        },
      }
    case 'action_google_sheets':
    case 'action_hubspot':
      return {
        id: raw.id,
        type: 'action_crm_push',
        position,
        data: {
          ...defaultDataFor('action_crm_push'),
          label: String(data.label || 'Push to CRM / Sheets'),
          webhook: String(data.webhook || data.webhookUrl || data.url || ''),
        },
      }
    case 'action_notify':
    case 'notify':
      return {
        id: raw.id,
        type: 'action_notify',
        position,
        data: {
          ...defaultDataFor('action_notify'),
          ...data,
          label: String(data.label || 'Notify'),
        },
      }
    case 'action_tag':
    case 'tag':
      return {
        id: raw.id,
        type: 'action_tag',
        position,
        data: {
          ...defaultDataFor('action_tag'),
          ...data,
          label: String(data.label || 'Add tag'),
        },
      }
    case 'trigger_schedule':
      return {
        id: raw.id,
        type: 'trigger',
        position,
        data: {
          ...defaultDataFor('trigger'),
          event: 'schedule',
          label: data.label || 'On schedule',
        },
      }
    default:
      return null
  }
}

export function sanitizeGraph(graph: WorkflowGraph | null | undefined): WorkflowGraph {
  const nodes = (graph?.nodes || []).map(migrateNode).filter((node): node is WorkflowNode => !!node)
  const nodeIds = new Set(nodes.map(node => node.id))
  const seenEdgeKeys = new Set<string>()
  const edges: WorkflowEdge[] = []

  for (const edge of graph?.edges || []) {
    if (!edge?.source || !edge?.target) {
      continue
    }
    if (edge.source === edge.target) {
      continue
    }
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      continue
    }

    const sourceHandle = edge.sourceHandle ? String(edge.sourceHandle) : null
    const edgeKey = `${edge.source}:${sourceHandle || ''}->${edge.target}`
    if (seenEdgeKeys.has(edgeKey)) {
      continue
    }
    seenEdgeKeys.add(edgeKey)

    const sourceNode = nodes.find(node => node.id === edge.source)
    const targetNode = nodes.find(node => node.id === edge.target)
    if (!sourceNode || !targetNode) {
      continue
    }
    if (!isValidConnection(sourceNode.type, targetNode.type)) {
      continue
    }

    edges.push({
      id: edge.id || edgeKey,
      source: edge.source,
      target: edge.target,
      sourceHandle,
    })
  }

  return { nodes, edges }
}

export function isValidConnection(sourceKind: NodeKind, targetKind: NodeKind): boolean {
  const sourceGroup = groupOf(sourceKind)
  const targetGroup = groupOf(targetKind)

  if (targetGroup === 'trigger') {
    return false
  }
  if (sourceGroup === 'trigger') {
    return targetGroup === 'condition' || targetGroup === 'action'
  }
  if (sourceGroup === 'condition') {
    return targetGroup === 'condition' || targetGroup === 'action'
  }
  if (sourceGroup === 'action') {
    // Allow action → condition so enrich can gate later steps on confidence.
    return targetGroup === 'action' || targetGroup === 'condition'
  }
  return false
}

/** Blank canvas for a new automation. */
export const EMPTY_GRAPH: WorkflowGraph = { nodes: [], edges: [] }

export function countTriggers(
  nodes: Array<{ type?: string; data?: { kind?: string } }>,
): number {
  return nodes.filter(node => {
    const kind = node.type || node.data?.kind
    return kind === 'trigger'
  }).length
}

/**
 * Canvas rules: one trigger and one automation path per canvas.
 * Extra canvases are separate workflows in the list.
 */
export function canAddNodeKind(
  kind: NodeKind,
  nodes: Array<{ type?: string; data?: { kind?: string } }>,
): { ok: true } | { ok: false; reason: string } {
  if (kind === 'trigger' && countTriggers(nodes) >= 1) {
    return {
      ok: false,
      reason: 'Only one trigger per canvas — create a new automation for another trigger',
    }
  }
  return { ok: true }
}

/** Validate graph before persist: ≤1 trigger (one automation per canvas). */
export function validateCanvasGraph(
  graph: WorkflowGraph,
): { ok: true } | { ok: false; reason: string } {
  const triggers = graph.nodes.filter(node => node.type === 'trigger').length
  if (triggers > 1) {
    return {
      ok: false,
      reason: 'Only one trigger allowed per automation canvas',
    }
  }
  return { ok: true }
}

export const DEFAULT_GRAPH: WorkflowGraph = sanitizeGraph({
  nodes: [
    { id: 't1', type: 'trigger', position: { x: 40, y: 140 }, data: defaultDataFor('trigger') },
    { id: 'c1', type: 'condition', position: { x: 300, y: 140 }, data: defaultDataFor('condition') },
    { id: 'a1', type: 'action_draft_email', position: { x: 560, y: 40 }, data: defaultDataFor('action_draft_email') },
    { id: 'a2', type: 'action_crm_push', position: { x: 560, y: 160 }, data: defaultDataFor('action_crm_push') },
    {
      id: 'a3',
      type: 'action_weekly_report',
      position: { x: 560, y: 280 },
      data: defaultDataFor('action_weekly_report'),
    },
  ],
  edges: [
    { id: 'e1', source: 't1', target: 'c1' },
    { id: 'e2', source: 'c1', target: 'a1' },
    { id: 'e3', source: 'c1', target: 'a2' },
    { id: 'e4', source: 'c1', target: 'a3' },
  ],
})

function triggerMatches(node: WorkflowNode, ctx: ExecContext): boolean {
  if (!ctx?.lead || node.type !== 'trigger') {
    return false
  }

  const event = String(node.data.event || 'new_lead') as TriggerEvent

  if (event === 'new_lead') {
    return ctx.trigger === 'new_lead' || ctx.trigger === 'tier_changed'
  }
  if (event === 'field_updated') {
    return ctx.trigger === 'field_updated'
  }
  if (event === 'schedule') {
    return ctx.trigger === 'schedule'
  }
  if (event === 'stage_changed') {
    if (ctx.trigger !== 'stage_changed') {
      return false
    }
    const wanted = String(node.data.stage || '').toLowerCase()
    if (wanted && wanted !== String(ctx.lead.stage || '')) {
      return false
    }
    if (ctx.prevStage != null && ctx.prevStage === ctx.lead.stage) {
      return false
    }
    return true
  }
  if (event === 'tier_changed') {
    if (ctx.trigger !== 'tier_changed') {
      return false
    }
    const wantedTier = String(node.data.tier || '').toUpperCase()
    if (wantedTier && wantedTier !== ctx.lead.tier) {
      return false
    }
    if (ctx.prevTier != null && ctx.prevTier === ctx.lead.tier) {
      return false
    }
    return true
  }

  return false
}

function conditionPasses(node: WorkflowNode, ctx: ExecContext): boolean {
  if (!ctx?.lead || node.type !== 'condition') {
    return false
  }

  const lead = ctx.lead
  const field = String(node.data.field || 'tier') as ConditionField
  const op = String(node.data.op || 'eq') as ConditionOp
  const rawValue = node.data.value

  let left: string | number
  switch (field) {
    case 'tier':
      left = lead.tier
      break
    case 'score':
      left = Number(lead.score)
      break
    case 'industry':
      left = String(lead.lead.industry || '').toLowerCase()
      break
    case 'state':
      left = String(lead.lead.state || '')
        .toLowerCase()
        .trim()
      break
    case 'stage':
      left = String(lead.stage || 'new').toLowerCase()
      break
    case 'days_in_stage':
      left = daysInStage(lead.stageChangedAt, ctx.now || new Date())
      break
    case 'confidence': {
      const confidence = ctx.fieldConfidence
      if (confidence == null || !Number.isFinite(confidence)) {
        return false
      }
      left = confidence
      break
    }
    default:
      return false
  }

  if (op === 'contains') {
    const needle = String(rawValue || '')
      .trim()
      .toLowerCase()
    if (!needle) {
      return true
    }
    return String(left).includes(needle)
  }

  if (op === 'gte' || op === 'lte') {
    const leftNumber = Number(left)
    const rightNumber = Number(rawValue)
    if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) {
      return false
    }
    return op === 'gte' ? leftNumber >= rightNumber : leftNumber <= rightNumber
  }

  const leftText = String(left).toLowerCase()
  const rightText = String(rawValue ?? '').toLowerCase()
  if (op === 'neq') {
    return leftText !== rightText
  }
  return leftText === rightText
}

async function postJson(
  url: string,
  body: unknown,
  headers?: Record<string, string>,
  method = 'POST',
): Promise<{ ok: boolean; status: number; text: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(headers || {}) },
      body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await res.text().catch(() => '')
    return { ok: res.ok, status: res.status, text: text.slice(0, 400) }
  } finally {
    clearTimeout(timer)
  }
}

function parseHeaders(raw: string): Record<string, string> | undefined {
  const text = String(raw || '').trim()
  if (!text) {
    return undefined
  }

  try {
    const parsed = JSON.parse(text) as Record<string, string>
    return parsed && typeof parsed === 'object' ? parsed : undefined
  } catch {
    return undefined
  }
}

function parseBodyTemplate(raw: string, lead: ScoredLead): unknown {
  const filled = interpolate(String(raw || '').trim(), lead)
  if (!filled) {
    return leadPayload(lead)
  }

  try {
    return JSON.parse(filled)
  } catch {
    return { text: filled, lead: leadPayload(lead) }
  }
}

async function runAction(node: WorkflowNode, ctx: ExecContext): Promise<NodeResult> {
  const lead = ctx.lead
  if (!lead) {
    return { nodeId: node.id, type: node.type, ok: false, detail: 'Missing lead context' }
  }
  const net = ctx.allowNetwork !== false

  switch (node.type) {
    case 'action_draft_email': {
      const tpl = String(node.data.template || '').trim()
      if (!tpl) {
        return { nodeId: node.id, type: node.type, ok: false, detail: 'Email template is empty' }
      }
      const fromRaw = String(node.data.fromEmail || '').trim()
      const fromEmail = fromRaw && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(fromRaw) ? fromRaw : null
      if (fromRaw && !fromEmail) {
        return { nodeId: node.id, type: node.type, ok: false, detail: 'From email looks invalid' }
      }
      const body = interpolate(tpl, lead)
      const subject = interpolate(String(node.data.subject || `Quick note — {{company}}`), lead)
      const to = lead.lead.email || null
      return {
        nodeId: node.id,
        type: node.type,
        ok: true,
        detail: to
          ? `Draft prepared for ${to} (not sent)`
          : 'Draft prepared (no email on lead — not sent)',
        artifacts: { subject, body, to, from: fromEmail, sent: false },
      }
    }
    case 'action_crm_push': {
      try {
        const rows = toCrmRows([lead])
        const nodeWebhook = interpolate(String(node.data.webhook || '').trim(), lead)
        const sheetsUrl = String(ctx.integrations?.googleSheetsWebhook || '').trim()
        const url = nodeWebhook || sheetsUrl
        if (url && !/^https?:\/\//i.test(url)) {
          return { nodeId: node.id, type: node.type, ok: false, detail: 'Webhook must start with http(s)://' }
        }
        if (url && net) {
          const viaSheets = !nodeWebhook && !!sheetsUrl
          const res = await postJson(
            url,
            viaSheets
              ? { action: 'append', row: rows[0], lead: leadPayload(lead) }
              : { crmRow: rows[0], lead: leadPayload(lead) },
          )
          return {
            nodeId: node.id,
            type: node.type,
            ok: res.ok,
            detail: res.ok
              ? viaSheets
                ? `Appended CRM row to Sheets (${res.status})`
                : `CRM row posted (${res.status})`
              : `Push failed (${res.status})`,
            artifacts: { crmRow: rows[0], webhook: url, status: res.status, sheets: viaSheets },
          }
        }
        return {
          nodeId: node.id,
          type: node.type,
          ok: true,
          detail: url
            ? 'CRM row ready (network skipped in dry-run)'
            : 'HubSpot-format row ready — Connect Sheets or add a webhook URL',
          artifacts: { crmRow: rows[0] || null, webhook: url || null },
        }
      } catch (e) {
        return {
          nodeId: node.id,
          type: node.type,
          ok: false,
          detail: e instanceof Error ? e.message : 'CRM push failed',
        }
      }
    }
    case 'action_http': {
      const url = interpolate(String(node.data.url || '').trim(), lead)
      if (!url) {
        return { nodeId: node.id, type: node.type, ok: false, detail: 'URL is required' }
      }
      if (!/^https?:\/\//i.test(url)) {
        return { nodeId: node.id, type: node.type, ok: false, detail: 'URL must start with http(s)://' }
      }
      const method = String(node.data.method || 'POST').toUpperCase()
      const headers = parseHeaders(String(node.data.headers || ''))
      const body = parseBodyTemplate(String(node.data.body || ''), lead)
      if (!net) {
        return {
          nodeId: node.id,
          type: node.type,
          ok: true,
          detail: `Would ${method} ${url} (dry-run · success path)`,
          artifacts: { url, method, body, dryRun: true, status: 200 },
        }
      }
      try {
        const res = await postJson(url, body, headers, method)
        return {
          nodeId: node.id,
          type: node.type,
          ok: res.ok,
          detail: res.ok
            ? `${method} → ${res.status}`
            : `${method} failed → ${res.status}${res.text ? `: ${res.text.slice(0, 80)}` : ''}`,
          artifacts: { url, method, status: res.status, responsePreview: res.text },
        }
      } catch (e) {
        return {
          nodeId: node.id,
          type: node.type,
          ok: false,
          detail: e instanceof Error ? e.message : 'HTTP request failed',
          artifacts: { url, method, status: 0 },
        }
      }
    }
    case 'action_weekly_report':
      return {
        nodeId: node.id,
        type: node.type,
        ok: true,
        detail: 'Queued for weekly report',
        artifacts: {
          reportLine: `${lead.tier} · ${lead.lead.company || lead.id} · ${lead.score} · ${lead.whyNow || ''}`,
        },
      }
    case 'action_enrich': {
      const domain = normalizeDomain(lead.lead.website, lead.lead.email)
      const snap = demoEnrich(lead.lead, domain)
      const merged = applyEnrichment(lead.lead, snap)
      const conf = Math.max(
        snap.email.confidence,
        snap.phone.confidence,
        snap.yearFounded.confidence,
        snap.services.confidence,
      )
      ctx.fieldConfidence = conf
      const nextStage: PipelineStage =
        lead.stage === 'new' || !lead.stage ? 'enriched' : (lead.stage as PipelineStage)
      const profile = buildLeadProfile(merged, {
        enrichment: snap,
        whyNow: lead.whyNow,
      })
      Object.assign(ctx.lead, {
        lead: merged,
        stage: nextStage,
        profile,
      })
      return {
        nodeId: node.id,
        type: node.type,
        ok: true,
        detail: `Enriched (${snap.source}) · confidence ${conf.toFixed(2)}`,
        artifacts: {
          enrichment: snap,
          fieldConfidence: conf,
          leadPatch: { lead: merged, stage: nextStage, profile },
        },
      }
    }
    case 'action_move_stage': {
      const to = String(node.data.stage || 'contacted')
      const result = applyStageChange(lead.stage, to, 'workflow', ctx.now || new Date())
      if ('ok' in result && result.ok === false) {
        return { nodeId: node.id, type: node.type, ok: false, detail: result.reason }
      }
      const ok = result as Exclude<typeof result, { ok: false }>
      ctx.lead.stage = ok.stage
      ctx.lead.stageChangedAt = ok.stageChangedAt
      return {
        nodeId: node.id,
        type: node.type,
        ok: true,
        detail: ok.activity.summary,
        artifacts: {
          stage: ok.stage,
          previousStage: ok.previousStage,
          leadPatch: { stage: ok.stage, stageChangedAt: ok.stageChangedAt },
          activity: ok.activity,
        },
      }
    }
    case 'action_notify': {
      const message = interpolate(
        String(node.data.message || 'Update for {{company}}'),
        lead,
      )
      return {
        nodeId: node.id,
        type: node.type,
        ok: true,
        detail: `Notify: ${message}`,
        artifacts: { notify: true, message, sent: false },
      }
    }
    case 'action_tag': {
      const tag = String(node.data.tag || 'autopilot').trim()
      if (!tag) {
        return { nodeId: node.id, type: node.type, ok: false, detail: 'Tag is empty' }
      }
      const tags = [...new Set([...(lead.tags || []), tag])]
      ctx.lead.tags = tags
      return {
        nodeId: node.id,
        type: node.type,
        ok: true,
        detail: `Tagged “${tag}”`,
        artifacts: { tag, tags, leadPatch: { tags } },
      }
    }
    default:
      return { nodeId: node.id, type: node.type, ok: false, detail: 'Unknown action' }
  }
}

/** BFS from matching triggers through conditions to actions. Cycle-safe. */
export async function executeWorkflow(raw: WorkflowGraph, ctx: ExecContext): Promise<NodeResult[]> {
  if (!ctx?.lead) {
    return [{ nodeId: '_', type: 'trigger', ok: false, detail: 'No lead in context' }]
  }

  const graph = sanitizeGraph(raw)
  if (!graph.nodes.length) {
    return [{ nodeId: '_', type: 'trigger', ok: false, detail: 'Empty workflow' }]
  }

  const byId = new Map(graph.nodes.map(n => [n.id, n]))
  type OutEdge = { target: string; handle: string | null }
  const outs = new Map<string, OutEdge[]>()
  for (const e of graph.edges) {
    const list = outs.get(e.source) || []
    list.push({ target: e.target, handle: e.sourceHandle ? String(e.sourceHandle) : null })
    outs.set(e.source, list)
  }

  function nextTargets(sourceId: string, branch?: 'ok' | 'fail'): string[] {
    const outgoing = outs.get(sourceId) || []
    if (!branch) {
      return outgoing.map(edge => edge.target)
    }

    const matched = outgoing.filter(edge => edge.handle === branch)
    if (matched.length) {
      return matched.map(edge => edge.target)
    }

    // Unlabeled edges count as the success path only.
    if (branch === 'ok') {
      return outgoing.filter(edge => !edge.handle).map(edge => edge.target)
    }

    return []
  }

  const results: NodeResult[] = []
  const triggers = graph.nodes.filter(n => groupOf(n.type) === 'trigger')
  const queue: string[] = []

  if (!triggers.length) {
    return [{ nodeId: '_', type: 'trigger', ok: false, detail: 'No trigger nodes in graph' }]
  }

  for (const t of triggers) {
    const match = triggerMatches(t, ctx)
    results.push({
      nodeId: t.id,
      type: t.type,
      ok: match,
      detail: match ? 'Trigger fired' : 'Trigger skipped',
    })
    if (match) {
      const next = nextTargets(t.id)
      if (!next.length) {
        results.push({
          nodeId: t.id,
          type: t.type,
          ok: true,
          detail: 'Trigger fired (no outbound edges)',
        })
      }
      queue.push(...next)
    }
  }

  const visited = new Set<string>()
  let steps = 0
  const MAX_STEPS = 500

  while (queue.length && steps < MAX_STEPS) {
    steps++
    const id = queue.shift()!
    if (visited.has(id)) {continue}
    visited.add(id)
    const node = byId.get(id)
    if (!node) {
      results.push({
        nodeId: id,
        type: 'trigger',
        ok: false,
        detail: 'Edge points to missing node',
      })
      continue
    }

    const g = groupOf(node.type)
    if (g === 'trigger') {
      results.push({
        nodeId: node.id,
        type: node.type,
        ok: false,
        detail: 'Trigger reached mid-graph — skipped',
      })
      continue
    }

    if (g === 'condition') {
      const pass = conditionPasses(node, ctx)
      results.push({
        nodeId: node.id,
        type: node.type,
        ok: pass,
        detail: pass ? 'Condition passed' : 'Condition failed',
      })
      if (pass) {
        queue.push(...nextTargets(node.id))
      }
      continue
    }

    if (g === 'action') {
      const r = await runAction(node, ctx)
      results.push(r)
      if (hasBranchOutputs(node.type)) {
        queue.push(...nextTargets(node.id, r.ok ? 'ok' : 'fail'))
      } else if (r.ok) {
        queue.push(...nextTargets(node.id))
      }
    }
  }

  if (steps >= MAX_STEPS) {
    results.push({
      nodeId: '_',
      type: 'trigger',
      ok: false,
      detail: 'Stopped: step limit (possible cycle)',
    })
  }

  return results
}

export function graphHasSuccessfulAction(results: NodeResult[]): boolean {
  return results.some(r => r.ok && String(r.type).startsWith('action_'))
}
