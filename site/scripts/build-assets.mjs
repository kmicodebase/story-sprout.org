/**
 * Regenerates every web-ready image in public/assets from the untouched source
 * material in the parent folder. Safe to re-run; it only ever writes into
 * public/assets and public/documents.
 *
 * Requires `pdftoppm` (poppler) on PATH for storybook covers.
 *   brew install poppler
 *
 * Run: npm run assets
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, copyFileSync, rmSync, existsSync, statSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'

const here = dirname(fileURLToPath(import.meta.url))
const siteRoot = resolve(here, '..')
const sourceRoot = resolve(siteRoot, '..')
const tmp = resolve(siteRoot, '.asset-tmp')

const out = (...p) => join(siteRoot, 'public', ...p)
const src = (...p) => join(sourceRoot, ...p)

const ensure = (d) => mkdirSync(d, { recursive: true })
;[
  out('assets/brand'),
  out('assets/illustrations'),
  out('assets/story-covers'),
  out('assets/curriculum-covers'),
  out('documents/curriculum'),
  out('documents/stories'),
  out('documents/research'),
].forEach(ensure)

// sharp drops EXIF/GPS unless withMetadata() is called, so every image written
// here is stripped of camera and location metadata by construction.

/* ---------------------------------------------------------------- hero ---- */
// Homepage hero. Supplied by the project team as a full-resolution original
// (1672×941), so unlike the earlier crop-from-the-mockup version this needs no
// reconstruction — just resizing and re-encoding. The PNG twin exists for the
// Open Graph card, which several social platforms will not accept as WebP.
async function hero() {
  const source = src('illustrations/hero-classroom.png')
  if (!existsSync(source)) return console.warn('! hero: illustrations/hero-classroom.png missing, skipped')
  // 1400px covers a ~700px display slot at 2× without upscaling the original.
  const base = sharp(source).resize({ width: 1400, withoutEnlargement: true })
  await base.clone().webp({ quality: 86 }).toFile(out('assets/illustrations/hero-classroom.webp'))
  await base.clone().png({ compressionLevel: 9 }).toFile(out('assets/illustrations/hero-classroom.png'))
  console.log('✓ hero illustration')

  // Optional: the training band renders an illustration if one exists.
  const webinar = src('illustrations/webinar-training.png')
  if (!existsSync(webinar)) {
    console.log('· webinar illustration not supplied, training band runs without one')
    return
  }
  const band = sharp(webinar).resize({ width: 1400, withoutEnlargement: true })
  await band.clone().webp({ quality: 86 }).toFile(out('assets/illustrations/webinar-training.webp'))
  await band.clone().png({ compressionLevel: 9 }).toFile(out('assets/illustrations/webinar-training.png'))
  console.log('✓ webinar illustration')
}

/* ------------------------------------------------------- story covers ---- */
// Storybook PDFs have no separate cover image, so page 1 is rendered to an
// image. Pages are letterboxed (not cropped) into a 3:2 card so a cover with
// its title near an edge never loses the title.
const CARD = { w: 1200, h: 800 }
const CARD_BG = { r: 246, g: 242, b: 255 } // --color-lavender-soft

async function storyCovers() {
  const groups = [
    { dir: 'summer 2025', slugPrefix: '' },
    { dir: 'summer 2026', slugPrefix: '' },
  ]
  rmSync(tmp, { recursive: true, force: true })
  ensure(tmp)

  for (const g of groups) {
    const dir = src(g.dir)
    if (!existsSync(dir)) continue
    for (const file of readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pdf'))) {
      const slug = slugify(file.replace(/\.pdf$/i, ''))
      const stem = join(tmp, slug)
      execFileSync('pdftoppm', ['-png', '-f', '1', '-l', '1', '-r', '110', join(dir, file), stem])
      // pdftoppm suffixes the page number with variable zero-padding
      const rendered = readdirSync(tmp).find((f) => f.startsWith(slug + '-'))
      if (!rendered) {
        console.warn(`! ${slug}: page 1 did not render, skipped`)
        continue
      }
      const page = sharp(join(tmp, rendered)).resize({
        ...{ width: CARD.w, height: CARD.h },
        fit: 'contain',
        background: CARD_BG,
      })
      await page.clone().webp({ quality: 86 }).toFile(out('assets/story-covers', `${slug}.webp`))
      await page.clone().jpeg({ quality: 84, mozjpeg: true }).toFile(out('assets/story-covers', `${slug}.jpg`))

      await publishStoryPdf(join(dir, file), out('documents/stories', `${slug}.pdf`), slug)
      console.log(`✓ story ${slug}`)
    }
  }
  rmSync(tmp, { recursive: true, force: true })
}

