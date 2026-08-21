/**
 * Privacy-conscious analytics for the public website.
 *
 * Every PostHog call goes through this module — nothing else imports posthog-js.
 * That gives one place to enforce the allowlists and one place to switch it off.
 *
 * What is deliberately NOT done here, because the site serves children aged 7–13:
 *   - no identify(), ever
 *   - no autocapture, session recording, heatmaps or surveys
 *   - no names, emails, organizations, form values, story text or full URLs
 *   - no advertising integrations
 *
 * Events and property keys are allowlisted below. Anything not on the list is
 * dropped before it reaches the network, so a careless call site cannot leak a
 * field. Failures are swallowed: analytics must never break the page.
 */
import posthog from 'posthog-js'

import {
  ALLOWED_PROPS,
  ATTRIBUTION_KEYS,
  VALID,
  sanitize,
  type Attribution,
  type EventName,
} from './analytics-schema'

export * from './analytics-schema'

/* ------------------------------------------------------- configuration ---- */

const KEY = import.meta.env.PUBLIC_POSTHOG_KEY
const HOST = import.meta.env.PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'
const ENABLED = import.meta.env.PUBLIC_ANALYTICS_ENABLED !== 'false'

/**
 * Memory persistence: nothing is written to cookies or storage, which is why
 * this needs no consent banner.
 *
 * The tradeoff, and it is a real one: this is a multi-page site, so every
 * navigation starts a fresh anonymous id. Unique-visitor counts therefore
 * measure page loads rather than people, and a funnel spanning two pages will
 * not join up. The outreach funnel we care about — land, click a session,
 * register — all happens on the home page in a single page load, so it is
 * unaffected. Switch this to 'sessionStorage' for cross-page funnels; it is
 * still cookieless and still session-scoped.
 */
const PERSISTENCE = 'memory' as const

/** Honour explicit opt-outs even though nothing personal is collected. */
function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1'
}

let ready = false

/* -------------------------------------------------------- attribution ---- */

let attribution: Attribution = {}

/**
 * Reads approved campaign fields from the URL, drops anything malformed, then
 * removes them from the visible address bar. Values are held in memory only.
 */
function captureAttribution(): void {
  try {
    const url = new URL(window.location.href)
    let found = false

    for (const key of ATTRIBUTION_KEYS) {
      const raw = url.searchParams.get(key)
      if (raw === null) continue
      found = true
      if (VALID.test(raw)) attribution[key] = raw
      url.searchParams.delete(key)
    }

    // Tidy the address bar so campaign ids are not shared or bookmarked.
    if (found) {
      const clean = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : '') + url.hash
      window.history.replaceState({}, '', clean)
    }
  } catch {
    attribution = {}
  }
}

/* ----------------------------------------------------------- scrubbing ---- */

/**
 * Auto-properties PostHog adds that we refuse to send. Derived from an actual
 * payload capture, not guessed — see scripts/audit-analytics.mjs.
 */
const DENYLIST = [
  // Each of these carries the full URL or path. A story page URL contains the
  // book's title; a query string can contain anything a visitor was sent.
  '$current_url',
  '$pathname',
  '$host',
  '$referrer',
  '$referring_domain',
  '$session_entry_url',
  '$session_entry_pathname',
  '$session_entry_host',
  '$session_entry_referrer',
  '$session_entry_referring_domain',

  // The full UA string. $browser, $os and $device_type already tell us whether
  // the site works on a school Chromebook, without the fingerprint.
  '$raw_user_agent',
]

/**
 * Last line of defence, applied to every event after PostHog has assembled it.
 * The denylist above is the specific list; this catches anything a future
 * posthog-js version starts adding.
 */
function scrub(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    if (/url|referr|pathname|title|search|utm_|host$/i.test(key) && !ALLOWED_PROPS.has(key)) continue
    out[key] = value
  }
  /**
   * Two separate switches, and both are needed.
   *
   * `$ip: null` stops the address being stored as a property. It does NOT stop
   * GeoIP enrichment: PostHog resolves the request IP server-side before that
   * property is ever read, and attaches city, postal code, latitude, longitude,
   * region and timezone. On a site for 7–13 year olds, a postcode and a
   * lat/long are exactly what we must not be keeping.
   *
   * `$geoip_disable: true` is what actually turns the enrichment off.
   */
  out.$ip = null
  out.$geoip_disable = true
  return out
}

/* -------------------------------------------------------------- setup ---- */

export function init(): void {
  if (!ENABLED || !KEY || optedOut()) return
  try {
    captureAttribution()
    posthog.init(KEY, {
      api_host: HOST,
      persistence: PERSISTENCE,

      // Nothing is collected that we did not ask for by name.
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,

      /**
       * The important one. PostHog normally pulls extra bundles from its assets
       * host at runtime — the session recorder, surveys, product tours, and a
       * remote config file that can switch those on from the dashboard.
       *
       * With this false, someone toggling a setting in the PostHog UI could
       * start recording sessions on a site used by children, with no code
       * change and no review. Turning it off makes that structurally
       * impossible rather than merely configured-off.
       */
      disable_external_dependency_loading: true,
      advanced_disable_flags: true,

      // Belt and braces: each of these is also unreachable without the loader.
      disable_session_recording: true,
      disable_surveys: true,
      disable_surveys_automatic_display: true,
      disable_product_tours: true,
      disable_conversations: true,
      disable_web_experiments: true,
      enable_heatmaps: false,

      /**
       * PostHog attaches the page URL and referrer to every event by default.
       * A story page URL contains the book's title, which is a child's work, so
       * these are dropped before send. `page_group` carries what we need.
       */
      person_profiles: 'identified_only',
      property_denylist: DENYLIST,
      sanitize_properties: scrub,

      /**
       * PostHog attaches the page URL and referrer to every event by default.
       * A story page URL contains the book's title, which is a child's work, so
       * these are dropped before send. `page_group` carries what we need.
       */
    })
    ready = true
  } catch {
    ready = false
  }
}

/** Fired-once guard, so a rerender or a double click cannot inflate a metric. */
const fired = new Set<string>()

export function capture(
  event: EventName,
  props: Record<string, unknown> = {},
  options: { once?: string } = {}
): void {
  if (!ready) return
  try {
    if (options.once) {
      if (fired.has(options.once)) return
      fired.add(options.once)
    }
    posthog.capture(event, {
      schema_version: '1',
      surface: 'website',
      environment: import.meta.env.DEV ? 'preview' : 'production',
      ...sanitize(attribution as Record<string, unknown>),
      ...sanitize(props),
    })
  } catch {
    /* analytics must never break the page */
  }
}
