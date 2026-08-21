/**
 * Content quality gates that Astro's schema validation cannot express.
 * Run against the built output: `npm run check:content` (or `npm run verify`).
 *
 * Fails the build on:
 *   - published images with missing or empty alt text
 *   - a story published without consentVerified
 *   - duplicate slugs within a collection
 *   - referenced local assets or documents that do not exist
 *   - internal links pointing at pages that were not built
 *   - leftover placeholder text
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, resolve, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const contentRoot = join(siteRoot, 'src/content')
const publicRoot = join(siteRoot, 'public')
const distRoot = join(siteRoot, 'dist')

const errors = []
const warnings = []
const fail = (m) => errors.push(m)
const warn = (m) => warnings.push(m)

/* --------------------------------------------------- frontmatter parse ---- */
// Deliberately tiny: enough for the flat scalar/list frontmatter this repo uses.
function parseFrontmatter(raw, file) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) {
    fail(`${file}: no frontmatter block`)
    return null
  }
  const data = {}
  const lines = match[1].split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim() || line.startsWith('#')) continue
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/)
    if (!kv) continue
    const [, key] = kv
    let value = kv[2].trim()

    // Folded/literal block scalars: consume the indented continuation.
    if (value === '>-' || value === '>' || value === '|' || value === '|-') {
      const parts = []
      while (i + 1 < lines.length && /^\s{2,}\S/.test(lines[i + 1])) {
        parts.push(lines[++i].trim())
      }
      value = parts.join(' ')
    } else {
      value = value.replace(/^["'](.*)["']$/, '$1')
    }

    if (value === 'true') data[key] = true
    else if (value === 'false') data[key] = false
    else if (/^-?\d+(\.\d+)?$/.test(value)) data[key] = Number(value)
    else data[key] = value
  }
  return data
}

/* ------------------------------------------------------------ collect ---- */
const collections = {}
if (existsSync(contentRoot)) {
  for (const name of readdirSync(contentRoot)) {
    const dir = join(contentRoot, name)
    if (!statSync(dir).isDirectory()) continue
    collections[name] = readdirSync(dir)
      // `_`-prefixed files are templates; the content loaders ignore them too.
      .filter((f) => !f.startsWith('_') && (f.endsWith('.md') || f.endsWith('.mdx')))
      .map((f) => ({
        slug: f.replace(/\.mdx?$/, ''),
        file: `src/content/${name}/${f}`,
        data: parseFrontmatter(readFileSync(join(dir, f), 'utf8'), `src/content/${name}/${f}`),
      }))
      .filter((e) => e.data)
  }
}

/* ------------------------------------------------------- duplicate ids ---- */
for (const [name, entries] of Object.entries(collections)) {
  const seen = new Map()
  for (const entry of entries) {
    if (seen.has(entry.slug)) fail(`${name}: duplicate slug "${entry.slug}"`)
    seen.set(entry.slug, entry.file)
  }
}

/* --------------------------------------------------- alt text + consent ---- */
const IMAGE_FIELDS = [
  ['cover', 'alt'],
  ['thumbnail', 'thumbnailAlt'],
  ['heroImage', 'heroAlt'],
  ['image', 'imageAlt'],
]

