# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Story Sprout Public Website — Claude Code Build Handoff

## 0. Current repository state (as of 2026-08-15)

**The site is built and runs locally in `site/`.** Astro 7 + TypeScript, static output,
Cloudflare Pages deployment *not* configured yet (local testing only). Still not a Git
repository.

### Commands (all run from `site/`)

**Requires Node 22** — Astro 7 will not run on Node 20. `site/.nvmrc` pins it; run
`nvm use` first. Node 22 is installed under nvm but is *not* the machine default.

```bash
npm run dev            # dev server on :4321, shows consent-pending content behind a banner
npm run build          # static build → site/dist/
npm run preview        # serve dist/ exactly as deployed
npm run check          # astro check (TypeScript + templates)
npm run check:content  # alt text, consent gates, dead links, duplicate slugs
npm run verify         # check + build + check:content — run before publishing
npm run assets         # regenerate images/PDFs from the source material
npm test               # unit tests (analytics allowlists, CSP)
npm run audit:analytics  # drive a browser, assert on real PostHog payloads (sends nothing)
npm run verify:live      # confirm analytics is live on the DEPLOYED site (does send)
```

`npm run assets` needs `pdftoppm` (`brew install poppler`).

Analytics is documented in `site/docs/ANALYTICS.md`. Two things to know before touching it:
`PUBLIC_POSTHOG_*` are read at **build** time (this site deploys prebuilt, so Cloudflare
dashboard variables have no effect on the bundle), and the property denylist in
`src/lib/analytics.ts` was derived from a captured payload — re-run `npm run audit:analytics`
after upgrading `posthog-js`, because new versions add new auto-properties and a new
URL-bearing one would carry a child's book title.

Only `story-sprout.org` is instrumented. The legacy microsite, the old Bubble app, and the
Studio on GitHub Pages are separate properties with no analytics code in them.

### Architecture worth knowing before editing

- **`site/src/config/site.ts`** holds every external URL and address. An empty string means
  "not configured" and the UI hides itself rather than rendering a dead link or a form that
  discards submissions. This is why the mockup's newsletter band does not appear.
- **Two independent publication gates.** `published` is editorial; `consentVerified` is
  child-privacy. Production requires both (`site/src/lib/content.ts`). The dev server shows
  held-back items behind a "Review build" banner so they can be reviewed before approval.
- **`site/scripts/check-content.mjs` enforces what schemas cannot** — most importantly it
  fails the build if a storybook whose cover art contains children's names goes live without
  a recorded prior public release. Read `site/docs/PRIVACY_REVIEW.md` before touching story
  content; this is an open issue.
- **Assets are generated, never hand-edited.** `site/public/assets/` and
  `site/public/documents/` are outputs of `npm run assets`, which reads the untouched source
  folders below and strips EXIF/location metadata on the way through.

### Source material (never modified by the build)

```text
CLAUDE.md                            this spec
story-sprout-claude-code-handoff/
  design/                            approved-homepage-mockup.png,
                                     platform-style-reference-{1,2}.png
curriculum/                          Session {1,2,3,4}.pdf + session {1,2,3,4} cover.png
summer 2025/                         4 storybook PDFs
summer 2026/                         3 storybook PDFs (19–37 MB each — two exceed
                                     Cloudflare Pages' 25 MB file limit and must be
                                     compressed before deployment)
site/                                the Astro app; also the Pages build root
```

Two facts in the source material turned out to be wrong or incomplete; both are recorded in
`site/docs/CONTENT_GAPS.md`. Do not "restore" them from the legacy site:

1. The legacy microsite's curriculum blurbs do not describe the actual slide decks.
2. The mockup's session names and dates ("Summer Session 1, July 7–18, 2025") are not
   supported by anything on hand.

Related directories outside this one (read-only context; do not modify):

- `../website_old/` — the legacy microsite: `story_sprout_index.html` plus a duplicate copy
  of the curriculum and Summer 2025 PDFs, and `StorySprout.zip` containing the same 13 files.
  This is the migration source for Section 12.
- `../platform/` — the Story Sprout platform work (Bubble plugin, Cloudflare worker, Pip
  scope docs, research/audit scripts). Has its own `CLAUDE.md`. The public website does not
  build from it, but it is the authoritative source for platform feature claims in Section 4
  and for research-status facts in Section 9 `/research/`.

