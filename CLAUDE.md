# CLAUDE.md — sveltia-cms (musictide fork)

This file provides guidance to Claude Code when working in this repository.

## What This Is

A thin fork of [Sveltia CMS](https://github.com/sveltia/sveltia-cms) at tag `v0.166.0`, maintained for [musictide](https://musictide.pages.dev) — a photography-heavy digital zine covering rock and metal concerts in Portugal.

**Fork lives at:** `/home/n0xx/Code/infra/service/sveltia-cms`
**Musictide repo:** `/home/n0xx/Code/infra/service/musictide`

All changes in this repo are targeted fixes and features for musictide's specific needs. The goal is a thin patch layer that can be rebased on future upstream tags with minimal friction.

---

## Commands

```bash
# Install dependencies (first time or after pnpm-lock.yaml changes)
pnpm install

# Production build — outputs package/dist/sveltia-cms.js (~2 MB)
pnpm build

# After building, copy bundle to musictide:
cp package/dist/sveltia-cms.js /home/n0xx/Code/infra/service/musictide/static/admin/sveltia-cms.js

# Dev server (hot reload, for iterating on UI changes)
pnpm dev
```

---

## Architecture

**Tech stack:** Svelte 5 (runes: `$state`, `$derived`, `$effect`), SvelteKit, Vite, pnpm workspace, `@sveltia/i18n` (YAML locale files), TypeScript.

**Build output:** A single `package/dist/sveltia-cms.js` bundle. This file is committed to `musictide/static/admin/` and served directly from the Hugo site, replacing the CDN dependency.

**Patch strategy:** All musictide patches are clean commits on the `musictide-patches` branch, which is based off the `v0.166.0` tag. The `upstream` remote tracks `https://github.com/sveltia/sveltia-cms.git`. To pull a new upstream release, rebase `musictide-patches` onto the new tag.

**Upstream remote:**
```bash
git remote add upstream https://github.com/sveltia/sveltia-cms.git
git fetch upstream --tags
```

---

## Key Source Locations

| Path | What it is |
|------|-----------|
| `src/lib/locales/en.yaml` | English UI strings (source of truth for PT-PT translation) |
| `src/lib/locales/pt.yaml` | PT-PT translation (370 keys) |
| `src/lib/components/entrance/sign-in.svelte` | Sign-in UI; Google SSO button (`hasGoogleAuth` derived, gates on `base_url`) |
| `src/lib/services/backends/fs/local.js` | Local backend; `getRootDirHandle` calls `showDirectoryPicker` before any IndexedDB read |
| `src/lib/services/backends/fs/local.test.js` | Unit tests for local backend (34 passing, including ordering-guarantee test) |
| `src/lib/components/assets/browser/` | Media picker components |
| `src/lib/components/assets/browser/assets-panel.svelte` | Main picker panel; `selectedAssets` state lives here |
| `src/lib/components/assets/browser/select-assets-dialog.svelte` | Dialog wrapper; controls open/close, cache refresh |
| `src/lib/components/assets/browser/simple-image-grid.svelte` | Grid/thumbnail view (scroll bug here — still pending) |
| `src/lib/components/assets/browser/internal-assets-panel.svelte` | R2/internal asset list panel |
| `src/lib/components/assets/shared/upload-assets-dialog.svelte` | Upload dialog; post-upload callback |
| `src/lib/components/contents/details/toolbar.svelte` | Entry toolbar; "View on live site" button |
| `src/lib/components/contents/details/editor.svelte` | Edit/preview split view; scroll sync |
| `src/lib/components/contents/details/fields/` | Field widgets (image, list, relation…) |

---

## Musictide Context

The photographer (early 50s, primary content editor) uses the CMS mid-event, possibly on mobile, possibly slightly inebriated. Every UX decision should optimize for:
- Fewest taps/clicks to publish
- No confusing dead-end states
- Portuguese UI (photographer's browser is PT-PT)

**Musictide's `admin/index.html` monkey-patches:** The fetch interceptor, author injection, credential pre-seeding, preSave hook, and stock photo hack are permanent integrations and stay in `index.html`. UX patches (Ctrl+A select-all, upload toast, thumbnail fix) will move into the fork — once a fork fix supersedes one, remove the corresponding block from `index.html` in the musictide repo.

**Note:** Ctrl+A select-all (`e1bfee20`) is now handled by the fork. The corresponding monkey-patch has been removed from musictide's `index.html` (musictide `b76c50f`).

**Google SSO (`musictide-auth` Worker):** Sveltia is configured with `base_url: https://musictide-auth.leftfield.workers.dev`. The Worker serves a Google sign-in page at `/auth?provider=github&site_id=<domain>`, verifies the Google JWT against KV, and posts `authorization:github:success:{token}` back. Sveltia's existing OAuth message handler picks this up — no additional plumbing needed.

**Auth architecture (as of 2026-06-10):** KV keys are `HMAC-SHA256(GLOBAL_SALT, google_sub)` — opaque, stable, no PII in the repo. No raw emails anywhere in git history (purged via `git filter-repo`). KV values are `{"name":"..."}` only; email comes from Google JWT at login time. Legacy email-token entries (pre-migration) are auto-upgraded to sub-token on first login. Worker endpoints: `/verify` (dual-path lookup), `/compute-token` (PAT-auth'd, also upserts KV so new users can log in immediately without waiting for the sync webhook). `data/cms-users/*.json` files contain `{name, token}` — token is `HMAC(salt, email)` bootstrapped at creation, replaced by sub-token in KV after first login. Tests: `workers/musictide-auth/src/index.test.js` (18 tests).

**Security constraint:** Do NOT add `localhost` to the Worker's `ALLOWED_DOMAINS`. A local attacker could steal the service-account GitHub PAT. Local dev uses the "Work with Local Repository" path (File System Access API, no auth).

---

## Patch Backlog

These are the issues this fork exists to fix:

| Task | Status | Commit |
|------|--------|--------|
| Hide "View on live site" when `draft: true` | ✅ validated | `cb680d1c` |
| Ctrl+A selects all assets in media picker (internal) | ✅ validated | `e1bfee20` |
| Ctrl+A selects all assets in external/R2 media picker | ✅ validated | `848e0068` |
| Media list cache — allAssets reactive to store updates | ✅ done | `7dd4c149` |
| Preview↔edit pane scroll sync feedback loop | ✅ done | `c378756d` |
| Local repo AbortError — `showDirectoryPicker` before IndexedDB | ✅ validated | `43b08161` |
| Sign In with Google button (`hasGoogleAuth` gated on `base_url`) | ✅ validated | `5bbf472b` |
| PT-PT locale (`src/lib/locales/pt.yaml`) | ✅ validated | `9502772e` |
| Scroll broken in thumbnail/grid mode (`simple-image-grid.svelte`) | ✅ resolved (incidental) | — |
| Gallery picker auto-selects all R2 files when opened (no Ctrl+A needed) | ✅ validated | `414e215d` |
| Multi-select + drag-drop gallery ordering | ✅ validated | `527de591` |
| DropZone false-positive on SortableJS drop (type mismatch dialog) | ✅ validated | `ab6f2f3b` |
| Preview↔image selection link (click syncs preview pane back) | ✅ done | `c9718110` + current |
| Scroll sync jump — offsetTop wrong ancestor, ratio fallback overflow | ✅ done | `d5b00f35` + current |
| Inline create Events/Authors from relation field | ✅ validated | `ee075e7b` |
| CMS user auth — HMAC tokens, no emails in repo | ✅ validated | musictide `2bbe7d5` |
| Toast Alert guard when message undefined | ✅ done (untestable in single-locale setup) | `f4d632d4` |
| cms-users email field: show as read-only label pre-populated from auth JWT; prefer over silently clearing on save | **next** | — |
| Unify "Colaboradores" and "Utilizadores" collections into Sveltia | pending | — |
| Disable inline creation of Colaboradores/Utilizadores from Article editing form | ✅ validated | musictide `a962521` |
| Clicking gallery image in preview pane should scroll edit pane to that image, not to gallery section start | pending | — |
| Force PT-PT locale from `locale: pt` in config.yml | ✅ validated | `c4441290` |

**Locale config wiring notes (`c4441290`):**
- `locale` removed from `UNSUPPORTED_OPTIONS` in `src/lib/services/config/parser/index.js`.
- `setConfigLocale(locale)` exported from `src/lib/services/app/i18n.js` — stores config locale in a module-level variable so `initAppLocale` uses it on re-runs triggered by prefs loading.
- `initCmsConfig` calls `setConfigLocale(rawConfig.locale)` then `appLocale.set(rawConfig.locale)` — the direct set handles the current session, the stored variable handles the prefs re-run timing issue (prefs `$effect.pre` calls `initAppLocale` again asynchronously after LocalStorage loads).
- User's explicit `prefs.locale` still wins over config locale (correct UX precedence).

### Backlog notes

**Unify Colaboradores / Utilizadores — agreed design:**
- **Colaboradores is removed entirely.** Utilizadores/Users becomes the single collection covering both CMS access and public contributor profiles.
- All Colaboradores fields are added to Users as optional: `photo` (image), `body` (bio text), `public_email` (string — the old Colaboradores `email`, renamed; completely independent of auth), `instagram`, `facebook`, `x_twitter`, `bluesky`, `tiktok`, `youtube`, `spotify`, `draft`.
- `name` unifies both (`cms-users.name` = git commit author = `authors.title` = display name).
- The auth email field and its preSave hook remain as-is — `public_email` is a separate field.

**Open questions before implementation:**
1. **Storage location:** `cms-users` is `data/cms-users/*.json`; `authors` is `content/authors/*.md` (Hugo taxonomy). Merging means choosing one. Moving to `data/` breaks Hugo author taxonomy pages. Recommended: keep `content/authors/` as the merged folder, change format to markdown frontmatter, drop the JSON-specific cms-users folder (requires migrating existing `data/cms-users/*.json` files).
2. **Article relation migration:** Articles currently reference the `authors` collection by `title`. After merge the relation field stays pointing at authors (unchanged if we keep `content/authors/`), but the value field must align with the new identifier (`name` or `title` — pick one consistently).
3. **Existing file migration:** `content/authors/*.md` stays. `data/cms-users/*.json` files need to be migrated into `content/authors/` with a new auth-specific frontmatter block (`token:`). Auth Worker KV entries are unaffected.

**Disable inline creation of Colaboradores/Utilizadores from Article form:**
- Adding people to the platform mid-article is an accident waiting to happen. Inline creation (`ee075e7b`) should be scoped to Events only; the relation fields pointing at Authors/Users should be lookup-only.

Design specs and implementation plans live in `docs/superpowers/specs/` and `docs/superpowers/plans/`.

---

## Research Tool

**DeepWiki MCP** (`mcp__deepwiki__ask_question`) has indexed both `sveltia/sveltia-cms` and the Svelte 5 docs. Query it before grepping source when investigating an unfamiliar component or API.

```
ask_question("sveltia/sveltia-cms", "How is selectedAssets managed in the media picker?")
ask_question("sveltia/sveltia-cms", "How does the i18n locale loading work?")
```

Fall back to grep for exact line numbers or to confirm DeepWiki's answer.

---

## Rebasing onto a New Upstream Release

```bash
git fetch upstream --tags
# Review changelog for the new version
git rebase v<new-version> musictide-patches
# Fix any conflicts (targeted changes = rare conflicts)
pnpm install  # if deps changed
pnpm build
cp package/dist/sveltia-cms.js /home/n0xx/Code/infra/service/musictide/static/admin/sveltia-cms.js
cd /home/n0xx/Code/infra/service/musictide
git add static/admin/sveltia-cms.js
git commit -m "chore(cms): bump fork base to Sveltia v<new-version>"
git push origin main
```

---

## Build Verification

After any change:
```bash
pnpm build
ls -lh package/dist/sveltia-cms.js  # expect ~1.8–2.2 MB
```

No errors = good. Warnings about unused exports are acceptable.

---

## Environment / Tooling

`pnpm` is already installed in this environment. Do not interrupt builds to install or verify it.

---

## Security

Before committing any plan, doc, or config file, scan for secrets (PATs, OAuth tokens, API keys, emails) and never commit them. Use placeholders or env vars instead. A leaked PAT in a committed plan doc has previously required a `git filter-repo` history rewrite to scrub.

---

## Build & Deploy

Never assume Cloudflare Pages does clean builds. The `public/` directory can be stale — verify build artifacts and clear them when debugging unexpected output.

---

## Sveltia CMS / Frontend

When fixing Sveltia CMS UI bugs (toasts, thumbnails, selectors, etc.), inspect the actual rendered DOM via Playwright `browser_evaluate` to find correct query selectors rather than guessing from component structure. Guessed selectors have consistently missed Sveltia's real DOM layout.

---

## Documentation

Validate documentation against the actual implemented code, not just plan docs. Features and field names described in plans may never have been built — cross-check against source before documenting.