for (const [name, entries] of Object.entries(collections)) {
  for (const { file, data } of entries) {
    const live = data.published === true

    for (const [imageKey, altKey] of IMAGE_FIELDS) {
      const image = data[imageKey]
      if (!image) continue
      const alt = data[altKey]
      if (live && (typeof alt !== 'string' || alt.trim() === '')) {
        fail(`${file}: "${imageKey}" is published without ${altKey}`)
      }
      // Local assets must actually exist.
      if (typeof image === 'string' && image.startsWith('/')) {
        if (!existsSync(join(publicRoot, image))) fail(`${file}: ${imageKey} not found in public${image}`)
      }
    }

    for (const key of ['pdf', 'pdfUrl', 'teacherNotesUrl']) {
      const value = data[key]
      if (typeof value === 'string' && value.startsWith('/') && !existsSync(join(publicRoot, value))) {
        fail(`${file}: ${key} not found in public${value}`)
      }
    }

    if (name === 'stories') {
      if (data.consentVerified === undefined) {
        fail(`${file}: stories must set consentVerified explicitly`)
      }
      if (live && data.consentVerified !== true) {
        warn(`${file}: published but consent not verified — excluded from production`)
      }
      if (data.consentVerified === false && !data.consentNote) {
        fail(`${file}: consentVerified is false without a consentNote explaining why`)
      }
      // authorDisplay cannot mask names that are burned into the artwork or the
      // PDF. A book carrying visible names may only go live if this exact file
      // was already public.
      const isLive = live && data.consentVerified === true
      const namesCleared = data.priorPublicRelease === true || data.namesApproved === true
      if (isLive && data.coverShowsNames === true && !namesCleared) {
        fail(
          `${file}: cover/PDF shows children's names but neither priorPublicRelease nor ` +
            `namesApproved is set. Redact the names, or record the approval.`
        )
      }
      if (isLive && data.coverShowsNames === true) {
        warn(`${file}: LIVE with children's first names visible in the cover art and PDF`)
      }
    }

    if (name === 'research') {
      if (live && data.status === undefined) {
        fail(`${file}: research item published without a status`)
      }
      // A manuscript still under review is normally stamped "do not distribute",
      // so hosting one has to be an explicit decision by its authors.
      const underReview = data.status === 'submitted' || data.status === 'under-review'
      const hostedHere = typeof data.pdfUrl === 'string' && data.pdfUrl.startsWith('/')
      if (underReview && hostedHere && data.distributionApproved !== true) {
        fail(
          `${file}: status is "${data.status}" and the manuscript is hosted at ${data.pdfUrl}, ` +
            `but distributionApproved is not set. Confirm with the authors first.`
        )
      }
      if (underReview && hostedHere) {
        warn(`${file}: serving a manuscript that is still under review (authors approved)`)
      }
      if (underReview && data.officialUrl) {
        warn(`${file}: status is "${data.status}" but an officialUrl is set — check it is not implying publication`)
      }
    }

  }
}

/* -------------------------------------------- placeholder / lorem sweep ---- */
const PLACEHOLDERS = [/lorem ipsum/i, /\bTBD\b/, /\bXXX\b/, /example\.com/i, /your-email@/i]
for (const [, entries] of Object.entries(collections)) {
  for (const { file } of entries) {
    const raw = readFileSync(join(siteRoot, file), 'utf8')
    for (const pattern of PLACEHOLDERS) {
      if (pattern.test(raw)) fail(`${file}: contains placeholder text matching ${pattern}`)
    }
  }
}

/* ------------------------------------------------ built-output link check ---- */
if (existsSync(distRoot)) {
  const pages = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (extname(name) === '.html') pages.push(full)
    }
  }
  walk(distRoot)

  const exists = (urlPath) => {
    const clean = urlPath.split('#')[0].split('?')[0]
    if (clean === '/') return existsSync(join(distRoot, 'index.html'))
    const asFile = join(distRoot, clean)
    if (existsSync(asFile) && statSync(asFile).isFile()) return true
    return existsSync(join(distRoot, clean, 'index.html'))
  }

  for (const page of pages) {
    const html = readFileSync(page, 'utf8')
    const rel = page.replace(distRoot, 'dist')
    for (const m of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
      const target = m[1]
      if (!exists(target)) fail(`${rel}: broken internal link → ${target}`)
    }
  }
  console.log(`Checked internal links across ${pages.length} built pages.`)

  // A held-back book must not be sitting in dist/ as an unlinked but downloadable
  // file. scripts/prune-dist.mjs removes them; this proves it actually ran.
  if (process.env.PUBLIC_SHOW_PENDING !== 'true') {
    for (const entry of collections.stories ?? []) {
      const live = entry.data.published === true && entry.data.consentVerified === true
      if (live) continue
      for (const asset of [
        `documents/stories/${entry.slug}.pdf`,
        `assets/story-covers/${entry.slug}.webp`,
        `assets/story-covers/${entry.slug}.jpg`,
      ]) {
        if (existsSync(join(distRoot, asset))) {
          fail(
            `dist/${asset}: "${entry.slug}" is not consent-verified but its file is in the ` +
              `build output and would be publicly downloadable. Run \`npm run build\`.`
          )
        }
      }
    }
  }
} else {
  warn('dist/ not found — run `npm run build` first to include the link check.')
}

/* ------------------------------------------------------------- report ---- */
for (const w of warnings) console.warn(`  warn  ${w}`)
for (const e of errors) console.error(`  FAIL  ${e}`)

console.log(
  `\n${errors.length} error(s), ${warnings.length} warning(s) across ` +
    `${Object.values(collections).flat().length} content files.`
)
process.exit(errors.length > 0 ? 1 : 0)