Filenames here are the only metadata: `summer 2025/` and `summer 2026/` name the two program
sessions in Section 8D, and curriculum session numbers come from the filenames. Nothing else
in this folder states dates, authors, consent status, or age ranges — so per Section 3 those
fields stay unpublished until the project team supplies them.

## 1. Mission

Build a production-ready public website for **Story Sprout** at:

`https://story-sprout.org/`

The new site will replace the outdated Story Sprout microsite at:

`https://storysprout.kindnessmattersinc.org/`

The interactive Story Sprout platform will continue to run at:

`https://somethingbeautiful322.bubbleapps.io/`

The public website is the permanent home for the project. It should explain Story Sprout, show curriculum and children’s work, publish research and updates, list webinars, accept donations through an approved third-party form, and direct visitors to the Bubble platform.

The website must be clear enough for families, educators, researchers, community partners, donors, and students. It should feel related to the Bubble platform without looking like a dense software dashboard.

---

## 2. First action: inspect the local materials

Work from:

`~/cc-assistant/story-sprout/website/`

Before writing production code:

1. Recursively inventory all files and folders.
2. Identify:
   - logos and brand assets;
   - Bubble/platform screenshots;
   - approved illustrations;
   - program photographs;
   - curriculum slide decks and PDFs;
   - children’s storybook PDFs and covers;
   - research papers, posters, and citations;
   - blog drafts, external article links, and press materials;
   - webinar information;
   - donation links or embed code;
   - existing website source code, if any.
3. Create:
   - `docs/ASSET_INVENTORY.csv`
   - `docs/CONTENT_GAPS.md`
   - `docs/SOURCE_MATERIAL_NOTES.md`
4. Do not delete, rename, compress, or overwrite the source materials. Create web-ready copies in the new site’s asset folders.
5. If the folder is already a website repository, preserve its Git history and existing structure where practical.
6. If the folder is primarily an asset collection rather than a web app, scaffold the new app in a `site/` subdirectory and document that `site/` is the Cloudflare Pages build root.

Do not pause for minor uncertainty. Make reasonable, reversible decisions and record them in `docs/CONTENT_GAPS.md`. Pause only for credentials, legal/consent questions, or a decision that could expose private information.

---

## 3. Important content rule

**Do not treat any text, dates, statistics, paper titles, story titles, program names, photographs, or people shown in the design mockup as factual.**

The mockup is a visual reference only. It contains generated placeholder material.

Use facts only when they are supported by:

1. files in the local project folder;
2. the current Story Sprout platform;
3. the existing public Story Sprout page;
4. text explicitly approved by the project team.

Do not publish:

- invented program dates;
- invented child names or ages;
- invented impact statistics;
- invented paper titles or publication venues;
- invented webinar dates or presenters;
- placeholder email addresses;
- lorem ipsum;
- AI-generated “camp photos” presented as real photographs.

When information is not verified, either omit the section from production or show a truthful empty state.

---

## 4. Core description of Story Sprout

Use the local materials to refine the final wording, but preserve these concepts:

- Story Sprout is an educational program, creative platform, and research project for children.
- The current target age range is approximately **7–13**, with some activities designed especially for younger children.
- Children create their own original stories and picture books.
- The child supplies the story language and decides what belongs in the book.
- The AI is used as an illustrator rather than as the author of the child’s story.
- Children describe what they want to see, examine the generated image, and revise or clarify their descriptions.
- The current platform includes **Pip**, the AI illustrator, a voice-input option that can help younger children, a story library, and educator/teacher-facing functions.
- The site should present Story Sprout as a language, communication, creativity, and child-agency project—not merely as a prompt-writing exercise.

Do not claim that a technical safeguard is perfect or that an instruction-mediated behavior is guaranteed. Use accurate phrasing such as “designed to,” “the platform’s contract,” or “the system is intended to,” where appropriate.

---

## 5. Approved visual direction

Use the included references:

- `design/approved-homepage-mockup.png`
- `design/platform-style-reference-1.png`
- `design/platform-style-reference-2.png`

