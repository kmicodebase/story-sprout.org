/// <reference types="@cloudflare/workers-types" />
/**
 * Webinar sign-up endpoint (Cloudflare Pages Function).
 *
 * Thin proxy in front of a Google Apps Script bound to the sign-up spreadsheet.
 * That script appends the row AND emails both organizers, so nothing is stored
 * on Cloudflare and no third-party email service is involved.
 *
 * This layer still exists for three reasons the browser cannot cover:
 *   - it keeps the Apps Script URL and shared token off the public page,
 *   - it validates and length-caps input before anything reaches the sheet,
 *   - it drops honeypot submissions without a round trip.
 *
 * Configure on the Pages project (Settings → Variables):
 *   SIGNUP_SCRIPT_URL    the Apps Script /exec URL
 *   SIGNUP_SCRIPT_TOKEN  the SHARED_TOKEN value from that script
 * See docs/google-apps-script/signup.gs for the script and setup steps.
 *
 * GET  /api/signup -> { configured }
 * POST /api/signup -> { ok, stored, emailed } | { error }
 */

interface Env {
  SIGNUP_SCRIPT_URL?: string
  SIGNUP_SCRIPT_TOKEN?: string
}

const LIMITS = { name: 120, email: 200, org: 160, session: 120 }

/**
 * Upstream failures are returned as 200 with ok:false rather than 5xx.
 * Cloudflare replaces a 5xx from a Pages Function with its own "error code: 502"
 * page, which would swallow this message and leave the visitor with nothing
 * actionable. The client checks `ok`, not the status.
 */
const upstreamFailure = () =>
  json({
    ok: false,
    error: "Sorry — we couldn't record that just now. Please email kmi.aistorybooks@gmail.com.",
  })

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

// The form only appears once sign-ups can actually be recorded.
export const onRequestGet: PagesFunction<Env> = ({ env }) =>
  json({ configured: Boolean(env.SIGNUP_SCRIPT_URL) })

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.SIGNUP_SCRIPT_URL) {
    return json({ error: 'Sign-up is not switched on yet.' }, 503)
  }

  const type = request.headers.get('content-type') ?? ''
  const raw: Record<string, unknown> = type.includes('application/json')
    ? ((await request.json().catch(() => ({}))) as Record<string, unknown>)
    : Object.fromEntries(await request.formData())

  const field = (k: string, max: number) => String(raw[k] ?? '').trim().slice(0, max)

  // Honeypot: a real person never fills a field they cannot see.
  if (field('company', 100) !== '') return json({ ok: true, stored: false, emailed: false })

  const name = field('name', LIMITS.name)
  const email = field('email', LIMITS.email)
  const org = field('org', LIMITS.org)
  const sessionId = field('sessionId', LIMITS.session)
  const sessionLabel = field('sessionLabel', LIMITS.session)

  if (!name) return json({ error: 'Please add your name.' }, 400)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json({ error: 'Please check the email address.' }, 400)
  }
  if (!sessionId) return json({ error: 'Please choose a session.' }, 400)

  let result: { ok?: boolean; stored?: boolean; emailed?: boolean; error?: string }
  try {
    // Apps Script answers with a 302 to googleusercontent; fetch follows it.
    const res = await fetch(env.SIGNUP_SCRIPT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: env.SIGNUP_SCRIPT_TOKEN ?? '',
        name,
        email,
        org,
        sessionId,
        sessionLabel,
      }),
    })

    if (!res.ok) {
      // 401 here almost always means the Apps Script web app is not deployed
      // with "Who has access: Anyone".
      console.error('apps script http', res.status, (await res.text()).slice(0, 400))
      return upstreamFailure()
    }

    result = (await res.json().catch(() => ({}))) as typeof result
  } catch (err) {
    console.error('apps script unreachable', err)
    return upstreamFailure()
  }

  // Never report success for something the sheet did not accept.
  if (!result?.ok) {
    console.error('apps script rejected', result?.error)
    return upstreamFailure()
  }

  return json({ ok: true, stored: true, emailed: Boolean(result.emailed) })
}
