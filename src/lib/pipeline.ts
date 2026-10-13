/**
 * Pipeline stages for ETA / search-fund deal sourcing.
 * Stages are the single source of truth for funnel math and workflow moves.
 */

export const PIPELINE_STAGES = [
  'new',
  'enriched',
  'contacted',
  'replied',
  'owner_call',
  'loi',
  'closed',
  'lost',
] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]

export const STAGE_LABELS: Record<PipelineStage, string> = {
  new: 'New',
  enriched: 'Researched',
  contacted: 'Contacted',
  replied: 'Replied',
  owner_call: 'Call booked',
  loi: 'LOI',
  closed: 'Closed',
  lost: 'Lost',
}

/** Funnel spine used in reports (excludes closed/lost). */
export const FUNNEL_STAGES: PipelineStage[] = [
  'new',
  'enriched',
  'contacted',
  'replied',
  'owner_call',
  'loi',
]

export function isPipelineStage(value: unknown): value is PipelineStage {
  return typeof value === 'string' && (PIPELINE_STAGES as readonly string[]).includes(value)
}

export function stageLabel(stage: PipelineStage | string | undefined | null): string {
  if (stage && isPipelineStage(stage)) {
    return STAGE_LABELS[stage]
  }
  return STAGE_LABELS.new
}

/** Demo allows any manual jump; still returns a typed stage. */
export function assertStageTransition(
  _from: PipelineStage | string | undefined | null,
  to: string,
): { ok: true; stage: PipelineStage } | { ok: false; reason: string } {
  if (!isPipelineStage(to)) {
    return { ok: false, reason: `Unknown stage: ${to}` }
  }
  return { ok: true, stage: to }
}

export type StageChangeResult = {
  stage: PipelineStage
  previousStage: PipelineStage
  stageChangedAt: string
  activity: {
    kind: 'stage_change'
    summary: string
    payload: { from: PipelineStage; to: PipelineStage; source: 'manual' | 'workflow' }
  }
}

export function applyStageChange(
  current: PipelineStage | string | undefined | null,
  to: string,
  source: 'manual' | 'workflow',
  now = new Date(),
): StageChangeResult | { ok: false; reason: string } {
  const check = assertStageTransition(current, to)
  if (!check.ok) {
    return check
  }
  const previous = isPipelineStage(current) ? current : 'new'
  return {
    stage: check.stage,
    previousStage: previous,
    stageChangedAt: now.toISOString(),
    activity: {
      kind: 'stage_change',
      summary: `${STAGE_LABELS[previous]} → ${STAGE_LABELS[check.stage]} (${source})`,
      payload: { from: previous, to: check.stage, source },
    },
  }
}

export function daysInStage(
  stageChangedAt: string | Date | null | undefined,
  now = new Date(),
): number {
  if (!stageChangedAt) {
    return 0
  }
  const then = typeof stageChangedAt === 'string' ? new Date(stageChangedAt) : stageChangedAt
  if (Number.isNaN(then.getTime())) {
    return 0
  }
  const ms = now.getTime() - then.getTime()
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)))
}