The first file is the primary homepage layout reference. The two platform screenshots are references for typography, spacing, buttons, and tone.

### Visual characteristics

- Bright, gentle, welcoming, and child-friendly.
- Cream or warm-white page background.
- Light lavender section backgrounds.
- Purple as the main accent.
- Dark warm-brown or charcoal body text rather than pure black.
- Rounded cards, pill-shaped buttons, soft shadows, and generous spacing.
- Friendly rounded sans-serif typography.
- Real Story Sprout assets should replace every generated placeholder image in the mockup.
- The page must remain calm and easy to scan. Do not add extra statistic bars, carousels, decorative flourishes, or redundant content merely to fill space.

### Suggested design tokens

These are starting points, not rigid requirements. Adjust after sampling the approved platform references.

```css
:root {
  --color-bg: #fffdfa;
  --color-surface: #ffffff;
  --color-lavender-soft: #f6f2ff;
  --color-purple: #8f6bd8;
  --color-purple-dark: #7653c6;
  --color-ink: #3d312b;
  --color-muted: #6f655f;
  --color-border: #ebe5df;
  --color-orange: #df8e2f;
  --color-green: #4f9462;
  --radius-card: 18px;
  --radius-button: 999px;
  --shadow-soft: 0 10px 30px rgb(66 46 38 / 8%);
  --content-width: 1200px;
}
```

Use **Nunito** or a very similar rounded humanist sans-serif. Prefer a self-hosted font package such as `@fontsource-variable/nunito` rather than a blocking external font request.

### Responsive behavior

Design and test at minimum:

- 390 px mobile;
- 768 px tablet;
- 1024 px small desktop;
- 1440 px desktop.

The navigation should collapse into an accessible mobile menu. Content cards should stack naturally. Story covers and photographs must not be cropped in ways that hide important content.

---

## 6. Recommended technical architecture

Use a simple, static, low-maintenance architecture suitable for free Cloudflare Pages hosting.

### Preferred stack

- Current stable **Astro**
- TypeScript
- Astro content collections with schema validation
- Static rendering
- Plain CSS with design tokens and scoped component styles
- `@fontsource-variable/nunito`
- `lucide-astro` or similarly lightweight open-source icons
- Minimal client-side JavaScript
- No database for the first release
- No heavy component framework unless the existing repository already depends on one

Do not introduce a CMS, authentication system, payment processor, or server backend unless an existing approved integration requires it.

### Content approach

Store editable content as Markdown/MDX or structured data in the repository. A nontechnical maintainer should be able to add a paper, event, post, story, or curriculum item by copying a clearly documented content file.

Suggested structure:

```text
site/
├── astro.config.mjs
├── package.json
├── public/
│   ├── assets/
│   │   ├── brand/
│   │   ├── photos/
│   │   ├── story-covers/
│   │   ├── illustrations/
│   │   └── documents/
│   │       ├── curriculum/
│   │       ├── stories/
│   │       └── research/
│   ├── favicon.svg
│   └── robots.txt
├── src/
│   ├── components/
│   ├── content/
│   │   ├── curriculum/
│   │   ├── programs/
│   │   ├── stories/
│   │   ├── research/
│   │   ├── news/
│   │   └── events/
│   ├── layouts/
│   ├── pages/
│   ├── styles/
│   └── config/
└── docs/
```

Centralize changeable external values in one configuration file, for example:

```ts
export const siteConfig = {
  canonicalUrl: "https://story-sprout.org",
  platformUrl: "https://somethingbeautiful322.bubbleapps.io/",
  legacyUrl: "https://storysprout.kindnessmattersinc.org/",
  donationUrl: "",
  newsletterUrl: "",
  contactEmail: "",
};
```

Do not scatter these URLs throughout components.

---

## 7. Information architecture and routes

### Main navigation

Keep the desktop navigation concise:

1. About
2. Curriculum
3. Stories
4. Research
5. News & Events
6. Donate
7. **Try Story Sprout** — visually distinct button linking to the Bubble platform

Recommended routes:

```text
/
 /about/
 /curriculum/
 /programs/
 /programs/[slug]/
 /stories/
 /stories/[slug]/
 /research/
 /news/
 /news/[slug]/
 /events/
 /donate/
 /privacy/
 /accessibility/
 /404.html
```

