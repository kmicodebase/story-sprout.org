/**
 * Verifies what analytics actually puts on the wire.
 *
 * Serves the built site, drives it in headless Chrome, intercepts every request
 * bound for PostHog and blocks it, then asserts on the payloads. Nothing leaves
 * the machine, so this is safe to run against the production token.
 *
 *   npm run audit:analytics
 *
 * The brief this implements requires a payload audit before deploying. Re-run it
 * after changing analytics.ts, adding a call site, or upgrading posthog-js —
 * posthog-js adds auto-properties between versions, and the denylist in
 * analytics.ts was derived from a real capture rather than from documentation.
 */
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const WebSocket = createRequire(import.meta.url)('ws')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const PORT_CDP = 9333

const GREEN = '[32m'
const RED = '[31m'
const OFF = '[0m'

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.pdf': 'application/pdf', '.xml': 'application/xml',
  '.json': 'application/json', '.woff2': 'font/woff2',
}

const failures = []
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function check(ok, label, detail = '') {
  console.log(`  ${ok ? GREEN + 'PASS' + OFF : RED + 'FAIL' + OFF}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(label)
}

/* ----------------------------------------------------------------- server -- */

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)

  // Stand in for the Pages Function, so a registration can actually succeed.
  if (path === '/api/signup') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(req.method === 'POST'
      ? { ok: true, stored: true, emailed: true }
      : { configured: true }))
    return
  }

  try {
    const file = path.endsWith('/') ? `${path}index.html` : path
    const body = await readFile(join(DIST, file))
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end('not found')
  }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const origin = `http://127.0.0.1:${server.address().port}`

/* ---------------------------------------------------------------- browser -- */

const chrome = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new', `--remote-debugging-port=${PORT_CDP}`, '--no-first-run',
    '--user-data-dir=/tmp/story-sprout-audit', '--window-size=1280,900', 'about:blank'],
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

const ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 200 * 1024 * 1024 })
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

const escaped = []
listeners.push((msg) => {
  if (msg.method === 'Network.requestWillBeSent' && msg.params.request.url.includes('posthog')) {
    escaped.push(msg.params.request.url)
  }
})

// PostHog discards events from user agents it classifies as bots, and
// "HeadlessChrome" is one of them. Present an ordinary desktop UA.
await cdp('Network.setUserAgentOverride', {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
})

/**
 * Runs before any page script. Captures whatever PostHog hands to the network,
 * in whatever form, gunzips it if necessary, and answers locally so nothing is
 * actually sent. Also suppresses navigation, since a CTA click would otherwise
 * leave the page and take the captured payloads with it.
 */
const SHIM = `
  window.__ph = [];
  addEventListener('click', (e) => e.preventDefault(), true);

  const isPH = (u) => String(u).includes('posthog.com');
  async function record(body, url) {
    try {
      let text;
      if (body == null) text = '';
      else if (typeof body === 'string') text = body;
      else if (body instanceof URLSearchParams) text = body.toString();
      else {
        const bytes = new Uint8Array(body instanceof Blob ? await body.arrayBuffer() : body);
        text = bytes[0] === 0x1f && bytes[1] === 0x8b
          ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
          : new TextDecoder().decode(bytes);
      }
      if (text.startsWith('data=')) text = atob(decodeURIComponent(text.slice(5)));
      window.__ph.push({ url: String(url), text });
    } catch (e) {
      window.__ph.push({ url: String(url), text: 'DECODE_FAIL: ' + e.message });
    }
  }

  const realFetch = window.fetch;
  window.fetch = function (input, opts) {
    const url = typeof input === 'string' ? input : input?.url;
    if (isPH(url)) {
      record(opts?.body, url);
      return Promise.resolve(new Response('{"status":1}', { status: 200, headers: { 'content-type': 'application/json' } }));
    }
    return realFetch.apply(this, arguments);
  };

  const realBeacon = navigator.sendBeacon?.bind(navigator);
  if (realBeacon) navigator.sendBeacon = function (url, data) {
    if (isPH(url)) { record(data, url); return true }
    return realBeacon(url, data);
  };

  const realOpen = XMLHttpRequest.prototype.open;
  const realSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this.__url = u; return realOpen.apply(this, arguments) };
  XMLHttpRequest.prototype.send = function (body) {
    if (isPH(this.__url)) { record(body, this.__url); return }
    return realSend.apply(this, arguments);
  };
`

let shimHandle
async function installShim(extra = '') {
  if (shimHandle) await cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: shimHandle })
  shimHandle = (await cdp('Page.addScriptToEvaluateOnNewDocument', { source: extra + SHIM })).identifier
}

async function goto(url) {
  await evaluate(`location.href = ${JSON.stringify(url)}`)
  await wait(2200)
}

/** Reads the intercepted payloads out of the page and flattens them to events. */
async function drain() {
  await wait(4000)
  const raw = JSON.parse((await evaluate('JSON.stringify(window.__ph || [])')) ?? '[]')
  const events = []
  for (const req of raw) {
    let body
    try { body = JSON.parse(req.text) } catch { continue }
    for (const item of Array.isArray(body) ? body : body.batch ?? [body]) {
      if (item?.event) events.push(item)
    }
  }
  await evaluate('window.__ph = []')
  return events
}

