# Caprae Capital — Full Stack Handbook Submission

**Deal Sourcing Autopilot** — an add-on for [SaaSquatch Leads](https://www.saasquatchleads.com/).

SaaSquatch already scrapes and exports leads. This app sits **after the CSV export**: clean the list, score which companies fit an acquisition search, enrich only the good ones, and run a simple automation path toward CRM — without sending email for the user.

Sample CSV uses fictional companies (`.example` domains).

## What we built

1. **Leads** — Upload a SaaSquatch-style CSV (or load sample). Deduplicate, filter junk, score A / B / C with clear reasons and a short “why now” line. Optional website enrich with confidence per field.
2. **Automate** — Small visual workflow: trigger → condition → draft email / CRM row / HTTP webhook / weekly report. Drafts are prepared only; nothing is sent.
3. **Runs** — History of each workflow execution and per-step results.
4. **Weekly report** — Simple 7-day pulse you can export.

## How to run

```bash
npm install
cp .env.example .env
npm run db:push
node scripts/seed-demo.mjs   # optional default workflow
npm run dev                  # http://localhost:3000
```

```bash
npm test
npm run build && PORT=3001 npm run start
```

## Try the demo

1. Click **Use sample data**
2. Filter to **A**, open a lead, click **Enrich from website**
3. Open **Automate**, edit a node, **Save**
4. Check **Runs** and **Weekly report**
5. Export **A-tier shortlist** or CRM CSV from the header

## Stack

| Area | Choice |
| --- | --- |
| App | Next.js 15, TypeScript, Tailwind |
| Database | Prisma + **Supabase Postgres** |
| Caching | Enrichment results cached ~7 days in Postgres (no Redis) |
| Hosting | Vercel + Supabase |
| Tests | Vitest on scoring / workflow logic |

Core logic lives in `src/lib/` (`scoring.ts`, `enrichment.ts`, `workflow.ts`). UI in `src/components/`. APIs under `src/app/api/`.

## Database

Uses Supabase Postgres end-to-end (workflows, runs, report events, enrichment cache, import history).

1. Copy `.env.example` → `.env` and paste your Supabase pooler + direct URLs  
2. `npx prisma generate`  
3. `node scripts/seed-demo.mjs`  

On Vercel, set the same `DATABASE_URL` and `DIRECT_URL` project env vars.

## Author

Vibhor Sharma — Caprae Capital Full Stack handbook submission.
