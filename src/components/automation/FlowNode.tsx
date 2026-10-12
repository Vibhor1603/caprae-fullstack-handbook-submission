'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Zap } from 'lucide-react'
import { hasBranchOutputs } from '@/lib/workflow'
import { KIND_META, subtitleForNode } from '@/components/automation/kinds'
import type { SqNode } from '@/components/automation/graphAdapters'

const FALLBACK_META = {
  label: 'Node',
  tone: '#a1a1aa',
  group: 'action' as const,
  Icon: Zap,
}

export const FlowNode = memo(function FlowNode({ data, selected }: NodeProps<SqNode>) {
  const meta = KIND_META[data.kind] || FALLBACK_META
  const Icon = meta.Icon
  const isTrigger = meta.group === 'trigger'
  const hasBranches = hasBranchOutputs(data.kind)
  const subtitle = subtitleForNode(data)

  return (
    <div
      className={`sq-flow-node ${selected ? 'is-selected' : ''} ${hasBranches ? 'sq-flow-node--branch' : ''}`}
      style={{ borderColor: selected ? meta.tone : `${meta.tone}66` }}
    >
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Left}
          className="sq-handle"
          style={{ background: meta.tone }}
        />
      )}

      <div className="sq-flow-node-head">
        <span className="sq-flow-icon" style={{ background: `${meta.tone}22`, color: meta.tone }}>
          <Icon size={14} strokeWidth={1.75} />
        </span>
        <p className="sq-flow-group" style={{ color: meta.tone }}>
          {meta.group}
        </p>
      </div>

      <p className="sq-flow-title">{String(data.label || meta.label)}</p>
      {subtitle ? <p className="sq-flow-sub">{subtitle}</p> : null}

      {hasBranches ? (
        <>
          <p className="sq-flow-branch-hint">
            <span className="ok">2xx</span>
            <span className="fail">fail</span>
          </p>
          <Handle
            type="source"
            id="ok"
            position={Position.Right}
            className="sq-handle sq-handle-ok"
            style={{ top: '42%', background: '#22c55e' }}
            title="Success (2xx)"
          />
          <Handle
            type="source"
            id="fail"
            position={Position.Right}
            className="sq-handle sq-handle-fail"
            style={{ top: '72%', background: '#f43f5e' }}
            title="Failure (4xx/5xx/error)"
          />
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className="sq-handle"
          style={{ background: meta.tone }}
        />
      )}
    </div>
  )
})

export const flowNodeTypes = { sqNode: FlowNode }
