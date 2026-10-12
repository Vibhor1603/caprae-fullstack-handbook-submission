/**
 * Seeds / resets the default A-tier automation workflow.
 * Run: node scripts/seed-demo.mjs
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULT_GRAPH = {
  nodes: [
    {
      id: 't1',
      type: 'trigger',
      position: { x: 40, y: 140 },
      data: { label: 'When lead arrives', event: 'new_lead' },
    },
    {
      id: 'c1',
      type: 'condition',
      position: { x: 300, y: 140 },
      data: { label: 'If tier is A', field: 'tier', op: 'eq', value: 'A' },
    },
    {
      id: 'a1',
      type: 'action_draft_email',
      position: { x: 560, y: 40 },
      data: {
        label: 'Draft owner email',
        fromEmail: 'searcher@firm.example',
        subject: 'Quick note — {{company}}',
        template:
          'Hi {{owner}}, I work with operators in {{industry}} and admired {{company}}. Open to a short conversation about the business?',
      },
    },
    {
      id: 'a2',
      type: 'action_crm_push',
      position: { x: 560, y: 160 },
      data: { label: 'Push to CRM / Sheets', webhook: '' },
    },
    {
      id: 'a3',
      type: 'action_weekly_report',
      position: { x: 560, y: 280 },
      data: { label: 'Add to weekly report' },
    },
  ],
  edges: [
    { id: 'e1', source: 't1', target: 'c1' },
    { id: 'e2', source: 'c1', target: 'a1' },
    { id: 'e3', source: 'c1', target: 'a2' },
    { id: 'e4', source: 'c1', target: 'a3' },
  ],
}

const existing = await prisma.workflow.findFirst({ orderBy: { createdAt: 'asc' } })
if (!existing) {
  await prisma.workflow.create({
    data: {
      name: 'A-tier deal path',
      enabled: true,
      graph: JSON.stringify(DEFAULT_GRAPH),
    },
  })
  console.log('Seeded default workflow')
} else {
  await prisma.workflow.update({
    where: { id: existing.id },
    data: {
      name: 'A-tier deal path',
      enabled: true,
      graph: JSON.stringify(DEFAULT_GRAPH),
    },
  })
  console.log(`Updated default workflow (${existing.id})`)
}

await prisma.$disconnect()
