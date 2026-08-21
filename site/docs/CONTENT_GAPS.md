# Content gaps

Everything the site needs but does not have. Nothing here was invented to fill a hole —
where a fact was missing, the section either shows a truthful empty state or is omitted.

Last updated: 2026-08-15.

## Blocked on the project team

These are the only things standing between this build and a publishable site.

| # | Gap | What the site does now | Where to fix |
|---|---|---|---|
| 1 | Contact email address | Footer omits the contact line entirely | `src/config/site.ts` → `contactEmail` |
| 2 | Donation provider + legal wording | `/donate/` explains giving is not set up and is `noindex` | `src/config/site.ts` → `donationUrl` |
| 3 | Newsletter provider | "Stay in the loop" band from the mockup is not rendered | `src/config/site.ts` → `newsletterUrl` |
| 4 | Social media accounts | No social icons render | `src/config/site.ts` → `social` |
| 5 | Summer 2026 session dates, location, partner | Program page says details are not published yet | `src/content/programs/summer-2026.md` |
| 6 | Research items | one NeurIPS submission listed, PDF downloadable (see below) | `src/content/research/` |
| 7 | Webinars | homepage training band says none is scheduled | `src/content/events/` |
| 8 | Origin story, timeline, team | `/about/` carries a visible "still to come" note | `src/pages/about.astro` |

## News & Events was removed

At the project team's request the `/news/` and `/events/` pages, their nav and footer links,
and the `news` content collection were all deleted.

The `events` collection was **kept**: it still feeds the "Training webinars" band on the
homepage, which lists the next two published sessions or says plainly that none is
scheduled. Adding a webinar is unchanged — drop a file in `src/content/events/`. There is
no longer a page listing past webinars or recordings; if that is wanted later, restore
`/events/`.

## Facts deliberately not used

The homepage mockup contains generated placeholder material. Per the brief, none of it was
treated as fact. Specifically **not** carried into the build:

- "Summer Session 1 — July 7–18, 2025" and "Summer Session 2 — July 21–August 1, 2025".
  The legacy site says only "July 2025" for one workshop, and the local folders are named
  `summer 2025` and `summer 2026`. The mockup's two sessions and exact dates are not
  supported by anything on hand.
- `info@story-sprout.org` — appears in the mockup; no evidence it exists.
- The mockup's storybook titles ("The Superhero Snack Attack", "Lost in the Forest",
  "Mystery in the Magic Library", …) — none of these are real Story Sprout books.
- The mockup's classroom group photographs.
- Any impact statistic, founding date, or physical address.

## Assets

- **Hero illustration** — resolved 2026-08-15. The project team supplied a
  full-resolution original (1672×941) at `../illustrations/hero-classroom.png`, replacing
  the low-resolution crop taken from the design mockup. Note it is an *illustration* of a
  classroom scene, not a photograph of a real Story Sprout session, and the alt text
  describes it as such.
- **No logo file exists.** The wordmark in `src/components/Logo.astro` and
  `public/favicon.svg` was rebuilt as inline SVG from the design references. Replace with
  the real logo when available.
- **No program photographs** were supplied, so the program pages carry none. The mockup's
  photos are placeholders.
- **No storybook cover images** were supplied. Covers are rendered from page 1 of each
  PDF by `scripts/build-assets.mjs`.
- **Oversized storybook PDFs are recompressed automatically.** Two Summer 2026 books were
  33 MB and 37 MB, over Cloudflare Pages' 25 MB per-file limit. `npm run assets` now
  re-encodes any storybook over 20 MB: each page is rendered to JPEG at its native pixel
  width (1600 px, no downsampling) and reassembled with `pdf-lib`. Both came down to 2.0 MB
  with no visible loss. Smaller books are copied through untouched. Source files are never
  modified.

## What the NeurIPS paper says that the site does not

`../paper-platform.pdf` (added 2026-08-15) is a much better source than anything else on
hand, and it contradicts or extends the site in several places. **None of these were
applied** — they change what the program publicly claims about itself, which is the
project team's call, not a build decision.

| The paper says | The site currently says | Action |
|---|---|---|
| Provisional target age band is **7–9**; cohorts served were 7–13 | "ages 7–13" in the hero and About page | decide which the public age range should be |
| **Two** eight-session summer programs, 2025 **and** 2026, 75 min per session | Two programs, sessions not described | add session counts and length |
| A **ten-session after-school program ran in spring 2026**, 30 min per session | not mentioned at all | add a third program if it should be public |
| Summer 2025 produced **five** complete picture books | four books are on the site | one book is missing from the local material |
| Curriculum ran as an **eight**-session program | four curriculum decks exist locally | four decks are missing, or the four cover eight sessions |
| Curriculum has reached **over 100 children**; roughly 50 used the platform | no figures published | first verified impact numbers available |
| Code is public at `github.com/kmicodebase/kmi_story_sprout_studio`, studio at `kmicodebase.github.io/kmi_story_sprout_studio/workshop-plugin.html` | `platformUrl` points at the Bubble app | confirm which platform the public "Try Story Sprout" button should open |
| Curriculum was inspired by the Cross-Media Projects at Harvard's X-Media Lab | no origin story | useful for the About page timeline |
| "No child data was collected for this research" | — | supports the privacy page |