“News & Events” may be one navigation item with separate landing sections or links to `/news/` and `/events/`.

---

## 8. Homepage specification

The approved homepage should be intentionally simple.

### A. Header

- Story Sprout logo at left.
- Main navigation at right.
- Purple pill button: **Try Story Sprout**.
- Sticky behavior is optional; do not make it visually heavy.
- Mobile menu must be keyboard accessible and announce its expanded state.

### B. Hero

Use the platform’s tone and visual language.

Recommended heading:

**Read. Imagine. Create. Belong.**

Supporting copy should be brief and accurate. A suitable working version is:

> Story Sprout is an educational program and research project that helps children create original picture books through language, imagination, and generative AI.

Buttons:

- **Learn More** → `/about/`
- **Try Story Sprout** → Bubble platform

Use one strong approved illustration or image from the local materials. Do not use a collage in the hero.

### C. “How Story Sprout works”

Use three calm, equally weighted items. Recommended concepts:

1. **Create Stories**  
   Children develop their ideas and write the story in their own words.

2. **Illustrate with Pip**  
   Children describe a scene, and the AI illustrator renders an image from that description.

3. **Review and Revise**  
   Children decide whether the image matches their idea and clarify or revise what they want.

Do not imply that AI writes the story.

### D. Summer program highlights

Show the **two main summer camp/program sessions** as two large cards.

Each card may contain:

- verified program/session title;
- verified dates or year;
- one approved program photograph;
- a short description;
- three to five real storybook cover thumbnails;
- link to that program’s detail page.

Do not use a rotating carousel on the first release. A static two-card layout is easier to understand and maintain.

### E. Five destination cards

Use a simple row/grid of five cards:

- Curriculum
- Research
- News & Blog
- Upcoming Webinars
- Donate

Each card should have:

- one icon;
- a short sentence;
- one clear link.

### F. Optional update signup

Include the purple “Stay in the loop” band only when a real newsletter provider or approved signup form is configured.

Do not display a form that appears to work but discards submissions.

### G. Footer

Include only verified information:

- compact Story Sprout description;
- primary navigation;
- educator/resource links;
- contact email;
- approved social links;
- privacy and accessibility links;
- copyright year generated automatically.

Do not invent a physical location.

---

## 9. Second-level page requirements

### `/about/`

Include:

- updated project summary;
- a concise origin story;
- a verified timeline of major stages;
- the current platform and its major features;
- explanation of the child’s role and the AI illustrator’s role;
- a concise description of program and research goals;
- team, advisors, collaborators, and partner organizations only when approved;
- a call to try the platform or explore curriculum.

The origin timeline should be built from local project records rather than memory or placeholder copy.

### `/curriculum/`

Present the most current curriculum first.

Each curriculum resource should include:

- title;
- session/lesson number when applicable;
- short description;
- intended age/audience;
- version or date;
- “View slides” link;
- “Download PDF” link when available;
- optional teacher notes or activity sheets.

Retain older curriculum only when useful, and label it clearly as archived or previous.

Do not embed many full slide decks on the listing page. Use thumbnails and links. An individual resource page may embed a deck when the source supports accessible embedding.

### `/programs/` and `/programs/[slug]/`

Create a landing page for programs and a detail page for each of the two main summer sessions.

Each detail page should support:

- verified overview;
- dates and partner/location only when approved;
- selected program photographs;
- curriculum used;
- children’s storybook gallery;
- short outcomes/reflection text;
- related blog or research links.

### `/stories/` and `/stories/[slug]/`

The story library should show real covers in a clean grid.

Each story record should support:

- title;
- cover image;
- synopsis;
- program/session;
- approved author display name, group label, or “Young authors”;
- optional age range only when approved;
- PDF or hosted reader link;
- alt text;
- publication/consent status.

A story detail page may contain a browser PDF viewer, but it must also provide a normal “Open/Download PDF” link. Do not load every PDF on the library page.

### `/research/`

Support papers, posters, and presentations.

For every item, display only verified fields:

- title;
- authors;
- year;
- venue;
- status;
- abstract or summary;
- official publication/DOI link;
- public manuscript or preprint link;
- citation text.

