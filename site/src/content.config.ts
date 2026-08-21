import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

/**
 * Shared publication gate. `published` is the editorial switch; `consentVerified`
 * is the child-privacy switch. Production requires BOTH. Anything carrying
 * children's work must set consentVerified explicitly — there is no default.
 */
const gate = {
  published: z.boolean().default(false),
  /** Why the consent status is what it is. Required so the reason survives handoff. */
  consentNote: z.string().optional(),
}

const stories = defineCollection({
  loader: glob({ pattern: ['**/*.md', '!**/_*.md'], base: './src/content/stories' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    /** Slug of the owning program. */
    program: z.string(),
    cover: z.string(),
    /** Alt text must describe the artwork, never identify a child. */
    alt: z.string(),
    pdf: z.string(),
    /** Approved display name, group label, or "Young authors". Never a full name. */
    authorDisplay: z.string().default('Young authors'),
    ageDisplay: z.string().optional(),
    consentVerified: z.boolean(),
    /**
     * True when children's names are printed INTO the cover artwork or the PDF
     * itself. `authorDisplay` cannot hide those — the image and the document
     * carry them. A book with this set cannot go live unless
     * `priorPublicRelease` is also true; see scripts/check-content.mjs.
     */
    coverShowsNames: z.boolean().default(false),
    /**
     * True only when this exact file was already published publicly by the
     * organization, so carrying it over is a re-publication rather than a new
     * disclosure. Never set this on a book that has not actually been public.
     */
    priorPublicRelease: z.boolean().default(false),
    /**
     * The project team has confirmed the names visible in the artwork may be
     * published. The other route past `coverShowsNames` — use this when the book
     * was never public before, so `priorPublicRelease` would be untrue.
     */
    namesApproved: z.boolean().default(false),
    featured: z.boolean().default(false),
    order: z.number().default(0),
    ...gate,
  }),
})

const programs = defineCollection({
  loader: glob({ pattern: ['**/*.md', '!**/_*.md'], base: './src/content/programs' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    /** Human-readable date range. Omit entirely rather than guessing. */
    dateDisplay: z.string().optional(),
    /** Short scannable shape, e.g. "Eight sessions · Ages 7–13". */
    formatDisplay: z.string().optional(),
    year: z.number(),
    partnerDisplay: z.string().optional(),
    locationDisplay: z.string().optional(),
    heroImage: z.string().optional(),
    heroAlt: z.string().optional(),
    order: z.number().default(0),
    ...gate,
  }),
})

const curriculum = defineCollection({
  loader: glob({ pattern: ['**/*.md', '!**/_*.md'], base: './src/content/curriculum' }),
  schema: z.object({
    title: z.string(),
    sessionNumber: z.number().optional(),
    summary: z.string(),
    audience: z.string().optional(),
    version: z.string().optional(),
    thumbnail: z.string().optional(),
    thumbnailAlt: z.string().optional(),
    slidesUrl: z.string().optional(),
    pdfUrl: z.string().optional(),
    teacherNotesUrl: z.string().optional(),
    archived: z.boolean().default(false),
    order: z.number().default(0),
    ...gate,
  }),
})

const research = defineCollection({
  loader: glob({ pattern: ['**/*.md', '!**/_*.md'], base: './src/content/research' }),
  schema: z.object({
    title: z.string(),
    authors: z.array(z.string()).default([]),
    year: z.number(),
    type: z.enum(['paper', 'poster', 'presentation']).default('paper'),
    /** Never label a submitted paper as published. */
    status: z.enum(['submitted', 'under-review', 'preprint', 'accepted', 'published']),
    venue: z.string().optional(),
    /** Short form for the status badge, e.g. "NeurIPS 2026". */
    venueShort: z.string().optional(),
    summary: z.string(),
    citation: z.string().optional(),
    officialUrl: z.string().optional(),
    pdfUrl: z.string().optional(),
    /**
     * Required to serve the manuscript from this site while `status` is still
     * `submitted` or `under-review`. Conference templates stamp submissions
     * "do not distribute", so hosting one is the authors' call to make
     * explicitly — never a default. See scripts/check-content.mjs.
     */
    distributionApproved: z.boolean().default(false),
    featured: z.boolean().default(false),
    ...gate,
  }),
})


const blog = defineCollection({
  loader: glob({ pattern: ['**/*.md', '!**/_*.md'], base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    /** internal = written here; external = a link out, never reproduced. */
    kind: z.enum(['internal', 'external']).default('internal'),
    /** Required for external items. */
    externalUrl: z.string().optional(),
    /** Publication name, shown so the source is never implied to be us. */
    externalSource: z.string().optional(),
    authors: z.array(z.string()).default([]),
    ...gate,
  }),
})

const events = defineCollection({
  loader: glob({ pattern: ['**/*.md', '!**/_*.md'], base: './src/content/events' }),
  schema: z.object({
    title: z.string(),
    start: z.coerce.date(),
    end: z.coerce.date().optional(),
    timezone: z.string().default('America/Los_Angeles'),
    speaker: z.string().optional(),
    summary: z.string(),
    registrationUrl: z.string().optional(),
    recordingUrl: z.string().optional(),
    slidesUrl: z.string().optional(),
    ...gate,
  }),
})

export const collections = { stories, programs, curriculum, research, blog, events }