The paper also states the platform keeps no child accounts, stores each project in a local
file held by the supervising adult, and retains no readable server-side copy — all of
which is stronger and more specific than what `/about/` currently says.

## The paper is downloadable at the authors' request

Page 1 of the manuscript is stamped **"Submitted to 40th Conference on Neural Information
Processing Systems (NeurIPS 2026). Do not distribute."** That was raised, and the authors
asked for the full paper to be downloadable anyway — their call to make about their own
work, and posting a preprint during review is normal practice.

So `paper-platform.pdf` is now served at
`/documents/research/story-sprout-picture-book-studio.pdf`, copied there by
`npm run assets`. The research entry sets `distributionApproved: true`, which is what
allows it; without that flag `scripts/check-content.mjs` fails the build for any paper
with status `submitted` or `under-review` that is hosted on this site. Every build prints
a warning that a manuscript under review is being served, so it stays visible.

**One loose end:** the served PDF still has "Do not distribute" printed on its first page,
which a reader will see. Recompiling with the NeurIPS template's preprint option removes
that line and resolves the contradiction. Worth doing before launch.

`officialUrl` remains unset — it renders a "Publisher page" button, and the paper has no
publisher yet. `status` must stay `submitted` until the authors say otherwise.

## Two claims on `/research/` that were softened

The project team supplied intro copy for the research page. Two parts of it were written
more cautiously than dictated. Both are one edit away from being restored — they just need
backing first.

**1. Advisors — now named by institution.** The original request was a superlative about
unnamed people ("world leading … advising and helping our team members"). That was first
published as a plain statement of fields; the project team then supplied the institutions,
which is a better claim because it is checkable. The page now lists:

- Massachusetts Institute of Technology
- Carnegie Mellon University
- Inria Paris
- University of California, Irvine
- University of Colorado Boulder

**Still needs doing before launch:** the brief (§9) allows advisors, collaborators, and
partner organizations to be listed **only when approved**. Naming an institution publicly
implies it is associated with the project, so confirm each advisor is content to be listed
this way. Consider adding "affiliations shown for identification only" if the advisers are
acting in a personal capacity rather than on behalf of their institutions — the usual
convention, and it protects both sides.

Note the paper itself is much more modest — "correspondence with colleagues in the field of
child–computer interaction" — so the website and the manuscript now describe the same
relationship quite differently. Worth reconciling.

**2. "Will improve their writing skills."** Requested as an outcome; published as an aim,
with an explicit note that measurement is reserved for a planned study.

Why: the paper's own NeurIPS checklist states that §5 marks the deployment observations as
practice notes rather than measurements, and that §6 reserves evaluation of the learning
goals for a planned study. Claiming the outcome on the website would contradict the paper
in a way a reviewer could notice.

**Also unconfirmed:** "Creative AI Track" and "Sydney". The manuscript names only "40th
Conference on Neural Information Processing Systems (NeurIPS 2026)". Both came from the
project team and are now in the venue string and the intro prose — check them against the
submission confirmation.

The intro also hardcodes "We recently submitted…". It is not driven by the content file, so
it needs a manual edit if the paper is accepted.

## A contradiction found in the source material

**The legacy microsite's curriculum descriptions do not match the actual slide decks.**

The legacy page described sessions 1–4 as "storytelling fundamentals and character
development", "building compelling plots and creating story arcs", "adding dialogue", and
"final touches and sharing our stories". The decks themselves are titled:

| # | Actual deck title | Actual subtitle |
|---|---|---|
| 1 | Introduction to AI Image Storytelling | Intro to Class Slideshow |
| 2 | Prompt Writing | How do we write prompts correctly and how do we fix them? |
| 3 | Consistent Image Stylization | How can you keep the art style consistent? |
| 4 | Storytelling and writing | How do we write and structure stories? |

The decks were treated as authoritative and the site now uses their real titles. Worth
confirming: the legacy blurbs look like generic filler rather than a description of the
material that was actually taught.

Only the title slide of each deck was read. **The interiors have not been reviewed**, so
the summaries reflect the title slide only.

## Legacy content

The legacy microsite had exactly two sections, both migrated:

| Legacy item | New destination | Status |
|---|---|---|
| Workshop Sessions (July 2025), sessions 1–4 | `/curriculum/` | migrated, but descriptions **rewritten** from the decks — see above |
| Student Storybooks ×4 | `/stories/`, `/programs/summer-2025/` | migrated |
| Author first names listed as text | — | **not** carried into page text; see gap #1 |
| Kindness Matters Inc 501(c)(3) footer | `/donate/`, footer, `/about/` | migrated |
| Google Docs PDF viewer modal | `/stories/[slug]/` | replaced with a native viewer plus a plain download link |
| PDFs on `storage.googleapis.com` | `/documents/stories/` | now served from the site itself |
