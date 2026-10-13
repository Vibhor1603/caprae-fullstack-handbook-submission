# Caprae Capital — Full Stack Handbook Submission

**DealFit** is an add-on for [SaaSquatch Leads](https://www.saasquatchleads.com/), aimed at ETA / search-fund buyers (Caprae’s audience).

SaaSquatch scrapes and exports leads. DealFit takes that CSV next: clean the list, score acquisition fit, open a lead **dossier page** (not an accordion) with ETA buying-guide signals (geo, size, tenure, owner, succession, locations, reputation, licensed/bonded, sale/retirement cues, concentration, owner reachability), fill gaps from websites, run deal workflows, and export to CRM.

**Live demo:** [https://caprae-deal-sourcing.vercel.app](https://caprae-deal-sourcing.vercel.app)

---

## Setup

```bash
npm install
cp .env.example .env
```

In `.env`, set Supabase Postgres:

- `DATABASE_URL` — pooler connection string  
- `DIRECT_URL` — direct connection string  

Then:

```bash
npm run db:push          # or run prisma/migrations/20261013_v2_pipeline/migration.sql in Supabase
npm run db:seed          # seeds the three deal templates
npm run dev              # http://localhost:3000
```

Useful checks:

```bash
npm test
npm run build && PORT=3001 npm run start
```

If `db:push` fails on table ownership, run the migration SQL as the table owner in the Supabase SQL editor. Scoring, demo CSV, and most of the UI still work from browser session without new DB columns. Automate history and Runs need Postgres.

---

## Demo dataset

All sample companies are **fictional**. Domains use `.example` so enrich does not hit the public web.

| File | Rows | Use |
| --- | --- | --- |
| `public/demo_leads.csv` | 20 | Main demo (**Use demo data**) |
| `public/sample_leads.csv` | ~10 | Smaller fallback |
| `data/*.csv` | same idea | Copies for local reference |

Columns include company, website, industry, location, employees, revenue, owner, title, email, phone, LinkedIn, year founded, plus Caprae-oriented buying fields: `locations`, `googleRating`, `reviewCount`, `licenses`, `bonding`, `bbb`, `customerConcentration`, `saleSignal`, `siteSnippet` (all fictional). The list mixes strong A-tier fits, weaker B/C leads, and a few junk or duplicate rows so scoring and filters are easy to demo.

**Use demo data** loads the CSV, scores it, fills stages for the demo story, enriches one A-tier lead, and fires schedule / template runs when workflows are seeded.

**Leads UX:** compact list rows (company, tier, one-line context, score) → click opens the dossier subpage (**Back to list**). Mark rows (mark all / clear) to **export a subset** or **delete marked**. Export menu lets you choose marked / current filter / A-tier / all clean. List is paginated at **10 per page**.

---

## Architecture

```
CSV or demo
  → clean + score (dedupe, junk filter, A/B/C + reasons)
  → lead dossier page (company, owner, buying guide, stage, activity)
  → workflows (templates on the canvas)
  → runs + report events
  → Today, CRM export
```

| Path | Role |
| --- | --- |
| `src/lib/` | Pure logic: scoring, enrich, pipeline, workflows, funnel, exports |
| `src/components/` | UI |
| `src/app/api/` | Score, enrich, workflows, runs, report |
| `prisma/` | Schema and migrations |

Core scoring lives in `src/lib/scoring.ts` and is covered by `npm test`. Keep that module free of UI and network side effects.

---

## Stack (and why)

| Piece | Choice | Why |
| --- | --- | --- |
| App | Next.js 15, TypeScript, Tailwind | One repo for UI and APIs; fast to ship for a timed take-home |
| Database | Prisma + Supabase Postgres | Persist workflows, runs, and report events; pooler + direct URLs for serverless |
| Cache | Enrich rows in Postgres (~7 days) | Avoid Redis; enough for demo rate limits and repeat enrich |
| Canvas | React Flow | Clear visual story for deal templates |
| Host | Vercel + Supabase | Matches a small full-stack production shape |
| Tests | Vitest | Fast unit tests for scoring, stages, templates, funnel, exports |

---

## What you can do in the app

1. **Today** — Do-this-next actions, best matches, score changes, workflow runs, activity, follow-ups.  
2. **Leads** — Upload CSV or load demo. Clean, score, filter, mark/export/delete; open a lead dossier for buying-guide signals and website fill.  
3. **Stages** — New → Researched → Contacted → Replied → Call booked → LOI → Closed / Lost.  
4. **Automate** — Templates and canvas; dry-run previews (demo send is simulated, no real SMTP).  
5. **Runs** — Each workflow run and step results.  
6. **Export** — Marked / filter / A-tier / all → HubSpot, Salesforce, Pipedrive, Sheets, or generic CSV.

---

## Quick walkthrough

1. Click **Use demo data**.  
2. Open **Today**, then open a lead dossier on **Leads** (Back to list returns you).  
3. **Fill from website** on an A-tier lead (demo path for `.example`).  
4. Open **Automate**, pick a template, Save.  
5. Check **Runs**, then **Export** with a CRM preset (pick marked / filter / A-tier).

---

## Ethics

- Honours `robots.txt` and rate-limits live crawls.  
- Fictional `.example` data uses offline demo enrich (no network).  
- Dry run on Automate is preview only. Live runs use the automation path with simulated send in this demo.

---

## Author

Vibhor Sharma — Caprae Capital Full Stack handbook submission.
