/**
 * Removes consent-pending children's work from the build output.
 *
 * WHY THIS EXISTS: `npm run assets` writes every storybook cover and PDF into
 * public/ so the team can review them on the dev server, and Astro copies all of
 * public/ into dist/. The consent gate in src/lib/content.ts only controls which
 * *pages* render — it does nothing about the files themselves. Without this
 * step, a book held back for consent review still ships to the web at a
 * guessable URL, unlinked but fully downloadable. That would defeat the entire
 * point of the gate.
 *
 * Runs automatically as part of `npm run build`.
 *
 * Set PUBLIC_SHOW_PENDING=true to keep them — only for a private review deploy.
 */
import { readdirSync, readFileSync, existsSync, rmSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(siteRoot, 'dist')
const storiesDir = join(siteRoot, 'src/content/stories')

if (!existsSync(dist)) {
  console.error('prune-dist: dist/ not found — run `astro build` first.')
  process.exit(1)
}

if (process.env.PUBLIC_SHOW_PENDING === 'true') {
  console.warn(
    'prune-dist: PUBLIC_SHOW_PENDING=true — consent-pending work is being KEPT in dist/.\n' +
      '            Only deploy this to a private review URL.'
  )
  process.exit(0)
}

const flag = (raw, key) => new RegExp(`^${key}:\\s*(true|false)\\s*$`, 'm').exec(raw)?.[1] === 'true'

// Allowlist, not denylist: build the set of books that are genuinely live, then
// delete anything else. A PDF dropped into the source folder without a content
// entry would otherwise sail straight through to the web, unlinked but public.
const live = new Set()
for (const file of readdirSync(storiesDir)) {
  if (file.startsWith('_') || !file.endsWith('.md')) continue
  const slug = file.replace(/\.md$/, '')
  const raw = readFileSync(join(storiesDir, file), 'utf8')
  if (flag(raw, 'published') && flag(raw, 'consentVerified')) live.add(slug)
}

let removed = 0
const sweep = (dir, slugOf) => {
  const full = join(dist, dir)
  if (!existsSync(full)) return
  for (const name of readdirSync(full)) {
    const slug = slugOf(name)
    if (slug === null || live.has(slug)) continue
    rmSync(join(full, name))
    console.log(`  removed  ${dir}/${name}`)
    removed++
  }
}

sweep('documents/stories', (n) => (n.endsWith('.pdf') ? n.replace(/\.pdf$/, '') : null))
sweep('assets/story-covers', (n) =>
  /\.(webp|jpg)$/.test(n) ? n.replace(/\.(webp|jpg)$/, '') : null
)

console.log(
  removed === 0
    ? `prune-dist: nothing to remove — ${live.size} approved book(s) in dist/.`
    : `prune-dist: removed ${removed} file(s) not belonging to an approved book.`
)

// Cloudflare Pages rejects any single file over 25 MB, so catch it here rather
// than part-way through an upload.
const LIMIT = 25 * 1024 * 1024
const oversized = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const info = statSync(full)
    if (info.isDirectory()) walk(full)
    else if (info.size > LIMIT) oversized.push([full.replace(dist, ''), info.size])
  }
}
walk(dist)

if (oversized.length > 0) {
  console.error('\nprune-dist: file(s) exceed the 25 MB Cloudflare Pages limit:')
  for (const [path, size] of oversized) {
    console.error(`  ${(size / 1024 / 1024).toFixed(1)} MB  ${path}`)
  }
  console.error('Compress these before deploying — the upload will be rejected otherwise.')
  process.exit(1)
}

/**
 * `.env` is untracked, so a fresh clone builds with no PostHog key and ships
 * with analytics silently switched off. That is the right default for a secret,
 * but a silent one — someone restoring from git and deploying would be left
 * wondering weeks later why the funnel went flat. Say it at build time instead.
 *
 * This runs in plain node rather than under Astro, so .env has to be read here;
 * Astro loads it for the bundle but not for this process.
 */
function envKey() {
  if (process.env.PUBLIC_POSTHOG_KEY) return process.env.PUBLIC_POSTHOG_KEY
  try {
    const file = readFileSync(join(siteRoot, '.env'), 'utf8')
    return file.match(/^PUBLIC_POSTHOG_KEY=(.+)$/m)?.[1]?.trim()
  } catch {
    return undefined
  }
}

function envDisabled() {
  if (process.env.PUBLIC_ANALYTICS_ENABLED === 'false') return true
  try {
    const file = readFileSync(join(siteRoot, '.env'), 'utf8')
    return file.match(/^PUBLIC_ANALYTICS_ENABLED=(.+)$/m)?.[1]?.trim() === 'false'
  } catch {
    return false
  }
}

if (envDisabled()) {
  console.log('prune-dist: analytics is off for this build (PUBLIC_ANALYTICS_ENABLED=false).')
} else if (!envKey()) {
  console.warn(
    'prune-dist: WARNING — no PUBLIC_POSTHOG_KEY, so this build sends no analytics.\n' +
    '            Copy .env.example to .env and fill it in before deploying, or set\n' +
    '            PUBLIC_ANALYTICS_ENABLED=false to make the omission deliberate.'
  )
}
