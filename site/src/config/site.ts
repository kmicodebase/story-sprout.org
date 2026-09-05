/**
 * Every externally-changeable value for the site lives here. Do not scatter
 * these URLs through components.
 *
 * Fields left as empty strings are NOT YET SUPPLIED by the project team.
 * Components must treat an empty string as "not configured" and hide the
 * corresponding UI rather than rendering a link that goes nowhere or a form
 * that discards submissions. See docs/CONTENT_GAPS.md.
 */
export const siteConfig = {
  name: 'Story Sprout',
  canonicalUrl: 'https://story-sprout.org',

  /**
   * Story Sprout Studio — the platform children actually write in. Every
   * "Try Story Sprout Studio" button opens this.
   *
   * The older Bubble app (somethingbeautiful322.bubbleapps.io) is no longer
   * linked from this site.
   */
  platformUrl: 'https://kmicodebase.github.io/kmi_story_sprout_studio/workshop-plugin.html',

  /** Story Sprout Studio's educator-facing view, linked from the header. */
  teacherUrl: 'https://kmicodebase.github.io/kmi_story_sprout_studio/teacher.html',

  /** The outgoing microsite this site replaces. */
  legacyUrl: 'https://storysprout.kindnessmattersinc.org/',

  /** Story Sprout Studio's source, public under an MIT licence. */
  codeUrl: 'https://github.com/kmicodebase/kmi_story_sprout_studio',

  /** Parent nonprofit. Verified from the legacy site footer. */
  parentOrg: {
    name: 'Kindness Matters Inc',
    url: 'https://kindnessmattersinc.org',
    /** Legacy footer states "501(c)(3) Nonprofit Organization" for this org. */
    taxStatusDisplay: '501(c)(3) nonprofit organization',
  },

  /**
   * Givebutter giving hub run by the parent nonprofit. Setting this switches
   * /donate/ from its "not set up yet" state to the real flow, and lifts the
   * noindex that was keeping an unfinished page out of search.
   */
  donationUrl: 'https://givebutter.com/kindness-matters-inc',
  /** NOT SUPPLIED — the "Stay in the loop" band stays hidden until this exists. */
  newsletterUrl: '',
  /** NOT SUPPLIED — footer omits a contact line until this exists. */
  contactEmail: '',
  /** NOT SUPPLIED — no social icons render while this is empty. */
  social: [] as { label: string; href: string }[],

  /**
   * Applies to the teaching materials only — session decks and anything else
   * written for educators to reuse.
   *
   * It deliberately does NOT cover the children's storybooks. Those are the
   * children's own work, published with specific consent, and a licence
   * inviting anyone to copy and adapt them would cut straight across that.
   * See docs/PRIVACY_REVIEW.md.
   */
  license: {
    name: 'Creative Commons BY-NC-SA 4.0',
    short: 'CC BY-NC-SA 4.0',
    url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
  },

  description:
    'A picture-book writing program for ages 7–13. Children write every sentence and direct the AI that illustrates it, then read their finished book aloud.',
} as const

/**
 * Content whose consent status is not yet confirmed is excluded from production
 * builds. During local development it is shown with a visible "pending" badge so
 * the team can review it before approving. Set PUBLIC_SHOW_PENDING=true to
 * force it on in a build (for a private review deploy only).
 */
export const showPendingContent =
  import.meta.env.DEV || import.meta.env.PUBLIC_SHOW_PENDING === 'true'

export const navLinks = [
  { label: 'About', href: '/about/' },
  { label: 'Curriculum', href: '/curriculum/' },
  { label: 'Stories', href: '/stories/' },
  { label: 'Research & Code', href: '/research/' },
  { label: 'Donate', href: '/donate/' },
]
