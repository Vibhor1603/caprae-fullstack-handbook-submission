'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState, useTransition, type DragEvent } from 'react'
import { Download, FileUp, Search, Sparkles, Upload, Workflow, Zap } from 'lucide-react'
import Papa from 'papaparse'
import {
  DEFAULT_ICP,
  rescore,
  summarize,
  toCrmRows,
  triage,
  type Icp,
  type ScoredLead,
} from '@/lib/scoring'
import type { EnrichmentSnapshot as EnrichSnap } from '@/lib/enrichment'
import { filterAndSearchLeads, type TierFilter } from '@/lib/leadsQuery'
import { loadSession, saveSession } from '@/lib/sessionStore'
import { IcpPanel } from '@/components/IcpPanel'
import { SummaryCards } from '@/components/SummaryCards'
import { LeadCard } from '@/components/LeadCard'
import { ConfidenceMeter } from '@/components/ConfidenceMeter'
import { RunsDashboard } from '@/components/RunsDashboard'
import { WeeklyReport } from '@/components/WeeklyReport'
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

type Tab = 'leads' | 'automate' | 'runs' | 'report'

const MAX_AUTOPILOT_A_TIERS = 5

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

function downloadCsv(filename: string, rows: ReturnType<typeof toCrmRows>) {
  const blob = new Blob([Papa.unparse(rows)], { type: 'text/csv' })
  const anchor = document.createElement('a')
  anchor.href = URL.createObjectURL(blob)
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(anchor.href)
}

function parseCsvRows(text: string) {
  return Papa.parse(text, { header: true, skipEmptyLines: true })
}

function isCsvFile(file: File): boolean {
  const nameOk = file.name.toLowerCase().endsWith('.csv')
  const typeOk = !file.type || file.type.includes('csv')
  return nameOk || typeOk
}

