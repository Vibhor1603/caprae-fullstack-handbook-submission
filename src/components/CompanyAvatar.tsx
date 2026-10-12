'use client'

import { useState } from 'react'
import { Building2 } from 'lucide-react'
import { normalizeDomain } from '@/lib/scoring'

function initials(company: string): string {
  const parts = company
    .replace(/[^a-zA-Z0-9\s&]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length >= 2) {return (parts[0][0] + parts[1][0]).toUpperCase()}
  const s = (parts[0] || '?').replace(/[^a-zA-Z0-9]/g, '')
  return (s.slice(0, 2) || '?').toUpperCase()
}

/** Soft ash tint from name — logo-mark energy, not tier color. */
function markStyle(seed: string): { background: string; color: string } {
  let h = 0
  for (let i = 0; i < seed.length; i++) {h = (h * 33 + seed.charCodeAt(i)) >>> 0}
  const hue = h % 360
  return {
    background: `hsla(${hue}, 18%, 22%, 1)`,
    color: `hsla(${hue}, 28%, 82%, 1)`,
  }
}

type Props = {
  company: string
  website?: string
  email?: string
  className?: string
}

/** Company mark: favicon when domain resolves, else initials (profile/logo slot). */
export function CompanyAvatar({ company, website, email, className = '' }: Props) {
  const domain = normalizeDomain(website || '', email)
  const [imgFailed, setImgFailed] = useState(false)
  const mark = markStyle(company || domain || 'co')
  const letters = initials(company || domain || 'Co')
  const favicon =
    domain && !domain.endsWith('.example')
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
      : null

  const showImg = Boolean(favicon && !imgFailed)

  return (
    <span
      className={`company-avatar ${className}`}
      style={showImg ? undefined : mark}
      aria-hidden
      title={company}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={favicon!}
          alt=""
          width={20}
          height={20}
          className="company-avatar-img"
          onError={() => setImgFailed(true)}
        />
      ) : letters ? (
        <span className="company-avatar-letters">{letters}</span>
      ) : (
        <Building2 className="size-4" strokeWidth={1.75} />
      )}
    </span>
  )
}
