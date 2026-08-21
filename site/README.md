# Story Sprout website

The public website for Story Sprout, an educational program and research project in which
children write and illustrate their own picture books.

Built with [Astro](https://astro.build) as a static site. No database, no CMS, no backend.

## Requirements

**Node 22 or newer.** Astro 7 does not run on Node 20.

```bash
nvm use            # reads .nvmrc → Node 22
```

If you don't have Node 22 yet: `nvm install 22`.

## Running it

```bash
npm install
npm run dev        # http://localhost:4321
```

The dev server shows unpublished and consent-pending content behind an orange "Review
build" banner so it can be reviewed. Production builds exclude it.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Static build into `dist/` |
| `npm run preview` | Serve `dist/` exactly as it would be deployed |
| `npm run check` | TypeScript and Astro template type checking |
| `npm run check:content` | Content gates: alt text, consent, dead links, duplicates |
| `npm run verify` | All three — run this before publishing |
| `npm run assets` | Rebuild images and PDFs from the source material |
| `npm run deploy:preview` | Build and push to a Cloudflare Pages preview URL |
| `npm run deploy` | Build and push to production |

`npm run check:content` checks internal links against `dist/`, so run it after a build
(`npm run verify` does this in the right order).

## Where things live

```
src/
  config/site.ts        every external URL, email, and toggle — start here
  content.config.ts     content schemas and the publication/consent gates
  content/              the editable content (see docs/CONTENT_EDITING.md)
  lib/content.ts        sorting and the production filters
  layouts/ components/ pages/ styles/
scripts/
  build-assets.mjs      source material → web-ready images and PDFs
  check-content.mjs     the content quality gates
public/                 generated assets and documents (do not hand-edit)
docs/                   see below
```

## Assets

Source material lives in the **parent folder** (`../curriculum/`, `../summer 2025/`,
`../summer 2026/`) and is never modified. `npm run assets` reads it and writes web-ready
copies into `public/`:

- storybook covers rendered from page 1 of each PDF (needs `pdftoppm`: `brew install poppler`)
- curriculum thumbnails resized from the supplied cover images
- all images stripped of EXIF and location metadata

Everything under `public/assets/` and `public/documents/` is generated. Re-run the script
rather than editing it by hand.

## Before publishing

Read **`docs/PRIVACY_REVIEW.md` first.** There is an open privacy question about
children's names printed into the storybook artwork that needs a decision from the project
team.

Then work through `docs/CONTENT_GAPS.md`, which lists everything still missing.

| Document | |
|---|---|
| `docs/PRIVACY_REVIEW.md` | **Open issue.** Children's names in cover art and PDFs |
| `docs/CONTENT_GAPS.md` | What is missing, and what was deliberately not invented |
| `docs/CONTENT_EDITING.md` | How to add a story, program, paper, post, or webinar |

Deployment is configured but has **not been run** — see `docs/DEPLOYMENT.md` for the
Cloudflare Pages steps and the one change needed in GoDaddy.

`npm run build` always runs `scripts/prune-dist.mjs`, which strips consent-pending
storybooks from the output and refuses to continue if any file exceeds Cloudflare's 25 MB
limit.

## Notes

- The mockup's "Stay in the loop" newsletter band is intentionally not rendered: no
  provider is configured, and a form that silently discards what people type is worse than
  no form. It appears automatically once `newsletterUrl` is set.
- `/donate/` is `noindex` until a real donation URL is configured.