const custom = (e) =>
  Object.fromEntries(Object.entries(e?.properties ?? {})
    .filter(([k]) => !k.startsWith('$') && k !== 'distinct_id' && k !== 'token'))

/* ------------------------------------------------------ 1. outreach funnel -- */

console.log('\n1. Home page, arriving from an outreach link')
await installShim()

// Deliberately hostile: a personal detail in an unrelated param, and markup in
// one of ours.
await goto(`${origin}/?utm_source=newsletter&utm_campaign=sept6_launch&batch_id=test_internal`
  + `&outreach_id=k3f9x2ab&email=ada@example.com&utm_content=${encodeURIComponent('<script>alert(1)</script>')}`)

const cleanedUrl = await evaluate('location.href')
check(!/utm_|batch_id|outreach_id/.test(cleanedUrl), 'campaign params stripped from the address bar', cleanedUrl.replace(origin, ''))

await evaluate(`document.querySelector('[data-session-id]')?.click(); true`)
await wait(600)
check(await evaluate(`!!document.querySelector('dialog[open]')`), 'session button opens the sign-up dialog')

await evaluate(`
  const d = document.querySelector('dialog[open]');
  // Not d.querySelector('form') — the first form in the dialog is the native
  // method="dialog" close button, which would just shut it again.
  const f = d.querySelector('[data-signup-form]');
  const set = (n, v) => { const el = f?.querySelector('[name=' + n + ']'); if (el) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })) } };
  set('name', 'Ada Lovelace'); set('email', 'ada@example.com'); set('org', 'Newark Salvation Army');
  f.requestSubmit();
  true`)
await wait(2500)
check(
  /signed up/i.test(await evaluate(`document.querySelector('[data-signup-form]')?.closest('dialog')?.textContent ?? ''`)),
  'the sign-up reports success'
)

await evaluate(`document.querySelector('dialog[open]')?.close();
  document.querySelector('[data-cta="studio"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  true`)

const funnel = await drain()
const names = funnel.map((e) => e.event)
console.log(`  events: ${names.join(', ') || '(none)'}`)

for (const expected of ['educator_landing_viewed', 'training_cta_clicked', 'training_registration_started', 'training_registration_completed', 'studio_cta_clicked']) {
  check(names.includes(expected), `fires ${expected}`)
}
check(new Set(names).size === names.length, 'no event fired twice')

const dump = JSON.stringify(funnel)
for (const [label, needle] of [
  ['no name', 'Ada'], ['no email address', 'ada@example.com'],
  ['no organization', 'Salvation'], ['no markup from utm_content', '<script'],
  ['no unrelated query param', 'email='],
]) {
  check(!dump.includes(needle), label)
}

const landing = funnel.find((e) => e.event === 'educator_landing_viewed')
check(custom(landing).utm_source === 'newsletter', 'valid attribution is kept', JSON.stringify(custom(landing)))
check(!('utm_content' in custom(landing)), 'malformed attribution is dropped')

const urlProps = Object.keys(funnel[0]?.properties ?? {}).filter((k) => /url|referr|pathname|host|raw_user_agent/i.test(k))
check(urlProps.length === 0, 'no URL, referrer or user-agent auto-properties', urlProps.join(', ') || 'none present')
check(funnel.length > 0 && funnel.every((e) => e.properties?.$ip === null), 'IP collection disabled ($ip: null)')
check(funnel.length > 0 && funnel.every((e) => e.properties?.$is_identified === false), 'no identified person')
check(!dump.includes('$session_recording'), 'no session recording payload')
check(escaped.length === 0, 'no PostHog request escaped interception', escaped.join(', ') || 'none')

/* ------------------------------------------------------- 2. a story page ---- */

console.log('\n2. A story page, where the URL contains a book title')
const slug = 'the-girl-who-was-half-cat'
await goto(`${origin}/stories/${slug}/`)
await evaluate(`document.querySelector('[data-cta="studio"], a[href*="workshop-plugin"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); true`)
const story = await drain()
check(!JSON.stringify(story).includes(slug), 'the book title never reaches PostHog')
check(!story.some((e) => e.event === 'educator_landing_viewed'), 'landing event does not fire off the home page')
if (story.length) console.log(`  events: ${story.map((e) => e.event).join(', ')}`)

/* --------------------------------------------------------- 3. opting out ---- */

console.log('\n3. A visitor whose browser sends Global Privacy Control')
await installShim(`Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true });`)
await goto(`${origin}/?utm_source=newsletter`)
await evaluate(`document.querySelector('[data-session-id]')?.click(); true`)
await wait(600)
const optedOut = await drain()
check(optedOut.length === 0, 'nothing is captured at all', `${optedOut.length} event(s)`)
check(await evaluate(`!!document.querySelector('dialog[open]')`), 'the site still works with analytics off')

/* --------------------------------------------------------------- verdict ---- */

console.log(failures.length === 0
  ? `\n${GREEN}All payload checks passed.${OFF}`
  : `\n${RED}${failures.length} check(s) failed:${OFF}\n  - ${failures.join('\n  - ')}`)

ws.close(); chrome.kill(); server.close()
process.exit(failures.length === 0 ? 0 : 1)
