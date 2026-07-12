# Test plan — Sveltia fork v0.170.6 (musictide)

Manual `/admin/` verification of the re-derived patch groups **A–F** before the 0.170.6
build replaces the live 0.166.1 bundle on R2. Unit tests already pass (6902); this covers
what units can't: the actual browser UI.

**Build under test:** `/home/n0xx/Code/infra/service/sveltia-cms-mt/wt-0.170.6/package/dist/sveltia-cms.js`
(2.05 MB, branch `musictide-patches-0.170.6`, tip `ac8bd6cc`).

**Browser:** Chrome or Edge only (local-repo mode uses the File System Access API). This is a
**human-driven** session — `showDirectoryPicker()` and the Google popup need real user gestures,
so Playwright/automation can't do Phase 1 or the SSO part of Phase 2.

---

## Phase 1 — local-repo mode (no R2 publish, catches bugs first)

Run against the local build so a regression can't reach editors. Point `/admin/` at the local
bundle instead of the R2 URL:

```bash
# From the musictide repo root (main checkout, not this fork worktree):
cp /home/n0xx/Code/infra/service/sveltia-cms-mt/wt-0.170.6/package/dist/sveltia-cms.js \
   static/admin/sveltia-cms.js          # gitignored — safe, won't be committed
```

Then edit `static/admin/index.html` — swap the one bundle line:

```html
<!-- from -->
<script src="https://pub-3c7d6b33a4774fe093eb6028e8c2aba1.r2.dev/musictide/sveltia-cms.js"></script>
<!-- to -->
<script src="/admin/sveltia-cms.js"></script>
```

> ⚠️ **`index.html` is tracked. REVERT before any commit/push** (`git checkout static/admin/index.html`)
> — leaving the local path in prod makes `/admin/` load a non-existent file. It's the only tracked
> change; it shows in `git status`.

Start the site and open the admin:

```bash
run                                     # hugo server → http://localhost:1313
```

1. Open `http://localhost:1313/admin/` in Chrome/Edge.
2. Choose **"Work with Local Repository"** → pick the musictide repo root.
   - ✅ **B (local-repo fix):** the picker opens with no `AbortError`, repo loads, collections list.
3. **For upload/gallery tests only** (R2 needs a token in local-repo mode — no Google login):
   in the `/admin/` devtools console, seed a PAT with push access to `n-000000/musictide`, then reload:
   ```js
   localStorage.setItem('decap-cms-user', JSON.stringify({ token: 'ghp_…' }))
   ```

### Checklist

| # | Group | Steps | Expected (pass) |
|---|-------|-------|-----------------|
| A | **PT-PT locale** | Look at the whole UI chrome. | Sidebar, buttons, field labels render in Portuguese (e.g. "Guardar", "Publicar"), not English. |
| C | **Scroll-sync + hide "View on live"** | Open a **draft** post in **Artigos**; scroll the edit pane. | Preview pane scrolls in sync with the edit pane. The **"Ver no site" / "View on live site"** toolbar button is **absent** while `draft: true`. |
| D | **Gallery multi-select / Ctrl+A / DnD reorder** | Open a post → **Galeria** field → open the media picker. Select several R2 images, use **Ctrl+A**, insert. Then drag thumbnails to reorder. | Picker **auto-selects all** files on open; **Ctrl+A** selects all (inserts >1, not just 1); drag-drop **reorders** and the new order persists on save. No spurious DropZone highlight when dragging within the field. |
| E | **Inline-create from relation** ⭐ | Open/create a post → **Evento** field → type a new event name in the combobox → pick **"Criar evento…"**. Fill **Nome** (pre-filled with your typed text) → **Save**. | Dialog opens **pre-filled** with the typed text. Saving writes `content/events/<slug>/_index.md` (visible in the working tree) **and** auto-selects the new event in the Evento field. The article's `event:` frontmatter gets the new title. |
| F | **Hashtag → tags** ⭐ | Create a post, put `#foo #bar` in the **body**, Save. | `content/posts/…md` frontmatter gains `tags: [foo, bar]`. (This is the chaining-bug fix — confirm tags aren't clobbered back out by the other preSave hooks.) |

⭐ = highest-value (E is the just-ported feature; F is the chaining fix). If short on time, do these two first.

After Phase 1: **revert `index.html`**, delete `static/admin/sveltia-cms.js` (optional, it's gitignored).

---

## Phase 2 — live smoke test (after R2 publish)

Only once Phase 1 is clean. Publishing swaps the live CMS to 0.170.6:

```bash
# from the MAIN musictide repo root (publish-cms reads ../sveltia-cms/package/dist/):
# NOTE: the build is in the fork WORKTREE, not the canonical ../sveltia-cms checkout.
# Either build in ../sveltia-cms on this branch, or copy the artifact there first:
cp /home/n0xx/Code/infra/service/sveltia-cms-mt/wt-0.170.6/package/dist/sveltia-cms.js \
   /home/n0xx/Code/infra/service/sveltia-cms/package/dist/sveltia-cms.js
publish-cms                             # wrangler r2 object put … --cache-control no-cache
```

Editors get the new bundle on next load (no-cache/ETag). Then on the live site:

1. **B (Google SSO):** open `https://musictide.pages.dev/admin/`, log in with Google → succeeds,
   Sveltia loads. (This part can't be tested locally — needs the deployed auth Worker.)
2. **F end-to-end (the still-pending smoke test):** save a post with a `#hashtag` in the body →
   confirm the GitHub commit lands `tags:` in frontmatter.
3. **E end-to-end:** inline-create an event → confirm the `content/events/…` file is committed to GitHub.

---

## If something fails

Fork source is in worktree `sveltia-cms-mt/wt-0.170.6`. Fix there, rebuild
(`./node_modules/.bin/vite build`), re-copy the bundle, re-test. Per-group traps and the
re-derivation rationale are in `REBASE-RUNBOOK.md` (same directory).
