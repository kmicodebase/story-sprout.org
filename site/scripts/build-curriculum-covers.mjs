/**
 * Curriculum cover art.
 *
 * These stand in for the decks' own title slides on the website. They are laid
 * out as document covers — session number, title, guiding question, audience —
 * rather than illustrations, because that is what an educator scans when
 * judging whether a resource is worth their time.
 *
 * Rendered through headless Chrome so they use the real Nunito face the rest of
 * the site uses. Run on demand: `npm run covers` (needs Google Chrome).
 * The output is committed, so a normal `npm run assets` / build does not need it.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tmp = join(siteRoot, '.cover-tmp')
const outDir = join(siteRoot, 'public/assets/curriculum-covers')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const SESSIONS = [
  { n: 1, title: 'Making Your Own Picture Book', question: 'What are we making, and how does it work?' },
  { n: 2, title: 'Saying Exactly What You Mean', question: 'How do we describe a scene so the picture matches?' },
  { n: 3, title: 'One Look, Page After Page', question: 'How do we keep characters and places looking the same?' },
  { n: 4, title: 'Shaping the Story', question: 'How do we give a story a beginning, middle, and end?' },
]

const AUDIENCE = 'Ages 7–13'
const VERSION = 'July 2025'

const page = ({ n, title, question }) => `<!doctype html>
<meta charset="utf-8">
<style>__FONT__</style>
<style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 900px; height: 600px; }
  body {
    font-family: 'Nunito Variable', system-ui, sans-serif;
    background: #fffdfa;
    color: #3d312b;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 58px 64px 52px;
    border-bottom: 10px solid #7653c6;
  }
  /* Restrained brand shape, well behind the text. */
  .wash {
    position: absolute; right: -150px; top: -170px;
    width: 520px; height: 520px; border-radius: 50%;
    background: #f2ecfd;
  }
  .wash2 {
    position: absolute; right: 40px; bottom: -230px;
    width: 380px; height: 380px; border-radius: 50%;
    background: #f7f4fe;
  }
  .inner { position: relative; display: flex; flex-direction: column; height: 100%; }
  header { display: flex; align-items: center; justify-content: space-between; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand span { font-weight: 800; font-size: 25px; color: #6a48b8; letter-spacing: -0.01em; }
  .kicker {
    font-size: 14px; font-weight: 800; letter-spacing: 0.16em;
    text-transform: uppercase; color: #8f7fa8;
  }
  .num {
    margin-top: 52px;
    font-size: 15px; font-weight: 800; letter-spacing: 0.2em;
    text-transform: uppercase; color: #7653c6;
  }
  h1 {
    margin-top: 14px;
    font-size: 58px; line-height: 1.08; font-weight: 800;
    letter-spacing: -0.02em; max-width: 15ch;
  }
  .rule { margin-top: 30px; width: 92px; height: 6px; border-radius: 3px; background: #8f6bd8; }
  .q { margin-top: 26px; font-size: 25px; line-height: 1.4; color: #6f655f; max-width: 22ch; }
  footer {
    margin-top: auto; display: flex; gap: 14px; align-items: center;
    font-size: 17px; font-weight: 700; color: #6f655f;
  }
  .dot { width: 5px; height: 5px; border-radius: 50%; background: #cdbde9; }
</style>
<div class="wash"></div><div class="wash2"></div>
<div class="inner">
  <header>
    <div class="brand">
      <svg width="30" height="30" viewBox="0 0 40 40" aria-hidden="true">
        <rect x="5" y="8" width="14" height="25" rx="2.5" fill="#7653c6"></rect>
        <rect x="18" y="8" width="14" height="25" rx="2.5" fill="#a98ae6"></rect>
        <path d="M19 8v25" stroke="#fffdfa" stroke-width="1.6" stroke-linecap="round"></path>
      </svg>
      <span>Story Sprout</span>
    </div>
    <div class="kicker">Curriculum</div>
  </header>

  <div class="num">Session ${n}</div>
  <h1>${title}</h1>
  <div class="rule"></div>
  <p class="q">${question}</p>

  <footer><span>${AUDIENCE}</span><i class="dot"></i><span>${VERSION}</span></footer>
</div>`

// Inlined rather than fetched: a self-contained file:// page cannot hang
// waiting on a font request, which is exactly how this deadlocked before.
const fontPath = join(
  siteRoot,
  'node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2'
)
const fontCss =
  `@font-face{font-family:'Nunito Variable';font-style:normal;font-weight:200 1000;` +
  `src:url(data:font/woff2;base64,${readFileSync(fontPath).toString('base64')}) format('woff2-variations');}`

mkdirSync(tmp, { recursive: true })
mkdirSync(outDir, { recursive: true })
for (const s of SESSIONS) {
  writeFileSync(join(tmp, `cover-${s.n}.html`), page(s).replace('__FONT__', fontCss))
}

for (const s of SESSIONS) {
  const shot = join(tmp, `cover-${s.n}.png`)
  // 2x then downscale, so the type is crisp.
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=2',
    '--window-size=900,600',
    `--screenshot=${shot}`,
    `file://${join(tmp, `cover-${s.n}.html`)}`,
  ], { stdio: 'ignore', timeout: 60_000 })

  const base = sharp(shot).resize({ width: 900, height: 600 })
  await base.clone().webp({ quality: 92 }).toFile(join(outDir, `session-${s.n}.webp`))
  await base.clone().jpeg({ quality: 92, mozjpeg: true }).toFile(join(outDir, `session-${s.n}.jpg`))
  console.log(`✓ curriculum cover ${s.n}`)
}

rmSync(tmp, { recursive: true, force: true })
console.log('\nCovers written. Run `npm run assets` to refresh the hash manifest.')
