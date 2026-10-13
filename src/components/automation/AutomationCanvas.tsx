'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  SelectionMode,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  ConnectionLineType,
  type Connection,
  type Edge,
  type OnSelectionChangeParams,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Eraser, Play, Plus, Power, Save, Trash2 } from 'lucide-react'
import {
  EMPTY_GRAPH,
  canAddNodeKind,
  defaultDataFor,
  executeWorkflow,
  isNodeKind,
  isValidConnection,
  validateCanvasGraph,
  type NodeKind,
  type WorkflowGraph,
} from '@/lib/workflow'
import { NodeConfigModal, type NodeData } from '@/components/NodeConfigModal'
import type { ClientIntegrations } from '@/components/IntegrationsMenu'
import { DND_MIME, EDGE_DEFAULTS, KIND_META, SAMPLE_LEAD } from '@/components/automation/kinds'
import { flowNodeTypes } from '@/components/automation/FlowNode'
import { Palette } from '@/components/automation/Palette'
import {
  flowNodesToGraph,
  graphToFlowNodes,
  type SqNode,
} from '@/components/automation/graphAdapters'
import { TemplateGallery, type TemplateStatus } from '@/components/TemplateGallery'
import { DEAL_TEMPLATES, type TemplateKey } from '@/lib/templates'

export type WorkflowRecord = {
  id: string
  name: string
  enabled: boolean
  graph: WorkflowGraph
  templateKey?: string | null
  isTemplate?: boolean
}

type CanvasProps = {
  onSaved?: (workflow: WorkflowRecord) => void
  integrations?: ClientIntegrations
}

