import { getCollection, type CollectionEntry } from 'astro:content'
import { showPendingContent } from '../config/site'

type Gated = { data: { published: boolean } }
type ConsentGated = { data: { published: boolean; consentVerified: boolean } }

/**
 * Editorial gate only — for collections that carry no children's work.
 * Unpublished drafts are still visible in dev so they can be reviewed.
 */
export function isVisible(entry: Gated): boolean {
  return entry.data.published || showPendingContent
}

/**
 * Child-privacy gate. An item only reaches production when it is both published
 * and consent-verified; in a review build it is shown but flagged.
 */
export function isVisibleWithConsent(entry: ConsentGated): boolean {
  const approved = entry.data.published && entry.data.consentVerified
  return approved || showPendingContent
}

/** True when the entry is only on screen because this is a review build. */
export function isPending(entry: ConsentGated): boolean {
  return !(entry.data.published && entry.data.consentVerified)
}

export async function getStories(): Promise<CollectionEntry<'stories'>[]> {
  const stories = await getCollection('stories', isVisibleWithConsent)
  return stories.sort((a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title))
}

export async function getPrograms(): Promise<CollectionEntry<'programs'>[]> {
  const programs = await getCollection('programs', isVisible)
  // Newest program first.
  return programs.sort((a, b) => b.data.year - a.data.year || a.data.order - b.data.order)
}

export async function getCurriculum(): Promise<CollectionEntry<'curriculum'>[]> {
  const items = await getCollection('curriculum', isVisible)
  return items.sort((a, b) => a.data.order - b.data.order || (a.data.sessionNumber ?? 0) - (b.data.sessionNumber ?? 0))
}

export async function getResearch(): Promise<CollectionEntry<'research'>[]> {
  const items = await getCollection('research', isVisible)
  return items.sort((a, b) => b.data.year - a.data.year)
}

export async function getBlog(): Promise<CollectionEntry<'blog'>[]> {
  const items = await getCollection('blog', isVisible)
  return items.sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
}

export async function getEvents(): Promise<CollectionEntry<'events'>[]> {
  const items = await getCollection('events', isVisible)
  return items.sort((a, b) => a.data.start.getTime() - b.data.start.getTime())
}

/** Splits events around "now" so the page can show a truthful empty state. */
export function splitEvents(events: CollectionEntry<'events'>[], now = new Date()) {
  const upcoming = events.filter((e) => (e.data.end ?? e.data.start) >= now)
  const past = events.filter((e) => (e.data.end ?? e.data.start) < now).reverse()
  return { upcoming, past }
}

const RESEARCH_STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  'under-review': 'Under review',
  preprint: 'Preprint',
  accepted: 'Accepted',
  published: 'Published',
}

/** Each status takes a different preposition before a venue name. */
const STATUS_PREPOSITIONS: Record<string, string> = {
  submitted: 'to',
  'under-review': 'at',
  accepted: 'at',
  published: 'in',
}

/**
 * "Submitted to NeurIPS 2026" rather than a bare "Submitted", so the badge says
 * where on its own. Falls back to the status alone when there is no short venue
 * (a preprint has no venue to name).
 */
export function researchStatusLabel(status: string, venueShort?: string): string {
  const label = RESEARCH_STATUS_LABELS[status] ?? status
  const preposition = STATUS_PREPOSITIONS[status]
  return venueShort && preposition ? `${label} ${preposition} ${venueShort}` : label
}
