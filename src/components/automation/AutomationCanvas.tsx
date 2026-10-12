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
import { Play, Power, Save } from 'lucide-react'
import {
  DEFAULT_GRAPH,
  defaultDataFor,
  executeWorkflow,
  isNodeKind,
  isValidConnection,
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

export type WorkflowRecord = {
  id: string
  name: string
  enabled: boolean
  graph: WorkflowGraph
}

type CanvasProps = {
  onSaved?: (workflow: WorkflowRecord) => void
  integrations?: ClientIntegrations
}

function CanvasInner({ onSaved, integrations }: CanvasProps) {
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
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

  const hasFittedView = useRef(false)
  const { fitView, screenToFlowPosition } = useReactFlow()

  const activeWorkflow = useMemo(
    () => workflows.find(workflow => workflow.id === activeId) || workflows[0],
    [workflows, activeId],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState<SqNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  useEffect(() => {
    void (async () => {
      const response = await fetch('/api/workflows')
      const payload = await response.json()
      const list = (payload.workflows || []) as WorkflowRecord[]
      setWorkflows(list)
      if (list[0]) {
        setActiveId(list[0].id)
      }
    })()
  }, [])

  useEffect(() => {
    if (!activeWorkflow) {
      return
    }

    const flow = graphToFlowNodes(activeWorkflow.graph || DEFAULT_GRAPH)
    setNodes(flow.nodes)
    setEdges(flow.edges)
    setSelectedId(null)
    setModalOpen(false)
    setDryRunLog(null)
    setDraftPreview(null)
    hasFittedView.current = false

    const frame = requestAnimationFrame(() => {
      if (!hasFittedView.current) {
        fitView({ padding: 0.36, duration: 280, maxZoom: 0.85 })
        hasFittedView.current = true
      }
    })

    return () => cancelAnimationFrame(frame)
    // Reload graph only when switching workflows — not on every node edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkflow?.id])

  const selectedNode = useMemo(
    () => nodes.find(node => node.id === selectedId) || null,
    [nodes, selectedId],
  )

  const placeNode = useCallback(
    (kind: NodeKind, position: { x: number; y: number }) => {
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
      setStatusMessage(`Added ${KIND_META[kind].label}`)
    },
    [setNodes],
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
  }, [selectedId, setNodes, setEdges])

  async function saveWorkflow() {
    if (!activeWorkflow) {
      return
    }

    setSaving(true)
    setStatusMessage(null)

    try {
      const graph = flowNodesToGraph(nodes, edges)
      const response = await fetch('/api/workflows', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeWorkflow.id,
          graph,
          enabled: activeWorkflow.enabled,
          name: activeWorkflow.name,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Save failed')
      }

      setWorkflows(current =>
        current.map(workflow => (workflow.id === payload.workflow.id ? payload.workflow : workflow)),
      )
      onSaved?.(payload.workflow)
      setStatusMessage('Workflow saved')
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--sq-text-muted)]">
            Automation
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-white">
            {activeWorkflow?.name || 'Deal-sourcing autopilot'}
          </h2>
          <p className="mt-0.5 max-w-xl text-[12px] leading-relaxed text-[var(--sq-text-muted)]">
            When a scored lead lands, gate on ICP fit, draft outreach (never sent), push a CRM/Sheets
            row, branch HTTP on 2xx vs fail, and queue the weekly pulse — click any node to edit.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="sq-automate-layout">
        <Palette onClickAdd={addNodeFromPalette} />
        <div className="sq-automate-main sq-automate-main--solo">
          <div className="sq-flow-shell panel overflow-hidden">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
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
                Draft preview · not sent
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
