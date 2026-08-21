/**
 * Confirms that the DEPLOYED site really is sending events to PostHog.
 *
 *   npm run verify:live -- [origin]      default origin: https://story-sprout.org
 *
 * Unlike `npm run audit:analytics`, this does NOT block the requests — the whole
 * point is that events land in PostHog so they can be seen in Live Events. Every
 * event it fires carries `batch_id=test_internal`; filter that value out of real
 * reporting.
 *
 * By default it does not submit the sign-up form, because that appends a row to
 * the Google Sheet and emails two people. Pass `--submit` to exercise
 * `training_registration_completed` end to end; the row it creates is labelled
 * so it is obvious what to delete.
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const WebSocket = createRequire(import.meta.url)('ws')

const args = process.argv.slice(2)
const SUBMIT = args.includes('--submit')
const ORIGIN = args.find((a) => !a.startsWith('--')) ?? 'https://story-sprout.org'

// Obvious on sight in the sheet, and example.com cannot receive mail, so no
// real person is ever written down.
const TEST_REGISTRANT = {
  name: 'PostHog integration test — please delete',
  email: 'integration-test@example.com',
  org: 'Automated test — please delete',
}
const PORT_CDP = 9334
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const chrome = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new', `--remote-debugging-port=${PORT_CDP}`, '--no-first-run',
    '--user-data-dir=/tmp/story-sprout-live-check', '--window-size=1280,900', 'about:blank'],
  { stdio: 'ignore' }
)

let target
for (let i = 0; i < 80 && !target; i++) {
  await wait(250)
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT_CDP}/json/list`)).json()
    target = list.find((t) => t.type === 'page')
  } catch { /* not up yet */ }
}
if (!target) throw new Error('Chrome did not expose a debugging target')

const ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 100 * 1024 * 1024 })
await new Promise((r) => ws.on('open', r))

let nextId = 0
const pending = new Map()
const listeners = []
ws.on('message', (raw) => {
  const msg = JSON.parse(raw)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result ?? msg.error)
    pending.delete(msg.id)
  } else if (msg.method) {
    for (const fn of listeners) fn(msg)
  }
})
const cdp = (method, params = {}) =>
  new Promise((r) => { const id = ++nextId; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
const evaluate = async (expression) =>
  (await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value

await cdp('Page.enable')
await cdp('Runtime.enable')
await cdp('Network.enable')

// PostHog discards events from user agents it classifies as bots, and plain
// headless Chrome is one of them.
await cdp('Network.setUserAgentOverride', {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
})

const sent = []
const replies = []
listeners.push((msg) => {
  if (msg.method === 'Network.requestWillBeSent' && msg.params.request.url.includes('posthog.com')) {
    sent.push(msg.params.request.url)
  }
  if (msg.method === 'Network.responseReceived' && msg.params.response.url.includes('posthog.com')) {
    replies.push(`${msg.params.response.status} ${msg.params.response.url.split('?')[0]}`)
  }
})

// Stay on the page: a CTA click would navigate away before the event flushes.
await cdp('Page.addScriptToEvaluateOnNewDocument', {
  source: `addEventListener('click', (e) => e.preventDefault(), true);`,
})

async function goto(url) {
  await evaluate(`location.href = ${JSON.stringify(url)}`)
  await wait(4000)
}

console.log(`Driving ${ORIGIN} with batch_id=test_internal\n`)

/* The landing event, plus attribution. */
await goto(`${ORIGIN}/?utm_source=integration_check&utm_campaign=deploy_verify&batch_id=test_internal&outreach_id=probe01`)
const loaded = await evaluate(`!!document.querySelector('script[src*="Analytics.astro"]')`)
console.log(`  analytics module on the page : ${loaded}`)

/* Training CTA + registration started (opens the dialog; nothing is submitted). */
await evaluate(`document.querySelector('[data-session-id]')?.click(); true`)
await wait(1500)
console.log(`  sign-up dialog opened        : ${await evaluate(`!!document.querySelector('dialog[open]')`)}`)

/* Registration completed — only when explicitly asked for. */
if (SUBMIT) {
  const submitted = await evaluate(`
    const d = document.querySelector('dialog[open]');
    // Not d.querySelector('form') — the first form is the native method="dialog"
    // close button, which would just shut the dialog again.
    const f = d?.querySelector('[data-signup-form]');
    if (!f) { false } else {
      const set = (n, v) => { const el = f.querySelector('[name=' + n + ']'); if (el) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })) } };
      set('name', ${JSON.stringify(TEST_REGISTRANT.name)});
      set('email', ${JSON.stringify(TEST_REGISTRANT.email)});
      set('org', ${JSON.stringify(TEST_REGISTRANT.org)});
      f.requestSubmit();
      true
    }`)
  // Apps Script can take several seconds to append the row and send the mail.
  let message = ''
  for (let i = 0; i < 15 && !message; i++) {
    await wait(1500)
    message = await evaluate(`document.querySelector('[data-signup-status]')?.textContent?.trim() ?? ''`)
    if (message === 'Sending…') message = ''
  }
  console.log(`  form submitted               : ${submitted}`)
  console.log(`  status message               : ${message || '(never appeared)'}`)
}

/* Studio CTA. */
await evaluate(`document.querySelector('dialog[open]')?.close();
  document.querySelector('[data-cta="studio"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  true`)
await wait(2500)

/* Curriculum deck download. */
await goto(`${ORIGIN}/curriculum/`)
await evaluate(`document.querySelector('[data-cta="overview"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); true`)
await wait(4000)

console.log(`\n  requests to PostHog          : ${sent.length}`)
for (const r of [...new Set(replies)]) console.log(`    <- ${r}`)

const ok = sent.length > 0 && replies.some((r) => r.startsWith('200'))
console.log(ok
  ? '\nEvents were accepted by PostHog. Look for batch_id=test_internal in Live Events.'
  : '\nNo accepted requests. Analytics is not running on this origin.')

if (SUBMIT) {
  console.log(`\nA real registration was created. Delete the sheet row for "${TEST_REGISTRANT.email}".`)
}

ws.close(); chrome.kill()
process.exit(ok ? 0 : 1)
