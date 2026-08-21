// @ts-check
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://story-sprout.org',
  // Trailing slashes everywhere, matching the routes in CLAUDE.md §7.
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    sitemap(),
  ],
})