export default function Home() {
  const [rawLeads, setRawLeads] = useState<ScoredLead[]>([])
  const [enrichments, setEnrichments] = useState<Record<string, EnrichSnap>>({})
  const [icp, setIcp] = useState<Icp>(() => cloneIcp())
  const [filter, setFilter] = useState<TierFilter>('ALL')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('leads')
  const [err, setErr] = useState<string | null>(null)
  const [warn, setWarn] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [enrichingId, setEnrichingId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [runTick, setRunTick] = useState(0)
  const [sampleBusy, setSampleBusy] = useState(false)
  const [integrations, setIntegrations] = useState<ClientIntegrations>({
    googleSheetsWebhook: '',
    hubspotEnabled: false,
  })
  const [pending, startTransition] = useTransition()
  const [sessionReady, setSessionReady] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
      if (snapshot.icp && Array.isArray(snapshot.icp.industries)) {
        setIcp(cloneIcp(snapshot.icp))
      }
      setFilter(snapshot.filter)
      setQuery(snapshot.query)
      setTab(snapshot.tab)
      setOpenId(snapshot.openId)
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
      icp,
      filter,
      query,
      tab,
      openId,
    })
  }, [sessionReady, rawLeads, enrichments, icp, filter, query, tab, openId])

  const leads = useMemo(() => (rawLeads.length ? rescore(rawLeads, icp) : []), [rawLeads, icp])
  const summary = useMemo(() => summarize(leads), [leads])
  const visible = useMemo(
    () => filterAndSearchLeads(leads, filter, query),
    [leads, filter, query],
  )

  function resetLeadListUi() {
    setFilter('ALL')
    setQuery('')
    setOpenId(null)
  }

  function applyTriagedLeads(scored: ScoredLead[]) {
    startTransition(() => setRawLeads(scored))
    resetLeadListUi()
  }

  /** Score CSV in-browser when the API is unavailable. */
  function triageCsvLocally(text: string): boolean {
    const { data, errors } = parseCsvRows(text)
    if (errors.length && !data.length) {
      setErr(errors[0].message)
      return false
    }

    applyTriagedLeads(triage(data as Parameters<typeof triage>[0], icp))
    return true
  }

  async function runWorkflowsForLead(scored: ScoredLead, trigger: string) {
    try {
      await fetch('/api/workflows/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger,
          lead: scored,
          integrations: {
            googleSheetsWebhook: integrations.googleSheetsWebhook,
            hubspotConnected: integrations.hubspotEnabled,
          },
        }),
      })
      setRunTick(tick => tick + 1)
    } catch {
      // Autopilot failures should not block triage / enrich UX.
    }
  }

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

  async function ingestCsv(text: string, name: string, persist: boolean): Promise<ScoredLead[]> {
    setErr(null)
    setWarn(null)
    setBusy(true)

    try {
      let scored: ScoredLead[] | null = null

      if (persist) {
        try {
          scored = await scoreCsvOnServer(text, name)
          if (scored) {
            applyTriagedLeads(scored)
          } else if (!triageCsvLocally(text)) {
            return []
          } else {
            setWarn('Loaded without saving history. Scoring still works.')
          }
        } catch {
          if (!triageCsvLocally(text)) {
            return []
          }
          setWarn('Loaded without saving history. Scoring still works.')
        }
      } else {
        triageCsvLocally(text)
      }

      const list =
        scored ||
        triage(parseCsvRows(text).data as Parameters<typeof triage>[0], icp)

      if (!scored) {
        startTransition(() => setRawLeads(list))
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
    await ingestCsv(await file.text(), file.name, true)
  }

  async function loadSampleCsv(): Promise<ScoredLead[]> {
    const response = await fetch('/sample_leads.csv')
    if (!response.ok) {
      setErr('Could not load sample CSV')
      return []
    }
    return ingestCsv(await response.text(), 'sample_leads.csv', true)
  }

  /** Load sample CSV, score, fire A-tier workflows, enrich first A — then stay on Leads. */
  async function loadSampleAndRun() {
    if (sampleBusy || busy) {
      return
    }

    setSampleBusy(true)
    setErr(null)
    setWarn(null)

    try {
      setTab('leads')
      const list = await loadSampleCsv()
      setFilter('A')
      setQuery('')
      setOpenId(null)

      const target =
        list.find(lead => !lead.junk && !lead.duplicateOf && lead.tier === 'A') || list[0]
      if (target) {
        await enrichOneLead(target)
      }
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
                }
              : lead,
          ),
        )
      })

      const updated = {
        ...item,
        lead: payload.lead,
        score: payload.score,
        tier: payload.tier,
        reasons: payload.reasons,
        whyNow: payload.whyNow,
      }
      await runWorkflowsForLead(updated, 'field_updated')
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

  const cleanCount = summary.clean
  const aCount = summary.tierA
  const hasLeads = leads.length > 0
  const openEnrich = openId ? enrichments[openId] : null

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
            Triage SaaSquatch exports, ethically enrich public sites, score acquisition fit, and automate
            the path to CRM — without wasting enrichment credits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <IntegrationsMenu value={integrations} onChange={setIntegrations} />
          <button
            type="button"
            className="btn btn-primary"
            disabled={sampleBusy || busy}
            onClick={() => void loadSampleAndRun()}
            title="Load sample CSV, score, enrich an A-tier lead, and fire workflows"
          >
            <Sparkles className="size-3.5" strokeWidth={1.75} />
            {sampleBusy ? 'Loading sample…' : 'Use sample data'}
          </button>
          {hasLeads && tab === 'leads' && (
            <>
              <button
                type="button"
                className="btn btn-accent"
                disabled={aCount === 0}
                onClick={() => downloadCsv('enrich_a_tier_first.csv', toCrmRows(leads, { tier: 'A' }))}
              >
                A-tier shortlist ({aCount})
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={cleanCount === 0}
                onClick={() => downloadCsv('crm_ready_leads.csv', toCrmRows(leads))}
              >
                <Download className="size-3.5" strokeWidth={1.75} />
                Export {cleanCount}
              </button>
            </>
          )}
        </div>
      </header>

      <SlidingSeg
        className="mb-6"
        aria-label="Main"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'leads', label: 'Leads' },
          { id: 'automate', label: 'Automate' },
          { id: 'runs', label: 'Runs' },
          { id: 'report', label: 'Weekly report' },
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
        {tab === 'automate' && (
          <AutomationCanvas onSaved={() => setRunTick(tick => tick + 1)} integrations={integrations} />
        )}
        {tab === 'runs' && <RunsDashboard refreshKey={runTick} />}
        {tab === 'report' && <WeeklyReport refreshKey={runTick} />}

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
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => void loadSampleCsv()}
                >
                  Load sample data
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

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="lead-search relative block min-w-0 flex-1 sm:max-w-xs">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--sq-text-muted)]"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <input
                  type="search"
                  className="field !py-2 !pl-9 !pr-3 !text-[0.8125rem]"
                  placeholder="Search company, owner, email…"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  aria-label="Search leads"
                />
              </label>
              <SlidingSeg
                role="group"
                aria-label="Filter by tier"
                value={filter}
                onChange={setFilter}
                items={[
                  { id: 'ALL', label: `All (${leads.length})` },
                  { id: 'A', label: `A (${summary.tierA})` },
                  { id: 'B', label: `B (${summary.tierB})` },
                  { id: 'C', label: `C (${summary.tierC})` },
                  { id: 'JUNK', label: `Junk / dupes (${summary.junk + summary.duplicates})` },
                ]}
              />
            </div>

            <div key={filter} className="lead-sheet tab-view-fast">
              {visible.length === 0 && (
                <p className="px-5 py-14 text-center text-sm font-medium text-[var(--sq-text-muted)]">
                  {query.trim() ? 'No leads match that search.' : 'Nothing in this filter.'}
                </p>
              )}
              {visible.map((lead, index) => (
                <div key={lead.id}>
                  <LeadCard
                    item={lead}
                    index={index}
                    open={openId === lead.id}
                    onToggle={() => setOpenId(current => (current === lead.id ? null : lead.id))}
                  />
                  {openId === lead.id && (
                    <div className="space-y-4 border-b border-[var(--sq-border)] bg-[var(--ash-800)] px-5 pb-5 sm:px-6">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={enrichingId === lead.id}
                          onClick={() => void enrichOneLead(lead)}
                        >
                          <Zap className="size-3.5" strokeWidth={1.75} />
                          {enrichingId === lead.id ? 'Enriching…' : 'Enrich from website'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => void runWorkflowsForLead(lead, 'tier_changed')}
                        >
                          <Workflow className="size-3.5" strokeWidth={1.75} />
                          Run automation
                        </button>
                      </div>
                      {openEnrich && (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <ConfidenceMeter
                            label="Email"
                            value={openEnrich.email.value}
                            confidence={openEnrich.email.confidence}
                          />
                          <ConfidenceMeter
                            label="Phone"
                            value={openEnrich.phone.value}
                            confidence={openEnrich.phone.confidence}
                          />
                          <ConfidenceMeter
                            label="Founded"
                            value={openEnrich.yearFounded.value}
                            confidence={openEnrich.yearFounded.confidence}
                          />
                          <ConfidenceMeter
                            label="Services"
                            value={openEnrich.services.value}
                            confidence={openEnrich.services.confidence}
                          />
                          <p className="sm:col-span-2 lg:col-span-4 text-[11px] text-[var(--sq-text-muted)]">
                            Source {openEnrich.source}
                            {openEnrich.live ? ' · live' : ''} · verified{' '}
                            {new Date(openEnrich.lastVerified).toLocaleString()}
                            {openEnrich.notes[0] ? ` · ${openEnrich.notes[0]}` : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="mt-14 text-center text-[11px] text-[var(--sq-text-muted)]">
        Caprae / SaaSquatch demo · Ethical crawl (robots.txt + rate limit) · Does not send email
      </footer>
    </main>
  )
}
