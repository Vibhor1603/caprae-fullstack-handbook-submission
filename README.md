# Caprae Capital — Full Stack Handbook Submission

**Deal Sourcing Autopilot** — an add-on for [SaaSquatch Leads](https://www.saasquatchleads.com/).

SaaSquatch already scrapes and exports leads. This app sits **after the CSV export**: clean the list, score which companies fit an acquisition search, enrich only the good ones, run deal templates toward CRM, and track the pipeline — without sending email for the user.

Sample / demo CSVs use fictional companies (`.example` domains).

**Live demo:** [https://caprae-deal-sourcing.vercel.app](https://caprae-deal-sourcing.vercel.app)

## What we built

1. **Today** — Daily command view: new A-tier matches, tier changes, trigger status, automation output (sent email / CRM sync / notify), follow-ups, compact funnel. Deep-links into Leads, Automate, Runs, Report.
2. **Leads** — Upload a SaaSquatch-style CSV (or load ~60-row demo). Deduplicate, filter junk, score A / B / C with exact point breakdown and “why now”. Shared filters (tier, industry, state, stage, confidence). Open a **Profile** dossier (company + owner intelligence, succession signals, activity).
3. **Pipeline** — Stages: New → Enriched → Contacted → Replied → Owner call → LOI → Closed / Lost. Manual changes and workflow `move_stage` actions; stage changes can fire automation.
4. **Automate** — React Flow canvas with three one-click templates:
   - A-tier owner intro (enrich → confidence → draft → Contacted → CRM)
   - No-reply follow-up (Contacted ≥5 days → draft + notify)
   - Weekly pipeline digest (schedule → report + notify)
5. **Runs** — History of each workflow execution and per-step results.
6. **Report** — Funnel with conversion %, breakdowns by tier / industry / state, enrichment credits saved, workflow impact. Date range + shared filters.
7. **Export presets** — HubSpot, Salesforce, Pipedrive, Google Sheets, generic CSV with mapping preview.

## Architecture

```
CSV / demo → triage (fuzzy+domain dedupe, junk, score + breakdown, profile)
          → Profile (source of truth: company, owner, stage, activity)
          → Workflows / templates → Runs + ReportEvent
          → Today / Funnel report / CRM export presets
```

| Area | Choice |
| --- | --- |
| App | Next.js 15, TypeScript, Tailwind v4 |
| Database | Prisma + Supabase Postgres (pooler `DATABASE_URL` + `DIRECT_URL`) |
| Caching | Enrichment results cached ~7 days in Postgres (no Redis) |
| Hosting | Vercel + Supabase |
| Tests | Vitest — scoring breakdown, stages, templates, funnel, exports |

Core logic: `src/lib/` (`scoring.ts`, `enrichment.ts`, `workflow.ts`, `pipeline.ts`, `profile.ts`, `funnel.ts`, `exportPresets.ts`, `templates.ts`). UI: `src/components/`. APIs: `src/app/api/`.

## How to run

```bash
npm install
cp .env.example .env   # paste Supabase DATABASE_URL + DIRECT_URL
npm run db:push        # or apply prisma/migrations/20261013_v2_pipeline/migration.sql
npm run db:seed        # seed deal templates
npm run dev            # http://localhost:3000
```

```bash
npm test
npm run build && PORT=3001 npm run start
```

If `db:push` fails with ownership errors on Supabase, run the SQL in `prisma/migrations/20261013_v2_pipeline/migration.sql` as the table owner in the SQL editor. The UI demo still works fully from session + demo CSV without new columns.

## Try the demo

1. Click **Use demo data** (or open **Today** → Load demo data)
2. Browse **Today** — A-tier, triggers, drafts, funnel snapshot
3. Open a lead → **Open profile** — company/owner dossier, score breakdown, change stage
4. **Automate** — three templates on the canvas; edit & Save
5. **Runs** and **Report** reflect the same data
6. **Export** with a CRM preset (preview mapping first)

## Ethics

- Honours `robots.txt`, rate-limits live crawls
- **Dry run** on Automate previews email; **live workflow runs** dispatch email/notify through the automation path (demo uses simulated send — no real SMTP)
- Fictional `.example` domains use demo enrichment (no network)

## Author

Vibhor Sharma — Caprae Capital Full Stack handbook submission.
