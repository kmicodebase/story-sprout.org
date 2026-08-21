# Deployment — Cloudflare Pages + story-sprout.org

Nothing has been deployed yet. This machine has no Cloudflare credentials, and
`wrangler login` opens a browser, so the first two steps have to be run by you.
Everything else is already configured.

## Before you publish

Read `PRIVACY_REVIEW.md`. Three storybooks currently live on the site have children's
first names printed into the cover artwork and inside the PDFs. Publishing puts those names
on the public internet, where they will be indexed. That is a decision to make
deliberately, not by deploying.

Also outstanding: the paper's first page still says "Do not distribute" (see
`CONTENT_GAPS.md`), and the five advisor institutions on `/research/` have not been
confirmed as approved to be named.

## Build settings

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Output directory | `dist` |
| Build root / project directory | `site` |
| Node version | `22` (set `NODE_VERSION=22` in Pages env vars) |
| Environment variables | none required |

Do **not** set `PUBLIC_SHOW_PENDING` in production — it reveals consent-pending content.

---

## Step 1 — Log in and deploy a preview

```bash
cd site
nvm use
npx wrangler login          # opens a browser; authorise the account that will own the site
npm run deploy:preview
```

The first deploy will offer to create the project. Accept, and name it `story-sprout`
(the name is already baked into the `deploy` scripts in `package.json`).

You get a `https://<hash>.story-sprout.pages.dev` URL. **Review it before going further.**

### What to check on the preview

- The three `_headers` security headers actually applied:
  `curl -sI https://<your-preview>.pages.dev | grep -i "content-security\|x-content-type\|referrer"`
- The Content-Security-Policy has not broken anything: the homepage renders styled, the
  mobile menu opens, and the "Read the paper" reader opens on `/research/`. CSP is the one
  thing here that cannot be tested locally, because Pages applies it and the dev server
  does not. If the reader or styles break, relax the offending directive in
  `public/_headers`.
- Storybook PDFs download.
- `/donate/` returns `noindex` and is absent from `/sitemap-index.xml`.
- No orange "Review build" banner anywhere, and only four storybooks are listed.

## Step 2 — Publish to production

```bash
npm run deploy
```

---

## Step 3 — What you need to do in GoDaddy

**One change: point the domain's nameservers at Cloudflare.** Nothing else in GoDaddy.

This is required because `story-sprout.org` is an apex domain. Apex domains cannot use a
CNAME, and GoDaddy does not support CNAME flattening, so GoDaddy's DNS cannot point the
bare domain at Pages. Cloudflare's DNS can.

1. **In Cloudflare first** — Dashboard → *Add a site* → `story-sprout.org` → choose the
   Free plan. Cloudflare scans the existing records and shows you **two nameservers**,
   something like `xxx.ns.cloudflare.com` and `yyy.ns.cloudflare.com`. Copy them.
2. **Check what you would be replacing.** Before switching, look at the DNS records
   Cloudflare imported. If `story-sprout.org` currently has **email** (MX records) or any
   subdomain in use, confirm those records came across — switching nameservers moves *all*
   DNS, so a missing MX record silently breaks email.
3. **In GoDaddy** — sign in → *My Products* → find `story-sprout.org` → **DNS** →
   *Nameservers* → **Change** → *I'll use my own nameservers* → paste the two Cloudflare
   nameservers → Save. Remove any trailing dots if GoDaddy complains.
4. Wait for propagation. Usually under an hour, occasionally up to 24. Cloudflare emails
   you when the domain is active.

**Do not** change GoDaddy's A records, do not buy GoDaddy's "Domain Forwarding", and do not
cancel anything. The nameserver change is the whole job.

## Step 4 — Attach the domain to the Pages project

Once Cloudflare reports the domain active:

1. Cloudflare Dashboard → **Workers & Pages** → `story-sprout` → **Custom domains** →
   *Set up a custom domain* → `story-sprout.org`. Cloudflare creates the DNS record itself.
2. Add `www.story-sprout.org` as a second custom domain.
3. Make `www` redirect to the apex, so the site has one canonical address (every
   `<link rel="canonical">` on the site already points at the apex):
   Dashboard → **Rules → Redirect Rules** → *Create rule*
   - If: `Hostname equals www.story-sprout.org`
   - Then: Dynamic redirect, **301**, expression:
     `concat("https://story-sprout.org", http.request.uri.path)`
   - Preserve query string: on
4. Wait for the certificate to be issued (a few minutes), then confirm:

```bash
curl -sI https://story-sprout.org | head -1                    # 200
curl -sI https://www.story-sprout.org | head -2                # 301 → apex
curl -s https://story-sprout.org/sitemap-index.xml | head -3   # sitemap resolves
```

---

## Step 5 — The legacy microsite (do this last, and only when asked)

`https://storysprout.kindnessmattersinc.org/` is on a **different hostname that this site
does not control**, so nothing deployed here can redirect it. The redirect has to be added
wherever that host is served from.

Per the brief, do not activate it until the new site is live on HTTPS, the content has been
reviewed, and the project owner approves. When that happens, the mapping is:

| Old URL | New URL |
|---|---|
| `/` (the whole microsite) | `https://story-sprout.org/` |

The legacy page is a single page with no deep links, so a blanket 301 to the homepage loses
nothing. Its four storybooks and four session decks all live on the new site already —
`CONTENT_GAPS.md` has the mapping. Prefer an HTTP 301 over a meta-refresh.

---

## Redeploying later

```bash
cd site && nvm use && npm run verify && npm run deploy
```

`npm run verify` is worth running first every time — it fails the build on missing alt text,
a consent violation, or a broken internal link.

## Optional: deploy from GitHub instead

The site is not currently in a Git repository. If you would rather have Pages rebuild
automatically on every push:

1. `git init`, commit, and push to GitHub (`gh repo create` is already authenticated as
   `lzhangsktlab`).
2. Cloudflare Pages → *Connect to Git* → pick the repo.
3. Use the build settings in the table at the top, and set the **build root to `site`** —
   the repository root is the source-material folder, not the app.
4. Add `NODE_VERSION=22`.

Note that this would put the storybook PDFs and the manuscript into Git history.
