'use client'

import { X } from 'lucide-react'
import { INTERPOLATION_TOKENS } from '@/lib/interpolate'
import { PIPELINE_STAGES, STAGE_LABELS } from '@/lib/pipeline'
import type { NodeKind } from '@/lib/workflow'

export type NodeData = Record<string, string | number | boolean | undefined> & {
  kind: NodeKind
  label?: string
}

const LABELS: Record<NodeKind, string> = {
  trigger: 'Trigger',
  condition: 'Condition',
  action_draft_email: 'Draft email',
  action_crm_push: 'CRM / Sheets',
  action_http: 'HTTP / Webhook',
  action_weekly_report: 'Weekly report',
  action_enrich: 'Enrich',
  action_move_stage: 'Move stage',
  action_notify: 'Notify',
  action_tag: 'Tag',
}

const TRIGGER_EVENTS = [
  { id: 'new_lead', label: 'New lead ingested' },
  { id: 'field_updated', label: 'After enrich / field update' },
  { id: 'tier_changed', label: 'Tier changed' },
  { id: 'stage_changed', label: 'Stage changed' },
  { id: 'schedule', label: 'On schedule' },
] as const

const CONDITION_FIELDS = [
  { id: 'tier', label: 'Tier', ops: ['eq', 'neq'] },
  { id: 'score', label: 'Score', ops: ['gte', 'lte', 'eq'] },
  { id: 'industry', label: 'Industry', ops: ['contains', 'eq'] },
  { id: 'state', label: 'State', ops: ['eq', 'neq'] },
  { id: 'confidence', label: 'Enrich confidence', ops: ['gte', 'lte'] },
  { id: 'stage', label: 'Pipeline stage', ops: ['eq', 'neq'] },
  { id: 'days_in_stage', label: 'Days in stage', ops: ['gte', 'lte', 'eq'] },
] as const

const OP_LABELS: Record<string, string> = {
  eq: 'equals',
  neq: 'does not equal',
  gte: '≥',
  lte: '≤',
  contains: 'contains',
}

