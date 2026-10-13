'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type DragEvent } from 'react'
import { FileUp, Sparkles, Upload } from 'lucide-react'
import Papa from 'papaparse'
import {
  DEFAULT_ICP,
  rescore,
  summarize,
  triage,
  type Icp,
  type ScoredLead,
} from '@/lib/scoring'
import type { EnrichmentSnapshot as EnrichSnap } from '@/lib/enrichment'
import { applySharedFilters, DEFAULT_FILTERS, type SharedFilters } from '@/lib/filters'
import { loadSession, saveSession, type AppTab } from '@/lib/sessionStore'
import { withProfiles, type LeadActivityItem } from '@/lib/profile'
import type { PipelineStage } from '@/lib/pipeline'
import { assignDemoStages } from '@/lib/demoSeed'
import { IcpPanel } from '@/components/IcpPanel'
import { SummaryCards } from '@/components/SummaryCards'
import { LeadCard } from '@/components/LeadCard'
import { RunsDashboard } from '@/components/RunsDashboard'
import { FunnelReport } from '@/components/FunnelReport'
import { TodayBoard, type DraftLite, type RunLite } from '@/components/TodayBoard'
import { SharedFilterBar } from '@/components/SharedFilterBar'
import { ExportPresetsMenu } from '@/components/ExportPresetsMenu'
import {
  IntegrationsMenu,
  loadIntegrations,
  type ClientIntegrations,
} from '@/components/IntegrationsMenu'
import { SlidingSeg } from '@/components/SlidingSeg'

const AutomationCanvas = dynamic(
  () => import('@/components/AutomationCanvas').then(module => module.AutomationCanvas),
  {
    ssr: false,
    loading: () => <p className="text-sm text-[var(--sq-text-muted)]">Loading canvas…</p>,
  },
)

const MAX_AUTOPILOT_A_TIERS = 8

function cloneIcp(icp: Icp = DEFAULT_ICP): Icp {
  return {
    ...icp,
    industries: [...icp.industries],
    countries: [...icp.countries],
    employees: [...icp.employees],
    revenueUsd: [...icp.revenueUsd],
    decisionMakerTitles: [...icp.decisionMakerTitles],
  }
}

function parseCsvRows(text: string) {
  return Papa.parse(text, { header: true, skipEmptyLines: true })
}

function isCsvFile(file: File): boolean {
  const nameOk = file.name.toLowerCase().endsWith('.csv')
  const typeOk = !file.type || file.type.includes('csv')
  return nameOk || typeOk
}

function mergeLeadPatch(lead: ScoredLead, patch: Partial<ScoredLead> | undefined): ScoredLead {
  if (!patch) {
    return lead
  }
  return {
    ...lead,
    ...patch,
    lead: patch.lead ? { ...lead.lead, ...patch.lead } : lead.lead,
    tags: patch.tags || lead.tags,
    profile: patch.profile || lead.profile,
  }
}

