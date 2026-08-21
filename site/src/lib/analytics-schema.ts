/**
 * The parts of analytics that are pure data and pure functions.
 *
 * Kept separate from analytics.ts so the allowlists and parsers can be unit
 * tested without pulling in posthog-js or Astro's build-time env.
 */

/* ------------------------------------------------------------- schema ---- */

export const EVENTS = [
  'educator_landing_viewed',
  'educator_overview_opened',
  'training_cta_clicked',
  'training_registration_started',
  'training_registration_completed',
  'studio_cta_clicked',
] as const
export type EventName = (typeof EVENTS)[number]

/** Attribution fields an outreach link may carry. Nothing else is read. */
export const ATTRIBUTION_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'batch_id',
  'segment',
  'outreach_id',
] as const

/** Every property key that may be sent, for any event. */
export const ALLOWED_PROPS = new Set<string>([
  ...ATTRIBUTION_KEYS,
  'schema_version',
  'surface',
  'environment',
  'page_group',
  'landing_path',
  'asset_id',
  'cta_location',
  'training_date',
])

/** Controlled enums — free text is never accepted for these. */
export const CTA_LOCATIONS = [
  'header',
  'hero',
  'footer',
  'training_band',
  'research',
  'about',
  'curriculum',
] as const
export type CtaLocation = (typeof CTA_LOCATIONS)[number]

/** Conservative: short, and no characters that could smuggle anything odd. */
export const VALID = /^[A-Za-z0-9._-]{1,64}$/

/* -------------------------------------------------------- attribution ---- */

export type Attribution = Partial<Record<(typeof ATTRIBUTION_KEYS)[number], string>>

/**
 * Reads the approved campaign fields out of a query string, dropping any
 * value that does not look like a plain identifier.
 */
export function parseAttribution(search: string): Attribution {
  const params = new URLSearchParams(search)
  const out: Attribution = {}
  for (const key of ATTRIBUTION_KEYS) {
    const raw = params.get(key)
    if (raw !== null && VALID.test(raw)) out[key] = raw
  }
  return out
}

/* ---------------------------------------------------------- page names ---- */

/** A stable, low-cardinality label for the page — never raw page text. */
export function pageGroup(pathname: string): string {
  const p = pathname.replace(/\/$/, '')
  if (p === '') return 'home'
  if (p.startsWith('/stories/') && p !== '/stories') return 'story_detail'
  if (p.startsWith('/programs/') && p !== '/programs') return 'program_detail'
  if (p.startsWith('/blog/')) return 'blog_post'
  return p.slice(1).replace(/\//g, '_')
}

/** Strips anything not on the allowlist, and any empty value. */
export function sanitize(props: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(props)) {
    if (!ALLOWED_PROPS.has(key)) continue
    if (value === undefined || value === null || value === '') continue
    out[key] = String(value).slice(0, 64)
  }
  return out
}