Use accurate status labels:

- Submitted
- Under review
- Preprint
- Accepted
- Published

Never present a submitted paper as published. Do not expose an anonymized submission or private review material without approval.

### `/news/`

Combine:

- Story Sprout’s own internal posts;
- project updates;
- links to external articles or partner blogs.

Internal posts should be Markdown content. External entries should be visibly labeled as external and should not copy full third-party articles.

### `/events/`

Show:

- upcoming webinars;
- past webinars;
- recordings and slides when available.

Each event should support:

- title;
- date;
- start/end time;
- timezone;
- speaker;
- summary;
- registration link;
- recording link;
- status.

When no future webinar is scheduled, show a truthful empty state:

> No upcoming webinar is currently scheduled. Check back for future events.

Optionally generate an `.ics` calendar file for each scheduled event.

### `/donate/`

The site must not directly collect or process credit-card information.

Use an approved third-party donation form or hosted donation page associated with the nonprofit/fiscal sponsor. The page should explain, using approved language:

- what donations support;
- who legally receives the donation;
- whether and how the gift is tax-deductible;
- a privacy/contact link.

Do not claim 501(c)(3) status for Story Sprout itself unless the organizational relationship and wording are approved. If the donation is processed by Kindness Matters Inc. or another fiscal sponsor, state that relationship precisely.

If the provider or legal copy is not yet supplied, build the page structure but keep it unpublished or use a clearly marked development-only placeholder.

---

## 10. Suggested content schemas

Use Astro content collections and validate required fields.

### Story

```yaml
title: ""
slug: ""
summary: ""
program: ""
cover: ""
pdf: ""
authorDisplay: ""
ageDisplay: ""
published: false
consentVerified: false
featured: false
order: 0
alt: ""
```

Production pages must include only records where both `published` and `consentVerified` are true.

### Program

```yaml
title: ""
slug: ""
startDate: ""
endDate: ""
year: 2026
partnerDisplay: ""
locationDisplay: ""
summary: ""
heroImage: ""
gallery: []
featuredStories: []
published: false
```

### Curriculum item

```yaml
title: ""
slug: ""
summary: ""
audience: ""
version: ""
date: ""
thumbnail: ""
slidesUrl: ""
pdfUrl: ""
teacherNotesUrl: ""
archived: false
published: false
order: 0
```

### Research item

```yaml
title: ""
slug: ""
authors: []
year: 2026
type: "paper"
status: "submitted"
venue: ""
summary: ""
citation: ""
officialUrl: ""
pdfUrl: ""
featured: false
published: false
```

### News item

```yaml
title: ""
slug: ""
date: ""
summary: ""
image: ""
kind: "internal"
externalUrl: ""
authors: []
published: false
```

### Event

```yaml
title: ""
slug: ""
start: ""
end: ""
timezone: "America/Los_Angeles"
speaker: ""
summary: ""
registrationUrl: ""
recordingUrl: ""
slidesUrl: ""
published: false
```

---

## 11. Asset handling, privacy, and child safety

This is a child-centered project. Treat privacy as a launch requirement, not a later enhancement.

### Asset rules

- Keep original files unchanged.
- Create neutral public filenames; do not expose private names from local filenames.
- Strip EXIF and location metadata from photographs before publication.
- Generate responsive WebP/AVIF image variants while retaining an appropriate fallback.
- Keep storybook and curriculum PDFs readable and downloadable.
- Generate cover thumbnails from PDFs only when a real cover image is absent.
- Lazy-load below-the-fold images.
- Record image source, permission status, and public alt text in the asset inventory.
- Do not use face recognition or infer identities.

### Publishing rules

- Do not add a child’s full name, school, contact information, or exact location.
- Do not infer age from appearance.
- Use only approved author names, first names, group names, or pseudonyms.
- Publishing on the old website does not automatically authorize adding more detail on the new site.
- If consent status is unclear, keep the item out of production and list it in `docs/CONTENT_GAPS.md`.
- Alt text should describe the activity or artwork without identifying children.
- Do not use generated images of children as if they document real Story Sprout programs.

---

## 12. Legacy-site migration and redirect