export default function Home() {
  const [rawLeads, setRawLeads] = useState<ScoredLead[]>([])
  const [enrichments, setEnrichments] = useState<Record<string, EnrichSnap>>({})
  const [activities, setActivities] = useState<Record<string, LeadActivityItem[]>>({})
  const [icp, setIcp] = useState<Icp>(() => cloneIcp())
  const [filters, setFilters] = useState<SharedFilters>({ ...DEFAULT_FILTERS })
  const [openId, setOpenId] = useState<string | null>(null)
  const [tab, setTab] = useState<AppTab>('today')
  const [err, setErr] = useState<string | null>(null)
  const [warn, setWarn] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [enrichingId, setEnrichingId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [runTick, setRunTick] = useState(0)
  const [sampleBusy, setSampleBusy] = useState(false)
  const [todayRuns, setTodayRuns] = useState<RunLite[]>([])
  const [todayDrafts, setTodayDrafts] = useState<DraftLite[]>([])
  const [integrations, setIntegrations] = useState<ClientIntegrations>({
    googleSheetsWebhook: '',
    hubspotEnabled: false,
  })
  const [pending, startTransition] = useTransition()
  const [sessionReady, setSessionReady] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const scheduleFired = useRef(false)

  useEffect(() => {
    setIntegrations(loadIntegrations())
    const snapshot = loadSession()
    if (snapshot) {
      if (snapshot.rawLeads.length) {
        setRawLeads(snapshot.rawLeads)
      }
      if (snapshot.enrichments && Object.keys(snapshot.enrichments).length) {
        setEnrichments(snapshot.enrichments as Record<string, EnrichSnap>)
      }
      if (snapshot.activities) {
        setActivities(snapshot.activities)
      }
      if (snapshot.icp && Array.isArray(snapshot.icp.industries)) {
        setIcp(cloneIcp(snapshot.icp))
      }
      setFilters(snapshot.filters || { ...DEFAULT_FILTERS })
      setTab(snapshot.tab || 'today')
      setOpenId(snapshot.openId || snapshot.profileId)
    }
    setSessionReady(true)
  }, [])

  useEffect(() => {
    if (!sessionReady) {
      return
    }
    saveSession({
      rawLeads,
      enrichments,
      activities,
      icp,
      filters,
      tab,
      openId,
      profileId: null,
    })
  }, [sessionReady, rawLeads, enrichments, activities, icp, filters, tab, openId])

  const leads = useMemo(() => {
    if (!rawLeads.length) {
      return []
    }
    return withProfiles(rescore(rawLeads, icp))
  }, [rawLeads, icp])

  const summary = useMemo(() => summarize(leads), [leads])
  const visible = useMemo(
    () => applySharedFilters(leads, filters, enrichments),
    [leads, filters, enrichments],
  )

  const refreshTodayFeeds = useCallback(async () => {
    try {
      const [runsRes, reportRes] = await Promise.all([
        fetch('/api/runs'),
        fetch('/api/report'),
      ])
      if (runsRes.ok) {
        const data = await runsRes.json()
        setTodayRuns(
          (data.runs || []).slice(0, 40).map((r: RunLite & { workflowName?: string }) => ({
            id: r.id,
            status: r.status,
            trigger: r.trigger,
            leadLabel: r.leadLabel,
            workflowName: r.workflowName,
            createdAt: r.createdAt,
          })),
        )
      }
      if (reportRes.ok) {
        const data = await reportRes.json()
        const drafts: DraftLite[] = (data.events || [])
          .filter((e: { kind: string }) =>
            ['email_draft', 'crm_push', 'notify'].includes(e.kind),
          )
          .slice(0, 20)
          .map((e: { id: string; kind: string; summary: string; payload?: { subject?: string } }) => ({
            id: e.id,
            company: e.summary,
            subject: e.payload?.subject,
            kind: e.kind as DraftLite['kind'],
          }))
        setTodayDrafts(drafts)
      }
    } catch {
      // Today still works from local lead state.
    }
  }, [])

  useEffect(() => {
    void refreshTodayFeeds()
  }, [runTick, refreshTodayFeeds])

  function resetLeadListUi() {
    setFilters({ ...DEFAULT_FILTERS })
    setOpenId(null)
  }

  function applyTriagedLeads(scored: ScoredLead[], demo = false) {
    const withStage = demo ? assignDemoStages(withProfiles(scored)) : withProfiles(scored)
    startTransition(() => setRawLeads(withStage))
    resetLeadListUi()
  }

  function triageCsvLocally(text: string, demo = false): boolean {
    const { data, errors } = parseCsvRows(text)
    if (errors.length && !data.length) {
      setErr(errors[0].message)
      return false
    }
    applyTriagedLeads(triage(data as Parameters<typeof triage>[0], icp), demo)
    return true
  }

  async function runWorkflowsForLead(
    scored: ScoredLead,
    trigger: string,
    extras?: { prevTier?: string; prevStage?: string; fieldConfidence?: number },
  ) {
    try {
      const res = await fetch('/api/workflows/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger,
          lead: scored,
          prevTier: extras?.prevTier,
          prevStage: extras?.prevStage,
          fieldConfidence: extras?.fieldConfidence,
          integrations: {
            googleSheetsWebhook: integrations.googleSheetsWebhook,
            hubspotConnected: integrations.hubspotEnabled,
          },
        }),
      })
      if (res.ok) {
        const payload = await res.json()
        const patches = (payload.runs || [])
          .map((r: { leadPatch?: Partial<ScoredLead> }) => r.leadPatch)
          .filter(Boolean) as Partial<ScoredLead>[]
        if (patches.length) {
          startTransition(() => {
            setRawLeads(prev =>
              prev.map(l => {
                if (l.id !== scored.id) {
                  return l
                }
                let next: ScoredLead = l
                for (const p of patches) {
                  next = mergeLeadPatch(next, p)
                }
                return next
              }),
            )
          })
          for (const run of payload.runs || []) {
            for (const nr of run.nodeResults || []) {
              if (nr.ok && nr.artifacts?.activity) {
                const act = nr.artifacts.activity as LeadActivityItem
                setActivities(a => ({
                  ...a,
                  [scored.id]: [
                    { ...act, createdAt: new Date().toISOString() },
                    ...(a[scored.id] || []),
                  ],
                }))
              }
            }
          }
        }
      }
      setRunTick(tick => tick + 1)
    } catch {
      // Autopilot failures should not block triage / enrich UX.
    }
  }

  async function fireScheduleTriggers() {
    try {
      await fetch('/api/workflows/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger: 'schedule',
          lead: {
            id: 'DIGEST',
            lead: { company: 'Weekly digest' },
            score: 0,
            tier: 'C',
            reasons: [],
            junk: false,
            junkReasons: [],
            whyNow: '',
            tags: [],
            stage: 'new',
          },
          integrations: {
            googleSheetsWebhook: integrations.googleSheetsWebhook,
            hubspotConnected: integrations.hubspotEnabled,
          },
        }),
      })
      // Also fire no-reply template against contacted leads 5+ days
      const due = leads.filter(l => {
        if (l.stage !== 'contacted' || !l.stageChangedAt) {
          return false
        }
        const days = (Date.now() - new Date(l.stageChangedAt).getTime()) / 86400000
        return days >= 5
      }).slice(0, 5)
      for (const lead of due) {
        await runWorkflowsForLead(lead, 'schedule')
      }
      setRunTick(t => t + 1)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!sessionReady || !leads.length || scheduleFired.current) {
      return
    }
    if (tab !== 'today') {
      return
    }
    scheduleFired.current = true
    void fireScheduleTriggers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady, leads.length, tab])

  async function scoreCsvOnServer(text: string, name: string): Promise<ScoredLead[] | null> {
    const response = await fetch(`/api/score?name=${encodeURIComponent(name)}`, {
      method: 'POST',
      body: text,
      headers: { 'x-icp-json': JSON.stringify(icp) },
    })
    const payload = await response.json()
    if (!response.ok) {
      return null
    }
    return payload.leads as ScoredLead[]
  }

  async function fireAutopilotForATiers(scored: ScoredLead[]) {
    const targets = scored
      .filter(lead => !lead.junk && !lead.duplicateOf && lead.tier === 'A')
      .slice(0, MAX_AUTOPILOT_A_TIERS)
    for (const target of targets) {
      await runWorkflowsForLead(target, 'new_lead')
    }
  }

  async function ingestCsv(text: string, name: string, persist: boolean, demo = false): Promise<ScoredLead[]> {
    setErr(null)
    setWarn(null)
    setBusy(true)
    try {
      let scored: ScoredLead[] | null = null
      if (persist) {
        try {
          scored = await scoreCsvOnServer(text, name)
          if (scored) {
            applyTriagedLeads(scored, demo)
          } else if (!triageCsvLocally(text, demo)) {
            return []
          } else {
            setWarn('Loaded without saving history. Scoring still works.')
          }
        } catch {
          if (!triageCsvLocally(text, demo)) {
            return []
          }
          setWarn('Loaded without saving history. Scoring still works.')
        }
      } else {
        triageCsvLocally(text, demo)
      }

      let list =
        scored ||
        triage(parseCsvRows(text).data as Parameters<typeof triage>[0], icp)
      list = demo ? assignDemoStages(withProfiles(list)) : withProfiles(list)
      if (!scored) {
        startTransition(() => setRawLeads(list))
      } else if (demo) {
        startTransition(() => setRawLeads(assignDemoStages(withProfiles(scored!))))
        list = assignDemoStages(withProfiles(scored))
      }

      await fireAutopilotForATiers(list)
      return list
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Upload failed')
      return []
    } finally {
      setBusy(false)
    }
  }

  async function uploadCsvFile(file: File) {
    if (!isCsvFile(file)) {
      setErr('Please upload a CSV file.')
      return
    }
    await ingestCsv(await file.text(), file.name, true, false)
  }

  async function loadDemoData(): Promise<ScoredLead[]> {
    const response = await fetch('/demo_leads.csv')
    if (!response.ok) {
      const fallback = await fetch('/sample_leads.csv')
      if (!fallback.ok) {
        setErr('Could not load demo CSV')
        return []
      }
      return ingestCsv(await fallback.text(), 'sample_leads.csv', true, true)
    }
    return ingestCsv(await response.text(), 'demo_leads.csv', true, true)
  }

  async function loadSampleAndRun() {
    if (sampleBusy || busy) {
      return
    }
    setSampleBusy(true)
    setErr(null)
    setWarn(null)
    scheduleFired.current = false
    try {
      setTab('today')
      const list = await loadDemoData()
      setFilters({ ...DEFAULT_FILTERS, tier: 'A' })
      setOpenId(null)
      const target =
        list.find(lead => !lead.junk && !lead.duplicateOf && lead.tier === 'A') || list[0]
      if (target) {
        await enrichOneLead(target)
      }
      await fireScheduleTriggers()
      setRunTick(tick => tick + 1)
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Sample load failed')
    } finally {
      setSampleBusy(false)
    }
  }

  async function enrichOneLead(item: ScoredLead) {
    setEnrichingId(item.id)
    setErr(null)
    try {
      const response = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead: item.lead }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Enrich failed')
      }

      setEnrichments(current => ({ ...current, [item.id]: payload.enrichment }))
      const nextStage: PipelineStage =
        item.stage === 'new' || !item.stage ? 'enriched' : (item.stage as PipelineStage)
      startTransition(() => {
        setRawLeads(previous =>
          previous.map(lead =>
            lead.id === item.id
              ? {
                  ...lead,
                  lead: payload.lead,
                  score: payload.score,
                  tier: payload.tier,
                  reasons: payload.reasons,
                  whyNow: payload.whyNow,
                  scoreBreakdown: payload.scoreBreakdown || lead.scoreBreakdown,
                  stage: nextStage,
                  stageChangedAt:
                    nextStage !== lead.stage ? new Date().toISOString() : lead.stageChangedAt,
                }
              : lead,
          ),
        )
      })
      setActivities(a => ({
        ...a,
        [item.id]: [
          {
            kind: 'enrich',
            summary: `Enriched from website (${payload.enrichment?.source || 'live'})`,
            createdAt: new Date().toISOString(),
          },
          ...(a[item.id] || []),
        ],
      }))

      const conf = Math.max(
        payload.enrichment?.email?.confidence ?? 0,
        payload.enrichment?.phone?.confidence ?? 0,
      )
      const updated = {
        ...item,
        lead: payload.lead,
        score: payload.score,
        tier: payload.tier,
        reasons: payload.reasons,
        whyNow: payload.whyNow,
        stage: nextStage,
      }
      await runWorkflowsForLead(updated, 'field_updated', { fieldConfidence: conf })
      setRunTick(tick => tick + 1)
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Enrich failed')
    } finally {
      setEnrichingId(null)
    }
  }

  function onIcpChange(next: Icp) {
    startTransition(() => setIcp(next))
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragOver(false)
    const file = event.dataTransfer.files?.[0]
    if (file) {
      void uploadCsvFile(file)
    }
  }

  const hasLeads = leads.length > 0
  const aCount = summary.tierA

  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 pb-16 pt-12 sm:px-8 sm:pt-16 lg:px-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--sq-text-muted)]">
            SaaSquatch add-on · Caprae
          </p>
          <h1 className="text-[1.85rem] font-bold leading-[1.1] tracking-[-0.03em] text-white sm:text-[2.15rem]">
            Deal Sourcing Autopilot
          </h1>
          <p className="text-[14px] leading-relaxed text-[var(--sq-text-secondary)]">
            Today’s command view → triage → enrich → pipeline → CRM — one connected product for
            ETA buyers. Drafts only; never sends email.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <IntegrationsMenu value={integrations} onChange={setIntegrations} />
          <button
            type="button"
            className="btn btn-primary"
            disabled={sampleBusy || busy}
            onClick={() => void loadSampleAndRun()}
            title="Load demo data, enrich an A-tier lead, and fire templates"
          >
            <Sparkles className="size-3.5" strokeWidth={1.75} />
            {sampleBusy ? 'Loading demo…' : 'Use demo data'}
          </button>
          {hasLeads && (tab === 'leads' || tab === 'today') && (
            <>
              <ExportPresetsMenu
                leads={filters.tier === 'A' ? leads.filter(l => l.tier === 'A') : visible}
                label={filters.tier === 'A' ? `A-tier (${aCount})` : `Export (${visible.filter(l => !l.junk && !l.duplicateOf).length})`}
              />
            </>
          )}
        </div>
      </header>

      <SlidingSeg
        className="mb-6"
        aria-label="Main"
        value={tab}
        onChange={next => {
          setTab(next)
        }}
        items={[
          { id: 'today', label: 'Today' },
          { id: 'leads', label: 'Leads' },
          { id: 'automate', label: 'Automate' },
          { id: 'runs', label: 'Runs' },
          { id: 'report', label: 'Report' },
        ]}
      />

      {err && (
        <p className="mb-6 rounded-[var(--radius)] bg-sq-danger/10 px-4 py-3 text-sm text-sq-danger" role="alert">
          {err}
        </p>
      )}
      {warn && !err && (
        <p className="mb-6 rounded-[var(--radius)] bg-sq-warn/10 px-4 py-3 text-sm text-sq-warn" role="status">
          {warn}
        </p>
      )}

      <div key={tab} className="tab-view">
        {tab === 'today' && (
          <TodayBoard
            leads={applySharedFilters(leads, filters, enrichments)}
            runs={todayRuns}
            drafts={todayDrafts}
            demoBusy={sampleBusy}
            onLoadDemo={() => void loadSampleAndRun()}
            onNavigate={nav => {
              setTab(nav.tab)
              if (nav.tab === 'leads' && 'leadId' in nav && nav.leadId) {
                setOpenId(nav.leadId)
              }
            }}
          />
        )}

        {tab === 'automate' && (
          <AutomationCanvas onSaved={() => setRunTick(tick => tick + 1)} integrations={integrations} />
        )}
        {tab === 'runs' && <RunsDashboard refreshKey={runTick} />}
        {tab === 'report' && (
          <FunnelReport
            leads={leads}
            enrichments={enrichments}
            refreshKey={runTick}
            filters={filters}
            onFiltersChange={setFilters}
          />
        )}

        {tab === 'leads' && !hasLeads && (
          <div className="space-y-5">
            <section
              className={`dropzone relative px-6 py-16 text-center sm:px-10 ${busy ? 'opacity-70' : ''}`}
              data-active={dragOver}
              onDragOver={event => {
                event.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-file"
                disabled={busy}
                aria-label="Upload CSV"
                onChange={event => {
                  const file = event.target.files?.[0]
                  if (file) {
                    void uploadCsvFile(file)
                  }
                }}
              />
              <span
                className="icon-well mx-auto mb-4"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#e5e5e5',
                  width: '2.75rem',
                  height: '2.75rem',
                }}
              >
                <FileUp strokeWidth={1.75} />
              </span>
              <p className="text-xl font-semibold tracking-[-0.03em] text-white">Drop SaaSquatch CSV</p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--sq-text-secondary)]">
                Import → ethical enrich → acquisition score → automation fires for A-tier.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="size-3.5" strokeWidth={1.75} />
                  Choose CSV
                </button>
                <button
                  type="button"
                  className="btn btn-accent"
                  disabled={busy || sampleBusy}
                  onClick={() => void loadSampleAndRun()}
                >
                  <Sparkles className="size-3.5" strokeWidth={1.75} />
                  Load demo data
                </button>
              </div>
              {busy && (
                <p className="mt-5 text-xs text-[var(--sq-text-muted)]">Scoring & arming workflows…</p>
              )}
            </section>
            <IcpPanel icp={icp} onChange={onIcpChange} defaultOpen={false} />
          </div>
        )}

        {tab === 'leads' && hasLeads && (
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-end gap-3">
                {pending && <span className="text-xs text-[var(--sq-text-muted)]">Updating…</span>}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-file"
                  disabled={busy}
                  aria-label="Upload CSV"
                  onChange={event => {
                    const file = event.target.files?.[0]
                    if (file) {
                      void uploadCsvFile(file)
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  Replace CSV
                </button>
              </div>
              <SummaryCards summary={summary} />
            </div>

            <IcpPanel icp={icp} onChange={onIcpChange} defaultOpen={false} />

            <SharedFilterBar
              leads={leads}
              summary={summary}
              filters={filters}
              onChange={setFilters}
            />

            <div key={filters.tier + filters.query} className="lead-sheet tab-view-fast">
              {visible.length === 0 && (
                <p className="px-5 py-14 text-center text-sm font-medium text-[var(--sq-text-muted)]">
                  {filters.query.trim() ? 'No leads match that search.' : 'Nothing in this filter.'}
                </p>
              )}
              {visible.map((lead, index) => (
                <div key={lead.id}>
                  <LeadCard
                    item={lead}
                    index={index}
                    open={openId === lead.id}
                    enrichment={enrichments[lead.id]}
                    enriching={enrichingId === lead.id}
                    onEnrich={() => void enrichOneLead(lead)}
                    onRunAutomation={() => void runWorkflowsForLead(lead, 'tier_changed')}
                    onToggle={() => setOpenId(openId === lead.id ? null : lead.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="mt-14 text-center text-[11px] text-[var(--sq-text-muted)]">
        Caprae / SaaSquatch demo · Ethical crawl (robots.txt + rate limit) · Does not send email ·
        Fictional .example data
      </footer>
    </main>
  )
}
