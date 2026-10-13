/** Simplified brand marks for integration tiles (demo / connect UI). */

type LogoProps = { className?: string; title?: string }

export function HubSpotLogo({ className = 'size-6', title = 'HubSpot' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" role="img" aria-label={title}>
      <title>{title}</title>
      <circle cx="12" cy="12" r="3.2" fill="#ff7a59" />
      <circle cx="5.5" cy="12" r="2.2" fill="#ff7a59" />
      <circle cx="18.5" cy="12" r="2.2" fill="#ff7a59" />
      <circle cx="12" cy="5.5" r="2.2" fill="#ff7a59" />
      <circle cx="12" cy="18.5" r="2.2" fill="#ff7a59" />
      <path
        d="M12 8.8v2.4M8.8 12h2.4M12 12.8v2.4M12.8 12h2.4"
        stroke="#ff7a59"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function SalesforceLogo({ className = 'size-6', title = 'Salesforce' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" role="img" aria-label={title}>
      <title>{title}</title>
      <path
        fill="#00a1e0"
        d="M6.2 14.8a3.4 3.4 0 0 1 5.8-2.4 4.2 4.2 0 0 1 6.5 1.1 3.6 3.6 0 0 1-.4 7.1H7.1a3.5 3.5 0 0 1-.9-5.8Z"
      />
      <ellipse cx="9.5" cy="11.2" rx="2.8" ry="2.1" fill="#009edb" opacity="0.85" />
      <ellipse cx="14.8" cy="12.4" rx="3.1" ry="2.3" fill="#0082c8" opacity="0.9" />
    </svg>
  )
}

export function PipedriveLogo({ className = 'size-6', title = 'Pipedrive' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" role="img" aria-label={title}>
      <title>{title}</title>
      <rect x="3" y="5" width="18" height="14" rx="3" fill="#017737" />
      <path
        fill="#fff"
        d="M8.2 16V8.4h2.1c1.8 0 2.9 1 2.9 2.5 0 1.1-.6 1.9-1.5 2.2L14.2 16h-1.5l-1.9-2.6H9.5V16H8.2zm1.3-3.8h.7c.9 0 1.4-.5 1.4-1.2 0-.8-.6-1.2-1.5-1.2h-.6v2.4z"
      />
    </svg>
  )
}

export function GoogleSheetsLogo({ className = 'size-6', title = 'Google Sheets' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" role="img" aria-label={title}>
      <title>{title}</title>
      <path fill="#0f9d58" d="M14 3H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7l-4-4z" />
      <path fill="#87ceac" d="M14 3v4h4" />
      <path
        fill="#fff"
        d="M9 11h6v1.2H9V11zm0 2.4h6v1.2H9v-1.2zm0 2.4h4.2v1.2H9V15.8z"
        opacity="0.95"
      />
    </svg>
  )
}
