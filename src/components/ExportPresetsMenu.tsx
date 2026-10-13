'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import Papa from 'papaparse'
import {
  EXPORT_PRESETS,
  mapLeadsToPreset,
  previewMapping,
  type ExportPresetId,
} from '@/lib/exportPresets'
import type { ScoredLead } from '@/lib/scoring'

function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  const blob = new Blob([Papa.unparse(rows)], { type: 'text/csv' })
  const anchor = document.createElement('a')
  anchor.href = URL.createObjectURL(blob)
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(anchor.href)
}

export function ExportPresetsMenu({
  leads,
  disabled,
  label = 'Export',
}: {
  leads: ScoredLead[]
  disabled?: boolean
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [previewId, setPreviewId] = useState<ExportPresetId | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setPreviewId(null)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const preview = previewId ? previewMapping(leads, previewId, 3) : null
  const clean = leads.filter(l => !l.junk && !l.duplicateOf)

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={disabled || clean.length === 0}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <Download className="size-3.5" strokeWidth={1.75} />
        {label}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-[var(--radius)] border border-[var(--sq-border)] bg-[var(--ash-850)] shadow-xl shadow-black/40">
          <div className="border-b border-[var(--sq-border)] px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--sq-text-muted)]">
              Export presets
            </p>
            <p className="text-[12px] text-[var(--sq-text-secondary)]">
              {clean.length} lead{clean.length === 1 ? '' : 's'} · preview mapping first
            </p>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {EXPORT_PRESETS.map(p => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors duration-150 hover:bg-white/[0.04]"
                  onClick={() => setPreviewId(p.id)}
                >
                  <span
                    className="icon-well icon-well-sm mt-0.5"
                    style={{ background: 'rgba(52, 211, 153, 0.14)', color: '#34d399' }}
                  >
                    <FileSpreadsheet strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-white">{p.label}</span>
                    <span className="block text-[11px] text-[var(--sq-text-muted)]">{p.description}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {preview && (
            <div className="border-t border-[var(--sq-border)] bg-[var(--ash-900)] px-3 py-3">
              <p className="mb-2 text-[12px] font-semibold text-white">
                {preview.preset.label} mapping
              </p>
              <div className="mb-3 max-h-36 overflow-auto rounded-[var(--radius-xs)] border border-[var(--sq-border)]">
                <table className="w-full text-left text-[10px]">
                  <thead>
                    <tr className="border-b border-[var(--sq-border)] text-[var(--sq-text-muted)]">
                      {preview.headers.slice(0, 5).map(h => (
                        <th key={h} className="px-2 py-1 font-medium">
                          {h}
                        </th>
                      ))}
                      {preview.headers.length > 5 && (
                        <th className="px-2 py-1">+{preview.headers.length - 5}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="border-b border-[var(--sq-border)] last:border-0">
                        {preview.headers.slice(0, 5).map(h => (
                          <td key={h} className="max-w-[5rem] truncate px-2 py-1 text-[var(--sq-text-secondary)]">
                            {String(row[h] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {!preview.rows.length && (
                      <tr>
                        <td className="px-2 py-3 text-[var(--sq-text-muted)]" colSpan={6}>
                          No clean leads to preview.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-ghost" onClick={() => setPreviewId(null)}>
                  Back
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const rows = mapLeadsToPreset(leads, preview.preset.id)
                    downloadCsv(`${preview.preset.id}_export.csv`, rows)
                    setOpen(false)
                    setPreviewId(null)
                  }}
                >
                  Download CSV
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
