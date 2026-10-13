'use client'

import type { DragEvent, KeyboardEvent } from 'react'
import { PALETTE_KINDS, type NodeKind } from '@/lib/workflow'
import { DND_MIME, KIND_META } from '@/components/automation/kinds'

type PaletteProps = {
  onClickAdd: (kind: NodeKind) => void
  /** Kinds that cannot be added (e.g. trigger when one already exists). */
  disabledKinds?: Partial<Record<NodeKind, string>>
}

export function Palette({ onClickAdd, disabledKinds }: PaletteProps) {
  function onDragStart(event: DragEvent, kind: NodeKind) {
    if (disabledKinds?.[kind]) {
      event.preventDefault()
      return
    }
    event.dataTransfer.setData(DND_MIME, kind)
    event.dataTransfer.setData('text/plain', kind)
    event.dataTransfer.effectAllowed = 'copy'
  }

  function onCardKeyDown(event: KeyboardEvent, kind: NodeKind) {
    if (disabledKinds?.[kind]) {
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClickAdd(kind)
    }
  }

  return (
    <aside className="sq-palette" aria-label="Node blocks">
      <p className="sq-palette-hint">Drag onto canvas</p>
      <div className="sq-palette-grid">
        {PALETTE_KINDS.map(kind => {
          const meta = KIND_META[kind]
          const Icon = meta.Icon
          const disabledReason = disabledKinds?.[kind]
          const disabled = Boolean(disabledReason)

          return (
            <div
              key={kind}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-disabled={disabled}
              className={`sq-palette-card${disabled ? ' sq-palette-card--disabled' : ''}`}
              draggable={!disabled}
              style={{ borderColor: disabled ? undefined : `${meta.tone}55` }}
              onDragStart={event => onDragStart(event, kind)}
              onClick={() => {
                if (!disabled) {
                  onClickAdd(kind)
                }
              }}
              onKeyDown={event => onCardKeyDown(event, kind)}
              title={disabledReason || `Drag ${meta.label}`}
            >
              <span
                className="sq-palette-card-icon"
                style={{
                  background: disabled ? 'rgba(63,63,70,0.5)' : `${meta.tone}22`,
                  color: disabled ? '#71717a' : meta.tone,
                }}
              >
                <Icon size={18} strokeWidth={1.75} />
              </span>
              <span className="sq-palette-card-label">{meta.label}</span>
              <span className="sq-palette-card-group">
                {disabled ? 'limit 1' : meta.group}
              </span>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
