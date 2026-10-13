'use client'

import { PIPELINE_STAGES, STAGE_LABELS, type PipelineStage } from '@/lib/pipeline'

const TONE: Record<PipelineStage, string> = {
  new: '#94a3b8',
  enriched: '#a78bfa',
  contacted: '#60a5fa',
  replied: '#34d399',
  owner_call: '#fbbf24',
  loi: '#f472b6',
  closed: '#22c55e',
  lost: '#f43f5e',
}

export function StageBadge({ stage }: { stage?: string | null }) {
  const s = (stage && stage in STAGE_LABELS ? stage : 'new') as PipelineStage
  const color = TONE[s]
  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
      style={{ background: `${color}22`, color }}
    >
      {STAGE_LABELS[s]}
    </span>
  )
}

export function StageSelect({
  value,
  onChange,
  disabled,
  compact,
}: {
  value?: string | null
  onChange: (stage: PipelineStage) => void
  disabled?: boolean
  compact?: boolean
}) {
  const current = (value && value in STAGE_LABELS ? value : 'new') as PipelineStage
  return (
    <select
      className={compact ? 'field !py-1 !px-2 !text-[11px] !w-auto min-w-[7.5rem]' : 'field'}
      value={current}
      disabled={disabled}
      aria-label="Pipeline stage"
      onClick={e => e.stopPropagation()}
      onChange={e => onChange(e.target.value as PipelineStage)}
    >
      {PIPELINE_STAGES.map(s => (
        <option key={s} value={s}>
          {STAGE_LABELS[s]}
        </option>
      ))}
    </select>
  )
}
