/** Tiny Levenshtein + company-name similarity for fuzzy dedupe. */

export function levenshtein(a: string, b: string): number {
  const s = a.toLowerCase()
  const t = b.toLowerCase()
  if (s === t) {return 0}
  if (!s.length) {return t.length}
  if (!t.length) {return s.length}
  const prev = new Array(t.length + 1)
  const cur = new Array(t.length + 1)
  for (let j = 0; j <= t.length; j++) {prev[j] = j}
  for (let i = 1; i <= s.length; i++) {
    cur[0] = i
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= t.length; j++) {prev[j] = cur[j]}
  }
  return prev[t.length]
}

/** 0–1 similarity; 1 = identical after normalize. */
export function nameSimilarity(a?: string, b?: string): number {
  const na = normalizeCompany(a)
  const nb = normalizeCompany(b)
  if (!na || !nb) {return 0}
  if (na === nb) {return 1}
  const dist = levenshtein(na, nb)
  const maxLen = Math.max(na.length, nb.length)
  return Math.max(0, 1 - dist / maxLen)
}

export function normalizeCompany(s?: string): string {
  return (s ?? '')
    .trim()
    .toLowerCase()
    .replace(/[.,']/g, '')
    .replace(/\b(inc|llc|ltd|co|corp|corporation|company|group)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** True when names are likely the same firm (threshold ~0.86). */
export function isFuzzyCompanyMatch(a?: string, b?: string, threshold = 0.86): boolean {
  return nameSimilarity(a, b) >= threshold
}
