'use client'

import { AlertTriangle, CheckCircle2, Copy } from 'lucide-react'
import type { ScoredLead } from '@/lib/scoring'

/** Colored status chip — readable at a glance (inspiration: Active/Pending/Inactive badges). */
export function StatusBadge({ item }: { item: ScoredLead }) {
  if (item.duplicateOf) {
    return (
      <span className="badge badge-warn">
        <Copy className="size-3" strokeWidth={2} aria-hidden />
        Duplicate
      </span>
    )
  }
  if (item.junk) {
    return (
      <span className="badge badge-danger">
        <AlertTriangle className="size-3" strokeWidth={2} aria-hidden />
        Junk
      </span>
    )
  }
  return (
    <span className="badge badge-ok">
      <CheckCircle2 className="size-3" strokeWidth={2} aria-hidden />
      Clean
    </span>
  )
}

export function TierBadge({ tier }: { tier: 'A' | 'B' | 'C' }) {
  const cls = tier === 'A' ? 'badge-tier-a' : tier === 'B' ? 'badge-tier-b' : 'badge-tier-c'
  return (
    <span className={`badge ${cls}`} title={`Tier ${tier}`}>
      {tier}
    </span>
  )
}
