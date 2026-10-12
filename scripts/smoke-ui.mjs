#!/usr/bin/env node
/** Browser smoke for Lead Triage. Server must be on BASE_URL (default http://localhost:3000). */
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const base = process.env.BASE_URL || 'http://localhost:3000'
const shot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '_vibhor', 'ui-smoke.png')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', e => errors.push(String(e)))

await page.goto(base, { waitUntil: 'domcontentloaded' })
await page.getByRole('heading', { name: 'Lead Triage' }).waitFor()
await page.getByRole('button', { name: 'Load sample data' }).first().click()
await page.getByRole('button', { name: /Enrich A-tier first/ }).waitFor({ timeout: 15000 })
const aBtn = page.getByRole('button', { name: /^A \(/ })
const aLabel = await aBtn.textContent()
await aBtn.click()
const filteredRows = await page.locator('.lead-row').count()
await page.getByRole('button', { name: 'Edit' }).click()
await page.getByPlaceholder('hvac, plumbing').fill('hvac')
await page.waitForTimeout(600)
const aAfter = await aBtn.textContent()
await page.getByRole('button', { name: 'Reset' }).click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: /^All \(/ }).click()
const body = await page.locator('.lead-list').innerText()
await page.screenshot({ path: shot, fullPage: true })
await browser.close()

const result = {
  ok: !errors.length && body.includes('Free-mail') && body.includes('Northwind'),
  aLabel,
  filteredRows,
  aAfter,
  pageErrors: errors,
}
console.log(JSON.stringify(result, null, 2))
if (!result.ok) process.exit(1)