export function NodeConfigModal({
  open,
  data,
  onChange,
  onClose,
  onDelete,
}: {
  open: boolean
  data: NodeData | null
  onChange: (patch: Partial<NodeData>) => void
  onClose: () => void
  onDelete: () => void
}) {
  if (!open || !data) {
    return null
  }
  const kind = data.kind
  const fieldMeta = CONDITION_FIELDS.find(f => f.id === String(data.field || 'tier')) || CONDITION_FIELDS[0]
  const ops = fieldMeta.ops

  return (
    <div className="sq-modal-root" role="dialog" aria-modal="true" aria-label="Node settings">
      <button type="button" className="sq-modal-backdrop" aria-label="Close" onClick={onClose} />
      <div className="sq-modal-panel">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--sq-border)] px-4 py-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--sq-text-muted)]">
              Configure node
            </p>
            <h3 className="text-base font-semibold text-white">{LABELS[kind] || kind}</h3>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose} title="Close">
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="max-h-[min(70vh,560px)] space-y-3 overflow-y-auto px-4 py-3">
          <label className="sq-field">
            <span>Label</span>
            <input
              className="field"
              value={String(data.label || '')}
              onChange={e => onChange({ label: e.target.value })}
            />
          </label>

          {kind === 'trigger' && (
            <>
              <label className="sq-field">
                <span>Fire when</span>
                <select
                  className="field"
                  value={String(data.event || 'new_lead')}
                  onChange={e => {
                    const event = e.target.value
                    const label =
                      TRIGGER_EVENTS.find(t => t.id === event)?.label || 'When lead arrives'
                    onChange({ event, label })
                  }}
                >
                  {TRIGGER_EVENTS.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              {String(data.event) === 'tier_changed' && (
                <label className="sq-field">
                  <span>Target tier</span>
                  <select
                    className="field"
                    value={String(data.tier || 'A')}
                    onChange={e => onChange({ tier: e.target.value })}
                  >
                    {['A', 'B', 'C'].map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {String(data.event) === 'stage_changed' && (
                <label className="sq-field">
                  <span>Target stage (optional)</span>
                  <select
                    className="field"
                    value={String(data.stage || '')}
                    onChange={e => onChange({ stage: e.target.value })}
                  >
                    <option value="">Any stage</option>
                    {PIPELINE_STAGES.map(s => (
                      <option key={s} value={s}>
                        {STAGE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}

          {kind === 'condition' && (
            <>
              <label className="sq-field">
                <span>Field</span>
                <select
                  className="field"
                  value={String(data.field || 'tier')}
                  onChange={e => {
                    const field = e.target.value
                    const meta = CONDITION_FIELDS.find(f => f.id === field) || CONDITION_FIELDS[0]
                    const op = meta.ops[0]
                    const value =
                      field === 'tier'
                        ? 'A'
                        : field === 'score'
                          ? 70
                          : field === 'confidence'
                            ? 0.5
                            : field === 'stage'
                              ? 'contacted'
                              : field === 'days_in_stage'
                                ? 5
                                : ''
                    onChange({
                      field,
                      op,
                      value,
                      label: `If ${meta.label.toLowerCase()} ${OP_LABELS[op]} ${value}`,
                    })
                  }}
                >
                  {CONDITION_FIELDS.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sq-field">
                <span>Operator</span>
                <select
                  className="field"
                  value={ops.includes(String(data.op || '') as never) ? String(data.op) : ops[0]}
                  onChange={e => {
                    const op = e.target.value
                    onChange({
                      op,
                      label: `If ${fieldMeta.label.toLowerCase()} ${OP_LABELS[op]} ${data.value ?? ''}`,
                    })
                  }}
                >
                  {ops.map(op => (
                    <option key={op} value={op}>
                      {OP_LABELS[op]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sq-field">
                <span>Value</span>
                {String(data.field) === 'tier' ? (
                  <select
                    className="field"
                    value={String(data.value || 'A')}
                    onChange={e =>
                      onChange({
                        value: e.target.value,
                        label: `If tier ${OP_LABELS[String(data.op || 'eq')]} ${e.target.value}`,
                      })
                    }
                  >
                    {['A', 'B', 'C'].map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                ) : String(data.field) === 'stage' ? (
                  <select
                    className="field"
                    value={String(data.value || 'contacted')}
                    onChange={e =>
                      onChange({
                        value: e.target.value,
                        label: `If stage ${OP_LABELS[String(data.op || 'eq')]} ${e.target.value}`,
                      })
                    }
                  >
                    {PIPELINE_STAGES.map(s => (
                      <option key={s} value={s}>
                        {STAGE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="field"
                    type={
                      ['score', 'confidence', 'days_in_stage'].includes(String(data.field))
                        ? 'number'
                        : 'text'
                    }
                    step={String(data.field) === 'confidence' ? 0.05 : 1}
                    value={String(data.value ?? '')}
                    onChange={e => {
                      const value = ['score', 'confidence', 'days_in_stage'].includes(
                        String(data.field),
                      )
                        ? Number(e.target.value)
                        : e.target.value
                      onChange({
                        value,
                        label: `If ${fieldMeta.label.toLowerCase()} ${OP_LABELS[String(data.op || 'eq')]} ${e.target.value}`,
                      })
                    }}
                  />
                )}
              </label>
            </>
          )}

          {kind === 'action_draft_email' && (
            <>
              <label className="sq-field">
                <span>From (draft only — never sent)</span>
                <input
                  className="field"
                  type="email"
                  value={String(data.fromEmail || '')}
                  onChange={e => onChange({ fromEmail: e.target.value })}
                />
              </label>
              <label className="sq-field">
                <span>Subject</span>
                <input
                  className="field"
                  value={String(data.subject || '')}
                  onChange={e => onChange({ subject: e.target.value })}
                />
              </label>
              <label className="sq-field">
                <span>Body template</span>
                <textarea
                  className="field min-h-[100px] resize-y"
                  value={String(data.template || '')}
                  onChange={e => onChange({ template: e.target.value })}
                />
              </label>
            </>
          )}

          {kind === 'action_crm_push' && (
            <>
              <p className="text-[12px] text-[var(--sq-text-secondary)]">
                Builds a HubSpot-shaped CRM row. Optional: paste a webhook, or use{' '}
                <strong className="text-white">Connect → Google Sheets</strong> to append the same row.
              </p>
              <label className="sq-field">
                <span>Optional webhook URL</span>
                <input
                  className="field"
                  value={String(data.webhook || '')}
                  onChange={e => onChange({ webhook: e.target.value })}
                  placeholder="https://hooks.zapier.com/… (or leave empty for Connect)"
                />
              </label>
            </>
          )}

          {kind === 'action_http' && (
            <>
              <p className="text-[12px] text-[var(--sq-text-secondary)]">
                Two outputs on the canvas: <strong className="text-white">2xx</strong> (success) and{' '}
                <strong className="text-white">fail</strong> (4xx/5xx/error) — wire different next steps.
              </p>
              <label className="sq-field">
                <span>Method</span>
                <select
                  className="field"
                  value={String(data.method || 'POST')}
                  onChange={e => onChange({ method: e.target.value })}
                >
                  {['GET', 'POST', 'PUT', 'PATCH'].map(m => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sq-field">
                <span>URL</span>
                <input
                  className="field"
                  value={String(data.url || '')}
                  onChange={e => onChange({ url: e.target.value })}
                  placeholder="https://hooks.zapier.com/hooks/catch/…"
                />
              </label>
              <label className="sq-field">
                <span>Headers (JSON)</span>
                <textarea
                  className="field min-h-[56px] resize-y font-mono text-[12px]"
                  value={String(data.headers || '')}
                  onChange={e => onChange({ headers: e.target.value })}
                />
              </label>
              <label className="sq-field">
                <span>Body (JSON — supports {'{{tokens}}'})</span>
                <textarea
                  className="field min-h-[88px] resize-y font-mono text-[12px]"
                  value={String(data.body || '')}
                  onChange={e => onChange({ body: e.target.value })}
                />
              </label>
            </>
          )}

          {kind === 'action_weekly_report' && (
            <p className="text-[12px] text-[var(--sq-text-secondary)]">
              Queues this lead on the Funnel report for the digest export.
            </p>
          )}

          {kind === 'action_enrich' && (
            <p className="text-[12px] text-[var(--sq-text-secondary)]">
              Ethically enriches the lead (demo for .example domains). Sets confidence for the next
              condition and moves New → Enriched.
            </p>
          )}

          {kind === 'action_move_stage' && (
            <label className="sq-field">
              <span>Move to stage</span>
              <select
                className="field"
                value={String(data.stage || 'contacted')}
                onChange={e => onChange({ stage: e.target.value, label: `Move to ${STAGE_LABELS[e.target.value as keyof typeof STAGE_LABELS] || e.target.value}` })}
              >
                {PIPELINE_STAGES.map(s => (
                  <option key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          )}

          {kind === 'action_notify' && (
            <label className="sq-field">
              <span>In-app message (never emailed)</span>
              <input
                className="field"
                value={String(data.message || '')}
                onChange={e => onChange({ message: e.target.value })}
              />
            </label>
          )}

          {kind === 'action_tag' && (
            <label className="sq-field">
              <span>Tag</span>
              <input
                className="field"
                value={String(data.tag || '')}
                onChange={e => onChange({ tag: e.target.value })}
              />
            </label>
          )}

          {String(kind).startsWith('action_') && (
            <div className="rounded-[var(--radius-sm)] border border-[var(--sq-border)] bg-[var(--ash-900)] p-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--sq-text-muted)]">
                Upstream tokens
              </p>
              <p className="mt-1 text-[12px] text-[var(--sq-text-secondary)]">
                Click to copy · fills from the lead that fired this workflow.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {INTERPOLATION_TOKENS.map(t => (
                  <button
                    key={t.token}
                    type="button"
                    className="rounded-md border border-[var(--sq-border)] bg-[var(--ash-850)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ash-300)] hover:border-[var(--sq-border-strong)] hover:text-white"
                    title={t.desc}
                    onClick={() => {
                      void navigator.clipboard?.writeText(t.token)
                    }}
                  >
                    {t.token}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--sq-border)] px-4 py-3">
          <button type="button" className="btn btn-ghost text-sq-danger" onClick={onDelete}>
            Delete node
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
