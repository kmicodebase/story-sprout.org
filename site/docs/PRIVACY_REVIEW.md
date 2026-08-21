# Privacy review

Status: **resolved by the project team on 2026-08-15** — consent confirmed for the Summer
2026 storybooks; all seven books are published. Keep this document as the record of what
was published and why.

## The finding that matters most

**Children's first names are printed into the storybook cover artwork and inside the
PDFs themselves.**

Setting `authorDisplay: "Young authors"` in the content files — which every book here
does — hides names from the *page text* only. It cannot hide names that are part of the
image or the document. Publishing one of these books publishes those names.

Confirmed by rendering page 1 of each PDF:

| Book | Program | Names visible on cover | Currently live? |
|---|---|---|---|
| John The Ant | Summer 2025 | yes — 5 first names | **yes** |
| The Girl Who Was Half Cat | Summer 2025 | yes — 4 first names | **yes** |
| A Teenage Girl | Summer 2025 | yes — 3 first names | **yes** |
| A Cattastic Adventure | Summer 2025 | no | yes |
| A Dumpling's Last Mission | Summer 2026 | yes — 4 first names | **yes** |
| Glimmer the Duck | Summer 2026 | no | yes |
| Search for the Diamond | Summer 2026 | no | yes |

Only page 1 of each PDF was examined. **Interior pages have not been reviewed** and may
carry additional names, dedications, or photographs.

### Why the three Summer 2025 books are still live

Those exact PDFs were already served publicly from
`storysprout.kindnessmattersinc.org`, and that page additionally printed the same first
names as plain text next to each book. Carrying them over is a re-publication of
material the organization had already made public, not a new disclosure. That is a
defensible default, **not an approval** — the project team should confirm it.

### The Summer 2026 books

Originally held back — they had never been public, and *A Dumpling's Last Mission* carries
four first names across the top of its cover. On 2026-08-15 the project team confirmed
consent and they were published.

Because those books were never previously public, `priorPublicRelease` stays `false` (that
would be untrue). The names on *A Dumpling's Last Mission* are cleared by a separate
`namesApproved: true` flag, so the record shows the names were approved deliberately rather
than overlooked.

## How the code enforces this

`src/content.config.ts` gives every story two flags:

- `coverShowsNames` — names are burned into the artwork or PDF.
- `priorPublicRelease` — this exact file was already public.

`scripts/check-content.mjs` **fails the build** if a book is live
(`published && consentVerified`) with `coverShowsNames: true` and
`priorPublicRelease: false`. It prints a warning on every build for each live book whose
cover shows names, so the situation cannot quietly become normal.

Verified: flipping `priorPublicRelease` to false on *John The Ant* fails the check.

## Decisions needed

1. **Keep, redact, or withdraw the three live 2025 books with visible names.** Redacting
   means editing the cover art and the PDF interiors — not a content-file change.
2. **Confirm whether first names may be shown at all.** If yes, `authorDisplay` can carry
   them and the covers stop being an inconsistency. If no, the artwork needs editing.
3. **Review the interior pages** of all seven PDFs.
4. **Decide on the four Summer 2026 books**, which are otherwise finished and one flag
   away from going live.

## What the site already does correctly

- No child's full name, school, contact details, or location appears in any page text.
- Alt text describes artwork and activity only; it never identifies a child.
- All generated images are written by `sharp` without `withMetadata()`, so EXIF and GPS
  data are stripped by construction.
- Production excludes anything not both `published` and `consentVerified`; the dev server
  shows held-back items behind a persistent "Review build" banner and a per-item badge.
- **The files are removed too, not just the pages.** `npm run build` runs
  `scripts/prune-dist.mjs`, which deletes every consent-pending storybook PDF and cover
  from the build output. Without it those files would still ship — unlinked, but
  downloadable at a guessable URL, which would defeat the gate entirely.
  `scripts/check-content.mjs` fails the build if any of them survive. Verified: restoring
  one pending PDF into `dist/` by hand fails the check.
- No analytics, cookies, trackers, or data-collecting forms anywhere on the site.
