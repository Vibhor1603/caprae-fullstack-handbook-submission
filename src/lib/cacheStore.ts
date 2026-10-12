import { prisma } from '@/lib/db'
import type { EnrichmentSnapshot, CacheStore } from '@/lib/enrichment'

export const prismaEnrichmentCache: CacheStore = {
  async get(domain) {
    const row = await prisma.enrichmentCache.findUnique({ where: { domain } })
    if (!row) {return null}
    return { payload: row.payload, expiresAt: row.expiresAt, robotsAllowed: row.robotsAllowed }
  },
  async set(domain, payload: EnrichmentSnapshot, robotsAllowed, expiresAt) {
    await prisma.enrichmentCache.upsert({
      where: { domain },
      create: { domain, payload: JSON.stringify(payload), robotsAllowed, expiresAt },
      update: { payload: JSON.stringify(payload), robotsAllowed, expiresAt, fetchedAt: new Date() },
    })
  },
}
