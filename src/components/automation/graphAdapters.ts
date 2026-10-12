/**
 * Convert between React Flow state and our persisted WorkflowGraph shape.
 */
import type { Edge, Node } from '@xyflow/react'
import {
  DEFAULT_GRAPH,
  defaultDataFor,
  isNodeKind,
  sanitizeGraph,
  type WorkflowGraph,
} from '@/lib/workflow'
import type { NodeData } from '@/components/NodeConfigModal'
import { EDGE_DEFAULTS, KIND_META } from '@/components/automation/kinds'

export type SqNode = Node<NodeData, 'sqNode'>

export function graphToFlowNodes(graph: WorkflowGraph | null | undefined): {
  nodes: SqNode[]
  edges: Edge[]
} {
  const clean = sanitizeGraph(graph || DEFAULT_GRAPH)

  return {
    nodes: clean.nodes.map(node => ({
      id: node.id,
      type: 'sqNode' as const,
      position: node.position,
      draggable: true,
      selectable: true,
      data: {
        ...defaultDataFor(node.type),
        ...node.data,
        kind: node.type,
        label: String(node.data.label || KIND_META[node.type].label),
      },
    })),
    edges: clean.edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || undefined,
      ...EDGE_DEFAULTS,
    })),
  }
}

export function flowNodesToGraph(nodes: SqNode[], edges: Edge[]): WorkflowGraph {
  return sanitizeGraph({
    nodes: nodes
      .filter(node => isNodeKind(node.data?.kind))
      .map(node => {
        const { kind, ...rest } = node.data
        return {
          id: node.id,
          type: kind,
          position: node.position,
          data: rest,
        }
      }),
    edges: edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || null,
    })),
  })
}