The existing page at `https://storysprout.kindnessmattersinc.org/` currently serves as the public Story Sprout microsite. Audit its current text, curriculum entries, and storybook links before migration.

### Migration

- Preserve useful legacy content in the new site where it remains accurate and approved.
- Place older material under a clearly labeled program/archive page rather than mixing it with the newest curriculum.
- Check every legacy document link and replace broken or temporary storage links.
- Create `docs/LEGACY_CONTENT_MAP.md` showing:
  - old content/item;
  - old URL, when available;
  - new destination;
  - migrated, archived, or omitted status;
  - reason for omission.

### Redirect

Do not activate the redirect until:

1. the new Cloudflare preview has been reviewed;
2. `story-sprout.org` is live with HTTPS;
3. important old content has an appropriate new destination;
4. the project owner approves the switch.

The old host or DNS provider must return a true permanent redirect. The new website cannot, by itself, redirect traffic arriving at a different hostname that it does not control.

Preferred behavior:

```text
https://storysprout.kindnessmattersinc.org/
→ 301
https://story-sprout.org/
```

When stable old deep links exist, map them to equivalent new pages rather than sending every URL to the homepage.

Create `docs/REDIRECT_PLAN.md` with exact instructions for the actual old hosting environment. Include a fallback plan, but prefer an HTTP 301/308 over a JavaScript or meta-refresh redirect.

---

## 13. Deployment

Target: **Cloudflare Pages** connected to GitHub.

### Build settings

Document the final values in `docs/DEPLOYMENT.md`, including:

- repository;
- project/build root;
- build command;
- output directory;
- Node version;
- environment variables;
- preview URL;
- custom-domain steps.

Expected Astro defaults are likely similar to:

```text
Build command: npm run build
Output directory: dist
```

Verify rather than assuming.

### Domain sequence

1. Deploy to a temporary `pages.dev` URL.
2. Review content and behavior.
3. Add `story-sprout.org`.
4. Configure `www.story-sprout.org` to redirect to the canonical apex domain.
5. Confirm HTTPS and canonical metadata.
6. Only then activate the old-site redirect.

Do not change GoDaddy nameservers or DNS records until Cloudflare provides the exact required values and the project owner is ready.

---

## 14. Accessibility, performance, and SEO

### Accessibility

Target WCAG AA behavior.

Required:

- semantic landmarks;
- one clear `h1` per page;
- logical heading hierarchy;
- skip-to-content link;
- keyboard-accessible menu and controls;
- visible focus states;
- sufficient color contrast;
- meaningful alt text;
- form labels and error messages;
- reduced-motion support;
- no autoplaying media;
- no information communicated by color alone.

### Performance

- Use static HTML wherever possible.
- Do not ship a large JavaScript bundle for simple cards or navigation.
- Optimize images.
- Avoid loading full PDFs or videos on listing pages.
- Use responsive image dimensions to prevent layout shift.
- Keep the homepage visually rich but fast.

### SEO and sharing

Implement:

- canonical URL;
- page-specific title and description;
- Open Graph and social-card metadata;
- favicon and web manifest;
- XML sitemap;
- `robots.txt`;
- structured data where appropriate:
  - Organization or Project;
  - Article;
  - Event;
  - ScholarlyArticle when verified.
- descriptive URLs;
- redirect from trailing/nontrailing variants consistently.

Do not add unverified organization addresses, founding dates, or legal status to structured data.

---

## 15. Testing and quality gates

Provide scripts for:

```text
npm run dev
npm run check
npm run build
npm run preview
```

Add reasonable automated checks for:

- TypeScript/Astro validation;
- broken internal links;
- missing required frontmatter;
- missing alt text for published images;
- published stories without verified consent;
- duplicate slugs.

Manually test:

- 390, 768, 1024, and 1440 px widths;
- Safari, Chrome, and Firefox behavior where available;
- keyboard-only navigation;
- mobile menu;
- external links;
- story PDF links;
- curriculum links;
- donation flow;
- event registration;
- empty webinar state;
- 404 page;
- social metadata;
- Cloudflare preview and production URLs.

Aim for strong Lighthouse results, especially accessibility, SEO, and best practices. Do not sacrifice readability or image quality merely to chase a numerical score.

---

## 16. Required project documentation

Before handoff, create or update:

