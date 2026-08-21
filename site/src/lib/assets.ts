import manifest from './asset-manifest.json'

/**
 * Appends a short content hash to a generated asset URL.
 *
 * Generated files keep stable names (session-1.webp, john-the-ant.pdf …), so
 * without this a regenerated image stays behind Cloudflare's cache for up to a
 * day — visitors keep seeing the old one. Hashing the contents into ?v= means
 * changed files get a new URL and appear immediately, while unchanged files
 * stay cached.
 *
 * Unknown paths pass through untouched.
 */
export function assetUrl(path: string | undefined): string | undefined {
  if (!path) return path
  const hash = (manifest as Record<string, string>)[path]
  return hash ? `${path}?v=${hash}` : path
}