/* ------------------------------------------------ storybook PDF sizing ---- */
// Cloudflare Pages rejects any file over 25 MB. The workshop storybooks store
// each page as one lightly-compressed full-page image, which puts some of them
// well over that. Re-encoding each page as JPEG at its NATIVE pixel width — no
// downsampling — brings a 37 MB book under 3 MB with no visible loss.
//
// Only applied to books that need it; smaller PDFs are copied through untouched
// so their original text layer and structure survive.
const PDF_SIZE_LIMIT = 20 * 1024 * 1024 // headroom under Cloudflare's 25 MB
const PAGE_WIDTH_PX = 1600
const JPEG_QUALITY = 82

async function publishStoryPdf(from, to, slug) {
  if (statSync(from).size <= PDF_SIZE_LIMIT) {
    copyFileSync(from, to)
    return
  }

  const work = join(tmp, `pdf-${slug}`)
  rmSync(work, { recursive: true, force: true })
  ensure(work)

  execFileSync('pdftoppm', [
    '-jpeg',
    '-jpegopt', `quality=${JPEG_QUALITY}`,
    '-scale-to-x', String(PAGE_WIDTH_PX),
    '-scale-to-y', '-1',
    from,
    join(work, 'page'),
  ])

  const pages = readdirSync(work)
    .filter((f) => f.endsWith('.jpg'))
    // pdftoppm zero-pads inconsistently, so sort numerically, not lexically.
    .sort((a, b) => Number(a.match(/(\d+)\.jpg$/)[1]) - Number(b.match(/(\d+)\.jpg$/)[1]))

  if (pages.length === 0) {
    console.warn(`! ${slug}: could not render pages, copying original`)
    copyFileSync(from, to)
    rmSync(work, { recursive: true, force: true })
    return
  }

  const doc = await PDFDocument.create()
  doc.setTitle(slug)
  for (const page of pages) {
    const jpeg = await doc.embedJpg(readFileSync(join(work, page)))
    const sheet = doc.addPage([jpeg.width, jpeg.height])
    sheet.drawImage(jpeg, { x: 0, y: 0, width: jpeg.width, height: jpeg.height })
  }
  writeFileSync(to, await doc.save())
  rmSync(work, { recursive: true, force: true })

  const before = (statSync(from).size / 1024 / 1024).toFixed(1)
  const after = (statSync(to).size / 1024 / 1024).toFixed(1)
  console.log(`  recompressed ${slug}: ${before} MB → ${after} MB (${pages.length} pages)`)
}

/* -------------------------------------------------- curriculum covers ---- */
// The cover images themselves are produced by scripts/build-curriculum-covers.mjs
// (`npm run covers`) and committed, because they need headless Chrome to render
// real type. This step only carries the PDFs across.
function curriculum() {
  const dir = src('curriculum')
  if (!existsSync(dir)) return
  for (const file of readdirSync(dir)) {
    const p = file.match(/session\s*(\d+)\.pdf$/i)
    if (p) copyFileSync(join(dir, file), out('documents/curriculum', `session-${p[1]}.pdf`))
  }
}

/* ------------------------------------------------------------ research ---- */
// Copied only because the authors asked for the manuscript to be downloadable.
// Anything added here is served publicly, so a paper still under review belongs
// here only with the authors' explicit say-so — see docs/PRIVACY_REVIEW.md and
// the distributionApproved flag in src/content.config.ts.
const RESEARCH_DOCS = [['paper-platform.pdf', 'story-sprout-picture-book-studio.pdf']]

function research() {
  for (const [from, to] of RESEARCH_DOCS) {
    if (!existsSync(src(from))) {
      console.warn(`! research: ${from} not found, skipped`)
      continue
    }
    copyFileSync(src(from), out('documents/research', to))
    console.log(`✓ research ${to}`)
  }
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

await hero()
await storyCovers()
curriculum()
research()
/* ---------------------------------------------------------- manifest ---- */
// Every generated asset keeps a stable filename, so a regenerated image would
// otherwise sit behind Cloudflare's 24h cache for a day. Hashing the contents
// into a ?v= query gives changed files a new URL — a cache miss — while
// unchanged files stay cached.
function writeManifest() {
  const manifest = {}
  const walk = (dir, prefix) => {
    if (!existsSync(dir)) return
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full, `${prefix}/${name}`)
      else manifest[`${prefix}/${name}`] =
        createHash('sha1').update(readFileSync(full)).digest('hex').slice(0, 8)
    }
  }
  walk(out('assets'), '/assets')
  walk(out('documents'), '/documents')

  const target = join(siteRoot, 'src/lib/asset-manifest.json')
  writeFileSync(target, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`✓ asset manifest (${Object.keys(manifest).length} files)`)
}

writeManifest()

console.log('\nAssets rebuilt into public/. Source material was not modified.')