- `README.md` — local setup and project overview
- `CLAUDE.md` — this build specification or a maintained equivalent
- `docs/ASSET_INVENTORY.csv`
- `docs/SOURCE_MATERIAL_NOTES.md`
- `docs/CONTENT_GAPS.md`
- `docs/CONTENT_EDITING.md`
- `docs/LEGACY_CONTENT_MAP.md`
- `docs/REDIRECT_PLAN.md`
- `docs/DEPLOYMENT.md`
- `docs/PRIVACY_REVIEW.md`
- `docs/THIRD_PARTY_LICENSES.md`

`CONTENT_EDITING.md` should explain, with copyable examples, how to add:

- a curriculum resource;
- a storybook;
- a program;
- a research item;
- an internal post;
- an external blog link;
- a webinar.

---

## 17. Implementation phases

### Phase 1 — Audit

- Inspect the folder.
- Identify the existing app or choose the build root.
- Create the asset inventory and content-gap report.
- Identify the newest versions of curriculum and papers by content, not only file timestamps.
- Identify privacy/consent uncertainties.
- Confirm which materials correspond to the two main summer sessions.

### Phase 2 — Foundation

- Scaffold Astro.
- Set up design tokens, typography, global layout, metadata, and content collections.
- Build accessible header, mobile menu, footer, buttons, cards, and image components.
- Create core routes and empty states.

### Phase 3 — Homepage

- Implement the approved simplified layout.
- Replace mockup placeholders with verified assets.
- Keep the page restrained and spacious.
- Test all responsive breakpoints.

### Phase 4 — Content pages

- About and origin timeline
- Curriculum
- Programs and two session pages
- Story library and detail pages
- Research
- News
- Events
- Donate
- Privacy/accessibility pages

### Phase 5 — Migration and QA

- Migrate approved legacy content.
- Run privacy review.
- Validate links and statuses.
- Create the redirect map.
- Remove every development placeholder from production.
- Capture final screenshots at mobile and desktop widths.

### Phase 6 — Preview and production

- Deploy to Cloudflare Pages preview.
- Provide review URL and content-gap list.
- Apply approved revisions.
- Connect the custom domain.
- Verify HTTPS, redirects, metadata, and forms.
- Activate the old-site redirect only after approval.

---

## 18. Definition of done

The build is complete only when all applicable items below are true:

- [ ] The site builds from a clean install without manual patching.
- [ ] The homepage matches the approved visual direction and is less busy than the first mockup.
- [ ] The site uses verified Story Sprout assets rather than mockup placeholders.
- [ ] The current Bubble platform is linked from every appropriate call to action.
- [ ] The About page contains an updated summary and verified origin story.
- [ ] The latest approved curriculum is easy to view and download.
- [ ] The two main summer sessions have separate, coherent program pages.
- [ ] Approved photographs and storybooks are displayed with privacy safeguards.
- [ ] Research items have accurate publication-status labels.
- [ ] Internal and external blog items are clearly distinguished.
- [ ] Upcoming webinars have a real schedule or a truthful empty state.
- [ ] The donation page uses a real approved third-party flow or remains unpublished.
- [ ] There is no lorem ipsum, invented metric, fake date, fake child name, or fake event.
- [ ] There are no broken internal links.
- [ ] The site is usable by keyboard and on mobile.
- [ ] Published photographs have metadata removed.
- [ ] Published child content has documented permission/consent status.
- [ ] A Cloudflare Pages preview is available.
- [ ] Deployment and content-editing instructions are complete.
- [ ] The old-site redirect plan is ready but not activated prematurely.

---

## 19. Final handoff report

At the end of the build, provide a concise report containing:

1. what was built;
2. local run instructions;
3. preview URL;
4. pages completed;
5. materials used;
6. materials omitted and why;
7. unresolved content or consent questions;
8. donation/newsletter/webinar integrations still requiring credentials;
9. exact steps remaining for GoDaddy, Cloudflare, and the old-site redirect;
10. screenshots of the desktop and mobile homepage.

The goal is not merely to produce attractive code. The goal is a trustworthy, maintainable public home for Story Sprout that accurately represents children’s authorship, the curriculum, the platform, the programs, and the research.