function CanvasInner({ onSaved, integrations }: CanvasProps) {
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [dryRunLog, setDryRunLog] = useState<string | null>(null)
  const [draftPreview, setDraftPreview] = useState<{
    from: string
    to: string
    subject: string
    body: string
  } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [templateBusy, setTemplateBusy] = useState<string | null>(null)

  const hasFittedView = useRef(false)
  const { fitView, screenToFlowPosition } = useReactFlow()

  const templateStatus: TemplateStatus[] = useMemo(
    () =>
      DEAL_TEMPLATES.map(t => {
        const match = workflows.find(w => w.templateKey === t.key)
        return {
          key: t.key,
          installed: !!match,
          enabled: !!match?.enabled,
          workflowId: match?.id,
        }
      }),
    [workflows],
  )

  async function addTemplate(key: TemplateKey) {
    const tpl = DEAL_TEMPLATES.find(t => t.key === key)
    if (!tpl) {
      return
    }
    setTemplateBusy(key)
    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tpl.name,
          graph: tpl.graph,
          enabled: true,
          templateKey: tpl.key,
          isTemplate: true,
        }),
      })
      const payload = await response.json()
      if (response.ok && payload.workflow) {
        const wf = payload.workflow as WorkflowRecord
        setWorkflows(prev => [wf, ...prev.filter(w => w.templateKey !== key)])
        setActiveId(wf.id)
        setDraftName(wf.name)
        loadGraphOntoCanvas(wf.graph)
        onSaved?.(wf)
      } else {
        setStatusMessage(payload.error || 'Could not add template')
      }
    } finally {
      setTemplateBusy(null)
    }
  }

  async function toggleTemplate(key: TemplateKey, enabled: boolean) {
    const match = workflows.find(w => w.templateKey === key)
    if (!match) {
      return
    }
    setTemplateBusy(key)
    try {
      const response = await fetch('/api/workflows', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: match.id, enabled }),
      })
      const payload = await response.json()
      if (response.ok && payload.workflow) {
        setWorkflows(prev =>
          prev.map(w => (w.id === match.id ? { ...w, enabled } : w)),
        )
        onSaved?.(payload.workflow)
      }
    } finally {
      setTemplateBusy(null)
    }
  }

  const activeWorkflow = useMemo(
    () => workflows.find(workflow => workflow.id === activeId) || workflows[0] || null,
    [workflows, activeId],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState<SqNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const loadGraphOntoCanvas = useCallback(
    (graph: WorkflowGraph) => {
      const flow = graphToFlowNodes(graph || EMPTY_GRAPH)
      setNodes(flow.nodes)
      setEdges(flow.edges)
      setSelectedId(null)
      setModalOpen(false)
      setDryRunLog(null)
      setDraftPreview(null)
      setDirty(false)
      hasFittedView.current = false

      requestAnimationFrame(() => {
        if (!hasFittedView.current) {
          fitView({ padding: 0.36, duration: 280, maxZoom: 0.85 })
          hasFittedView.current = true
        }
      })
    },
    [fitView, setEdges, setNodes],
  )

  useEffect(() => {
    void (async () => {
      const response = await fetch('/api/workflows')
      const payload = await response.json()
      const list = (payload.workflows || []) as WorkflowRecord[]
      setWorkflows(list)
      if (list[0]) {
        setActiveId(list[0].id)
        setDraftName(list[0].name)
      }
    })()
  }, [])

  useEffect(() => {
    if (!activeWorkflow) {
      return
    }

    setDraftName(activeWorkflow.name)
    loadGraphOntoCanvas(activeWorkflow.graph)
    // Reload graph only when switching workflows — not on every node edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkflow?.id])

  const selectedNode = useMemo(
    () => nodes.find(node => node.id === selectedId) || null,
    [nodes, selectedId],
  )

  const disabledKinds = useMemo(() => {
    const blocked: Partial<Record<NodeKind, string>> = {}
    const triggerCheck = canAddNodeKind('trigger', nodes.map(node => ({ type: node.data.kind })))
    if (!triggerCheck.ok) {
      blocked.trigger = triggerCheck.reason
    }
    return blocked
  }, [nodes])

  const markDirtyNodes = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      if (changes.some(change => change.type !== 'select')) {
        setDirty(true)
      }
      onNodesChange(changes)
    },
    [onNodesChange],
  )

  const markDirtyEdges = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      if (changes.some(change => change.type !== 'select')) {
        setDirty(true)
      }
      onEdgesChange(changes)
    },
    [onEdgesChange],
  )

  const placeNode = useCallback(
    (kind: NodeKind, position: { x: number; y: number }) => {
      const check = canAddNodeKind(
        kind,
        nodes.map(node => ({ type: node.data.kind })),
      )
      if (!check.ok) {
        setStatusMessage(check.reason)
        return
      }

      const id = `${kind}_${Date.now().toString(36)}`
      const defaults = defaultDataFor(kind)
      const node: SqNode = {
        id,
        type: 'sqNode',
        position,
        draggable: true,
        selectable: true,
        data: {
          ...defaults,
          kind,
          label: String(defaults.label || KIND_META[kind].label),
        },
      }
      setNodes(current => [...current, node])
      setSelectedId(id)
      setModalOpen(true)
      setDirty(true)
      setStatusMessage(`Added ${KIND_META[kind].label}`)
    },
    [nodes, setNodes],
  )

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault()
      const rawKind = event.dataTransfer.getData(DND_MIME) || event.dataTransfer.getData('text/plain')
      if (!isNodeKind(rawKind)) {
        return
      }

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      placeNode(rawKind, {
        x: Math.round(position.x / 8) * 8,
        y: Math.round(position.y / 8) * 8,
      })
    },
    [placeNode, screenToFlowPosition],
  )

  const addNodeFromPalette = useCallback(
    (kind: NodeKind) => {
      const offset = nodes.length % 6
      placeNode(kind, { x: 180 + offset * 20, y: 80 + offset * 40 })
    },
    [nodes.length, placeNode],
  )

  const canConnect = useCallback(
    (connection: Connection | Edge) => {
      if (!connection.source || !connection.target || connection.source === connection.target) {
        return false
      }

      const sourceNode = nodes.find(node => node.id === connection.source)
      const targetNode = nodes.find(node => node.id === connection.target)
      if (!sourceNode || !targetNode) {
        return false
      }

      const alreadyLinked = edges.some(
        edge => edge.source === connection.source && edge.target === connection.target,
      )
      if (alreadyLinked) {
        return false
      }

      return isValidConnection(sourceNode.data.kind, targetNode.data.kind)
    },
    [nodes, edges],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!canConnect(connection)) {
        setStatusMessage('Invalid link — triggers → conditions/actions; actions cannot feed triggers')
        return
      }

      setEdges(current =>
        addEdge(
          {
            ...connection,
            id: `${connection.source}-${connection.target}-${Date.now().toString(36)}`,
            ...EDGE_DEFAULTS,
          },
          current,
        ),
      )
      setDirty(true)
      setStatusMessage(null)
    },
    [canConnect, setEdges],
  )

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const id = params.nodes[0]?.id ?? null
    setSelectedId(id)
    if (id) {
      setModalOpen(true)
    }
  }, [])

  const onNodeClick = useCallback((_event: React.MouseEvent, node: SqNode) => {
    setSelectedId(node.id)
    setModalOpen(true)
  }, [])

  const patchSelectedNode = useCallback(
    (patch: Partial<NodeData>) => {
      if (!selectedId) {
        return
      }

      setNodes(current =>
        current.map(node =>
          node.id === selectedId ? { ...node, data: { ...node.data, ...patch } } : node,
        ),
      )
      setDirty(true)
    },
    [selectedId, setNodes],
  )

  const deleteSelectedNode = useCallback(() => {
    if (!selectedId) {
      return
    }

    const id = selectedId
    setNodes(current => current.filter(node => node.id !== id))
    setEdges(current => current.filter(edge => edge.source !== id && edge.target !== id))
    setSelectedId(null)
    setModalOpen(false)
    setDirty(true)
  }, [selectedId, setNodes, setEdges])

  function confirmDiscardIfDirty(): boolean {
    if (!dirty) {
      return true
    }
    return window.confirm('Discard unsaved changes on this canvas?')
  }

  function switchWorkflow(nextId: string) {
    if (nextId === activeId) {
      return
    }
    if (!confirmDiscardIfDirty()) {
      return
    }
    setActiveId(nextId)
    setStatusMessage(null)
  }

  function clearCanvas() {
    if (nodes.length === 0 && edges.length === 0) {
      setStatusMessage('Canvas is already empty')
      return
    }
    if (!window.confirm('Clear this canvas? Nodes and links will be removed (Save to persist).')) {
      return
    }
    setNodes([])
    setEdges([])
    setSelectedId(null)
    setModalOpen(false)
    setDryRunLog(null)
    setDraftPreview(null)
    setDirty(true)
    setStatusMessage('Canvas cleared — Save to keep it empty')
  }

  async function createAutomation() {
    if (!confirmDiscardIfDirty()) {
      return
    }

    setSaving(true)
    setStatusMessage(null)
    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Automation ${workflows.length + 1}`,
          graph: EMPTY_GRAPH,
          enabled: true,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Could not create automation')
      }

      setWorkflows(current => [payload.workflow, ...current])
      setActiveId(payload.workflow.id)
      setDraftName(payload.workflow.name)
      onSaved?.(payload.workflow)
      setStatusMessage('New blank automation — add one trigger, then Save')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  async function deleteAutomation() {
    if (!activeWorkflow) {
      return
    }
    if (workflows.length <= 1) {
      setStatusMessage('Keep at least one automation canvas')
      return
    }
    if (!window.confirm(`Delete “${activeWorkflow.name}”? This cannot be undone.`)) {
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/workflows', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeWorkflow.id }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Delete failed')
      }

      const next = workflows.filter(workflow => workflow.id !== activeWorkflow.id)
      setWorkflows(next)
      setActiveId(next[0]?.id ?? null)
      setStatusMessage('Automation deleted')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  async function saveWorkflow() {
    if (!activeWorkflow) {
      return
    }

    const graph = flowNodesToGraph(nodes, edges)
    const check = validateCanvasGraph(graph)
    if (!check.ok) {
      setStatusMessage(check.reason)
      return
    }

    setSaving(true)
    setStatusMessage(null)

    try {
      const response = await fetch('/api/workflows', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeWorkflow.id,
          graph,
          enabled: activeWorkflow.enabled,
          name: draftName.trim() || activeWorkflow.name,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Save failed')
      }

      setWorkflows(current =>
        current.map(workflow => (workflow.id === payload.workflow.id ? payload.workflow : workflow)),
      )
      setDraftName(payload.workflow.name)
      setDirty(false)
      onSaved?.(payload.workflow)
      setStatusMessage('Automation saved')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function toggleWorkflowEnabled() {
    if (!activeWorkflow) {
      return
    }

    const response = await fetch('/api/workflows', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: activeWorkflow.id, enabled: !activeWorkflow.enabled }),
    })
    const payload = await response.json()
    if (payload.workflow) {
      setWorkflows(current =>
        current.map(workflow => (workflow.id === payload.workflow.id ? payload.workflow : workflow)),
      )
    }
  }

  async function runDryTest(trigger: string) {
    const graph = flowNodesToGraph(nodes, edges)
    const results = await executeWorkflow(graph, {
      lead: SAMPLE_LEAD,
      trigger,
      prevTier: trigger === 'tier_changed' ? 'B' : undefined,
      fieldConfidence: 0.85,
      allowNetwork: false,
      integrations: {
        googleSheetsWebhook: integrations?.googleSheetsWebhook,
        hubspotConnected: integrations?.hubspotEnabled,
      },
    })

    setDryRunLog(
      `[${trigger}]\n${results.map(result => `${result.ok ? '✓' : '·'} ${result.type}: ${result.detail}`).join('\n')}`,
    )

    const draft = results.find(
      result => result.type === 'action_draft_email' && result.ok && result.artifacts,
    )
    if (draft?.artifacts) {
      setDraftPreview({
        from: String(draft.artifacts.from || '(set From on Draft email)'),
        to: String(draft.artifacts.to || ''),
        subject: String(draft.artifacts.subject || ''),
        body: String(draft.artifacts.body || ''),
      })
    } else {
      setDraftPreview(null)
    }
  }

  return (
    <div className="space-y-3">
      <TemplateGallery
        status={templateStatus}
        busyKey={templateBusy}
        onAdd={key => void addTemplate(key)}
        onToggle={(key, enabled) => void toggleTemplate(key, enabled)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--sq-text-muted)]">
            Automation
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-white">
            {draftName || activeWorkflow?.name || 'DealFit automation'}
          </h2>
          <p className="mt-0.5 max-w-xl text-[12px] leading-relaxed text-[var(--sq-text-muted)]">
            Pick a template or build your own. Dry run = preview; live runs send email and sync CRM.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="sq-wf-select"
            aria-label="Active automation"
            value={activeWorkflow?.id || ''}
            onChange={event => switchWorkflow(event.target.value)}
            disabled={!workflows.length}
          >
            {workflows.map(workflow => (
              <option key={workflow.id} value={workflow.id}>
                {workflow.name}
                {workflow.enabled ? '' : ' (off)'}
              </option>
            ))}
          </select>
          <input
            className="sq-wf-name"
            aria-label="Automation name"
            value={draftName}
            onChange={event => {
              setDraftName(event.target.value)
              setDirty(true)
            }}
            placeholder="Automation name"
            disabled={!activeWorkflow}
          />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void createAutomation()}
            disabled={saving}
            title="Create a new blank canvas"
          >
            <Plus className="size-3.5" strokeWidth={1.75} />
            New
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={clearCanvas}
            disabled={!activeWorkflow}
            title="Remove all nodes from this canvas"
          >
            <Eraser className="size-3.5" strokeWidth={1.75} />
            Clear
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void deleteAutomation()}
            disabled={saving || workflows.length <= 1}
            title="Delete this automation"
          >
            <Trash2 className="size-3.5" strokeWidth={1.75} />
            Delete
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void runDryTest('new_lead')}>
            <Play className="size-3.5" strokeWidth={1.75} />
            Test
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void toggleWorkflowEnabled()}
            disabled={!activeWorkflow}
          >
            <Power
              className="size-3.5"
              strokeWidth={1.75}
              style={{ color: activeWorkflow?.enabled ? '#4ade80' : '#71717a' }}
            />
            {activeWorkflow?.enabled ? 'Enabled' : 'Disabled'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void saveWorkflow()}
            disabled={saving || !activeWorkflow}
          >
            <Save className="size-3.5" strokeWidth={1.75} />
            {saving ? 'Saving…' : dirty ? 'Save*' : 'Save'}
          </button>
        </div>
      </div>

      <div className="sq-automate-layout">
        <Palette onClickAdd={addNodeFromPalette} disabledKinds={disabledKinds} />
        <div className="sq-automate-main sq-automate-main--solo">
          <div className="sq-flow-shell panel overflow-hidden">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={markDirtyNodes}
              onEdgesChange={markDirtyEdges}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={onNodeClick}
              isValidConnection={canConnect}
              onSelectionChange={onSelectionChange}
              nodeTypes={flowNodeTypes}
              defaultEdgeOptions={EDGE_DEFAULTS}
              connectionLineType={ConnectionLineType.SmoothStep}
              connectionLineStyle={{ stroke: '#a1a1aa', strokeWidth: 1.5 }}
              connectionRadius={28}
              panOnDrag
              panOnScroll
              zoomOnScroll
              zoomOnPinch
              zoomOnDoubleClick={false}
              preventScrolling
              selectionOnDrag={false}
              selectNodesOnDrag={false}
              selectionMode={SelectionMode.Partial}
              nodesDraggable
              nodesConnectable
              elementsSelectable
              elevateNodesOnSelect
              autoPanOnNodeDrag
              autoPanOnConnect
              snapToGrid
              snapGrid={[8, 8]}
              minZoom={0.25}
              maxZoom={2}
              deleteKeyCode={['Backspace', 'Delete']}
              multiSelectionKeyCode={['Meta', 'Control']}
              proOptions={{ hideAttribution: true }}
              colorMode="dark"
              nodeDragThreshold={0}
              fitView
              fitViewOptions={{ padding: 0.36, maxZoom: 0.85 }}
            >
              <Background variant={BackgroundVariant.Dots} color="#333333" gap={10} size={1.1} />
              <Controls showInteractive={false} className="sq-flow-controls" />
              <MiniMap
                className="sq-flow-minimap"
                nodeColor={node => {
                  const kind = (node.data as NodeData | undefined)?.kind
                  return kind && KIND_META[kind] ? KIND_META[kind].tone : '#3f3f46'
                }}
                maskColor="rgba(0,0,0,0.65)"
                pannable
                zoomable
              />
            </ReactFlow>
          </div>
        </div>
      </div>

      <NodeConfigModal
        open={modalOpen}
        data={selectedNode?.data || null}
        onChange={patchSelectedNode}
        onClose={() => setModalOpen(false)}
        onDelete={deleteSelectedNode}
      />

      {(statusMessage || dryRunLog || draftPreview) && (
        <div className="space-y-2">
          {statusMessage && <p className="text-xs text-[var(--sq-text-muted)]">{statusMessage}</p>}
          {draftPreview && (
            <div className="rounded-[var(--radius)] border border-[var(--sq-border)] bg-[var(--ash-900)] px-3 py-2 text-[12px] text-zinc-300">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--sq-text-muted)]">
                Dry run preview · not sent
              </p>
              <p className="mt-1">
                <span className="text-zinc-500">From</span> {draftPreview.from}
              </p>
              <p>
                <span className="text-zinc-500">To</span> {draftPreview.to || '—'}
              </p>
              <p>
                <span className="text-zinc-500">Subject</span> {draftPreview.subject}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-zinc-200">{draftPreview.body}</p>
            </div>
          )}
          {dryRunLog && (
            <pre className="overflow-x-auto rounded-[var(--radius)] border border-[var(--sq-border)] bg-[var(--ash-900)] px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-300 whitespace-pre-wrap">
              {dryRunLog}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

export function AutomationCanvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
