# Editing content

All editable content is Markdown in `src/content/`. Adding something means copying a file
and changing the text at the top — no code.

**Nothing appears on the public site until `published: true`.** Storybooks additionally
need `consentVerified: true`. While the dev server is running, unpublished items are shown
with an orange "Pending consent review" badge so you can check them before approving.

Each collection has a `_TEMPLATE.md` you can copy. Files starting with `_` are ignored.

After any change, run `npm run verify` — it catches missing alt text, broken links,
duplicate slugs, and consent problems.

---

## Add a storybook

1. Put the PDF in the source folder (e.g. `../summer 2026/`), then run `npm run assets`.
   That renders a cover from page 1 and copies the PDF into the site.
2. **Look at the generated cover** in `public/assets/story-covers/`. If children's names
   are printed on it, set `coverShowsNames: true` — see `PRIVACY_REVIEW.md`.
3. Copy an existing file in `src/content/stories/` and edit:

```yaml
---
title: Glimmer the Duck
summary: One or two sentences. Do not invent plot details you have not read.
program: summer-2026            # must match a file in src/content/programs/
cover: /assets/story-covers/glimmer-the-duck.webp
alt: Describe the artwork, never the child.
pdf: /documents/stories/glimmer-the-duck.pdf
authorDisplay: Young authors    # or an approved first name / group name
order: 1
published: true
coverShowsNames: false          # true if names are printed on the art or in the PDF
priorPublicRelease: false       # true only if this exact file was already public
consentVerified: false          # true only once consent is confirmed
consentNote: Why the above is set the way it is.
---
```

`consentVerified: false` requires a `consentNote`. A book with `coverShowsNames: true`
cannot go live unless `priorPublicRelease` is also true — the build will fail.

## Add a curriculum resource

Drop `session N.pdf` and `session N cover.png` into `../curriculum/`, run `npm run assets`,
then copy a file in `src/content/curriculum/`:

```yaml
---
title: "Session 5: Title"
sessionNumber: 5
summary: One sentence.
audience: Elementary students (approx. ages 7–13)
version: July 2026
thumbnail: /assets/curriculum-covers/session-5.webp
thumbnailAlt: Title slide for Story Sprout curriculum session 5.
pdfUrl: /documents/curriculum/session-5.pdf
order: 5
published: true
---
```

Set `archived: true` to move an older version into the "Previous versions" list.

## Add a program

```yaml
---
title: Summer 2027 Workshop
summary: One or two sentences.
dateDisplay: July 2027          # omit entirely rather than guessing
year: 2027
order: 0                        # lower sorts first within a year
published: true
---

Body text in Markdown appears on the program's own page.
```

Stories point at a program by its filename, so `summer-2027.md` means `program: summer-2027`.

## Add a research item

Copy `src/content/research/_TEMPLATE.md`. The `status` field must be one of `submitted`,
`under-review`, `preprint`, `accepted`, `published` — **never label a submitted paper as
published**.

## Add a webinar

Webinars appear in the "Training webinars" band on the homepage — there is no separate
events page. Copy `src/content/events/_TEMPLATE.md` and use full ISO timestamps:

```yaml
start: 2026-10-14T17:00:00Z
end: 2026-10-14T18:00:00Z
timezone: America/Los_Angeles
```

The homepage shows the next two upcoming sessions. A session drops off by itself once its
end time passes; when none is upcoming the band says so rather than showing an empty list.

## Change a URL, email, or link

Everything external lives in `src/config/site.ts` — donation link, newsletter, contact
email, social links, platform URL. An empty string means "not configured", and the site
hides that UI rather than showing a dead link or a form that discards what people type.
