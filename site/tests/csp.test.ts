/**
 * The site's CSP is served by Cloudflare from public/_headers, which nothing
 * type-checks. If the PostHog host changes and the header does not, analytics
 * fails silently in production — the events simply never arrive.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const headers = readFileSync(join(root, 'public/_headers'), 'utf8')
const csp = headers.match(/Content-Security-Policy:(.*)/)?.[1] ?? ''
const directive = (name: string) => csp.match(new RegExp(`${name} ([^;]*)`))?.[1]?.trim() ?? ''

function envHost(file: string): string | undefined {
  try {
    return readFileSync(join(root, file), 'utf8').match(/^PUBLIC_POSTHOG_HOST=(.*)$/m)?.[1]?.trim()
  } catch {
    return undefined
  }
}

describe('content security policy', () => {
  it('allows the analytics host it is actually configured with', () => {
    const host = envHost('.env') ?? envHost('.env.example') ?? 'https://us.i.posthog.com'
    assert.ok(
      directive('connect-src').includes(host),
      `connect-src is "${directive('connect-src')}" but analytics posts to ${host}`
    )
  })

  it('does not let PostHog load code from its assets host', () => {
    // analytics.ts sets disable_external_dependency_loading, which stops the
    // session recorder and surveys being fetched at runtime. This is the second
    // lock on the same door: even if that setting were reverted, the browser
    // would refuse the script.
    assert.ok(!directive('script-src').includes('posthog'), 'script-src must not allow posthog')
    assert.ok(!directive('default-src').includes('posthog'), 'default-src must not allow posthog')
  })

  it('still restricts everything else to this origin', () => {
    assert.equal(directive('default-src'), "'self'")
    assert.equal(directive('form-action'), "'self'")
    assert.equal(directive('base-uri'), "'self'")
  })
})
