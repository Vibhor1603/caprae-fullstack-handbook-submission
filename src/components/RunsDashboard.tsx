'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, RotateCcw } from 'lucide-react'
import { SlidingSeg } from '@/components/SlidingSeg'

type Run = {
  id: string
  status: string
  trigger: string
  leadLabel: string | null
  workflowName: string
  createdAt: string
  finishedAt: string | null
  error: string | null
  nodeResults: { nodeId: string; type: string; ok: boolean; detail: string }[]
}

export function RunsDashboard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [runs, setRuns] = useState<Run[]>([])
  const [filter, setFilter] = useState<'all' | 'done' | 'pending' | 'failed'>('all')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const r = await fetch(`/api/runs?status=${filter}`)
      const j = await r.json()
      setRuns(j.runs || [])
    } finally {
      setBusy(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 4000)
    return () => clearInterval(t)
  }, [load, refreshKey])

  async function retry(id: string) {
    await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'retry', id }),
    })
    void load()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--sq-text-muted)]">
            Automation dashboard
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-white">Workflow runs</h2>
        </div>
        <div className="flex items-center gap-2">
          <SlidingSeg
            role="group"
            aria-label="Run status"
            value={filter}
            onChange={setFilter}
            items={[
              { id: 'all', label: 'all' },
              { id: 'done', label: 'done' },
              { id: 'pending', label: 'pending' },
              { id: 'failed', label: 'failed' },
            ]}
          />
          <button type="button" className="btn btn-ghost" onClick={() => void load()} disabled={busy}>
            <RefreshCw className={`size-3.5 ${busy ? 'animate-spin' : ''}`} strokeWidth={1.75} />
            Refresh
          </button>
        </div>
      </div>

      <div key={filter} className="lead-sheet tab-view-fast">
        {busy && runs.length === 0 && (
          <p className="px-5 py-12 text-center text-sm text-[var(--sq-text-muted)]">Loading runs…</p>
        )}
        {!busy && runs.length === 0 && (
          <p className="px-5 py-12 text-center text-sm text-[var(--sq-text-muted)]">
            No runs yet — ingest leads or fire a workflow from the Leads tab.
          </p>
        )}
        {runs.map(run => (
          <div key={run.id} className="border-b border-[var(--sq-border)] px-5 py-4 last:border-b-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusDot status={run.status} />
                  <p className="font-semibold text-white">{run.leadLabel || '—'}</p>
                  <span className="text-[11px] text-[var(--sq-text-muted)]">{run.workflowName}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--sq-text-secondary)]">
                  {run.trigger} · {new Date(run.createdAt).toLocaleString()}
                  {run.error ? ` · ${run.error}` : ''}
                </p>
              </div>
              {run.status === 'failed' && (
                <button type="button" className="btn btn-ghost" onClick={() => void retry(run.id)}>
                  <RotateCcw className="size-3.5" strokeWidth={1.75} />
                  Retry
                </button>
              )}
            </div>
            {run.nodeResults?.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {run.nodeResults.map((n, i) => (
                  <li
                    key={`${run.id}-${n.nodeId}-${i}`}
                    className={`text-[12px] font-medium ${n.ok ? 'text-[var(--ok)]' : 'text-[var(--sq-text-muted)]'}`}
                  >
                    {n.type.replace(/_/g, ' ')} — {n.detail}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'done' ? '#22c55e' : status === 'failed' ? '#ef4444' : status === 'pending' ? '#eab308' : '#a1a1aa'
  return (
    <span
      className="inline-block size-2 rounded-full"
      style={{ background: color }}
      title={status}
      aria-label={status}
    />
  )
}
