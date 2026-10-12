'use client'

import type { DragEvent, KeyboardEvent } from 'react'
import { PALETTE_KINDS, type NodeKind } from '@/lib/workflow'
import { DND_MIME, KIND_META } from '@/components/automation/kinds'

type PaletteProps = {
  onClickAdd: (kind: NodeKind) => void
}

export function Palette({ onClickAdd }: PaletteProps) {
  function onDragStart(event: DragEvent, kind: NodeKind) {
    event.dataTransfer.setData(DND_MIME, kind)
    event.dataTransfer.setData('text/plain', kind)
    event.dataTransfer.effectAllowed = 'copy'
  }

  function onCardKeyDown(event: KeyboardEvent, kind: NodeKind) {
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

          return (
            <div
              key={kind}
              role="button"
              tabIndex={0}
              className="sq-palette-card"
              draggable
              style={{ borderColor: `${meta.tone}55` }}
              onDragStart={event => onDragStart(event, kind)}
              onClick={() => onClickAdd(kind)}
              onKeyDown={event => onCardKeyDown(event, kind)}
              title={`Drag ${meta.label}`}
            >
              <span
                className="sq-palette-card-icon"
                style={{ background: `${meta.tone}22`, color: meta.tone }}
              >
                <Icon size={18} strokeWidth={1.75} />
              </span>
              <span className="sq-palette-card-label">{meta.label}</span>
              <span className="sq-palette-card-group">{meta.group}</span>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
