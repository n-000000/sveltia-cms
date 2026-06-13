# Backlog Batch 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the top four actionable pending issues in the sveltia-cms fork and update both repos; leave Issue 5 (Unify Colaboradores/Utilizadores) as a design-only brainstorm task.

**Architecture:** Issues 2 and 3 are musictide config changes only (no fork build). Issues 1 and 4 are targeted fork patches, each one commit. Issue 5 enters brainstorming, not implementation. All changes verified via Playwright before commit.

**Tech Stack:** Svelte 5 runes, `@sveltia/i18n`, SvelteKit/Vite, `pnpm build`, Hugo 1313, Playwright MCP. YAML config in musictide.

---

## Pre-flight

Before starting any task, verify the environment:

- [ ] Confirm branch: `git -C /home/n0xx/Code/infra/service/sveltia-cms branch --show-current` → must be `musictide-patches`
- [ ] Confirm no dirty fork state: `git -C /home/n0xx/Code/infra/service/sveltia-cms status --short`
- [ ] Start Hugo dev server in background: `cd /home/n0xx/Code/infra/service/musictide && yarn watch &`
- [ ] Seed localStorage PAT — check `memory/feedback_verification_flow.md` for current PAT and seed command; PAT validity may have expired (was 2026-06-15), generate a new one if needed at github.com → Settings → Developer settings → Personal access tokens

---

## Task 1 — Force PT-PT locale from config (fork change)

**Files:**
- Modify: `src/lib/services/config/parser/index.js` (remove `locale` from unsupported list)
- Modify: `src/lib/services/config/index.js` (wire config locale → appLocale after parse)
- Modify: `/home/n0xx/Code/infra/service/musictide/static/admin/config.yml` (add `locale: pt`)
- Modify: `/home/n0xx/Code/infra/service/musictide/static/admin/sveltia-cms.js` (copy of fork build)

**Context:**
`src/lib/services/config/parser/index.js:26` currently puts `locale` in `UNSUPPORTED_OPTIONS` with a warning, so `locale: pt` in config.yml is silently ignored. `prefs.svelte.js:68-69` already applies `prefs.locale` to `appLocale`. The fix: (a) stop warning about `locale`, (b) read it from the raw config after parsing and set `appLocale` directly (not via prefs, so it doesn't persist to localStorage and override a future real user preference system).

- [ ] **Step 1: Remove `locale` from UNSUPPORTED_OPTIONS**

In `src/lib/services/config/parser/index.js`, remove the locale entry:

```js
// BEFORE
const UNSUPPORTED_OPTIONS = [
  { type: 'warning', prop: 'publish_mode', value: 'editorial_workflow', strKey: 'editorial_workflow_unsupported' },
  { type: 'warning', prop: 'local_backend', strKey: 'unsupported_ignored_option' },
  // Sveltia CMS detects user's locale from the browser, so this option is not applicable.
  { type: 'warning', prop: 'locale', strKey: 'unsupported_ignored_option' },
  { type: 'warning', prop: 'search', strKey: 'unsupported_ignored_option' },
];

// AFTER — remove the locale line and its comment
const UNSUPPORTED_OPTIONS = [
  { type: 'warning', prop: 'publish_mode', value: 'editorial_workflow', strKey: 'editorial_workflow_unsupported' },
  { type: 'warning', prop: 'local_backend', strKey: 'unsupported_ignored_option' },
  { type: 'warning', prop: 'search', strKey: 'unsupported_ignored_option' },
];
```

- [ ] **Step 2: Wire config locale → appLocale in config/index.js**

`src/lib/services/config/index.js` already imports `{ _ } from '@sveltia/i18n'` at line 1. Extend it:

```js
// BEFORE (line 1)
import { _ } from '@sveltia/i18n';

// AFTER
import { _, locale as appLocale, locales as appLocales } from '@sveltia/i18n';
```

Then, after the `cmsConfig.set(config)` call (around line 153), add:

```js
if (rawConfig.locale && appLocales.includes(rawConfig.locale)) {
  appLocale.set(rawConfig.locale);
}
```

- [ ] **Step 3: Add `locale: pt` to musictide config.yml**

In `/home/n0xx/Code/infra/service/musictide/static/admin/config.yml`, find the top-level block (near `backend:`, `media_library:`, etc.) and add:

```yaml
locale: pt
```

Place it near the top of the file, alongside `site_url`, `base_url`, etc.

- [ ] **Step 4: Build and deploy**

```bash
cd /home/n0xx/Code/infra/service/sveltia-cms
pnpm build
ls -lh package/dist/sveltia-cms.js   # expect 1.8–2.2 MB, no errors
cp package/dist/sveltia-cms.js /home/n0xx/Code/infra/service/musictide/static/admin/sveltia-cms.js
```

- [ ] **Step 5: Verify via Playwright**

Open the CMS at `http://localhost:1313/admin/`. After sign-in, confirm the UI is in Portuguese regardless of the browser's language setting. Check at least two UI strings visible on the collection list page (e.g., collection names, any button labels). Take a screenshot.

If browser is already set to PT: temporarily change the test by checking that the locale is set via the config, not just coincidence — open DevTools console and run: `localStorage.getItem('sveltia-cms.prefs')` — the `locale` key should NOT be `pt` (it's set from config, not prefs). The UI should still be PT.

- [ ] **Step 6: Commit fork change**

```bash
cd /home/n0xx/Code/infra/service/sveltia-cms
git add src/lib/services/config/parser/index.js src/lib/services/config/index.js
git commit -m "feat: honour locale config option to override browser language"
```

- [ ] **Step 7: Commit musictide changes**

```bash
cd /home/n0xx/Code/infra/service/musictide
git add static/admin/config.yml static/admin/sveltia-cms.js
git commit -m "feat(cms): set locale: pt; update fork bundle"
git push origin main
```

- [ ] **Step 8: Push fork**

```bash
cd /home/n0xx/Code/infra/service/sveltia-cms
git push origin musictide-patches
```

- [ ] **Step 9: Update CLAUDE.md backlog**

In `sveltia-cms/CLAUDE.md`, change the locale row status to `✅ done` and record the commit hash.

---

## Task 2 — Disable inline creation of Authors/Users from Article form (config-only)

**Files:**
- Modify: `/home/n0xx/Code/infra/service/musictide/static/admin/config.yml`

**Context:**
`relation-editor.svelte:46` gates the "+" inline-create button on `inline_create: inlineCreate = false`. Currently, 4 author relation fields in the `posts` collection have `inline_create: true`. Removing that key (default is `false`) disables the button with no fork change. This task does NOT need a build.

- [ ] **Step 1: Find all inline_create fields in posts collection**

Run:
```bash
grep -n "inline_create" /home/n0xx/Code/infra/service/musictide/static/admin/config.yml
```
Expected output: 4 lines, all in the `posts` collection, all `inline_create: true`.

- [ ] **Step 2: Remove inline_create and create_label from all author relation fields**

For each of the 4 occurrences, remove the `inline_create: true` line and its adjacent `create_label: "Criar colaborador…"` line. Do NOT touch any Event relation fields — those keep `inline_create: true`.

After editing, verify no remaining `inline_create` in author fields:
```bash
grep -n "inline_create\|create_label" /home/n0xx/Code/infra/service/musictide/static/admin/config.yml
```
Expected: only Event-related `inline_create: true` entries remain (if any).

- [ ] **Step 3: Verify via Playwright**

Open an existing article in the CMS editor (`http://localhost:1313/admin/`). Find the author/colaborador relation field. Confirm the "+" (inline create) button is gone. The dropdown should still allow selecting from existing authors. Take a screenshot.

- [ ] **Step 4: Commit**

```bash
cd /home/n0xx/Code/infra/service/musictide
git add static/admin/config.yml
git commit -m "feat(cms): disable inline creation of authors from article form"
git push origin main
```

- [ ] **Step 5: Update CLAUDE.md backlog**

In `sveltia-cms/CLAUDE.md`, change the "disable inline creation" row status to `✅ done`. Commit and push sveltia-cms.

---

## Task 3 — cms-users email field UX (config + fork investigation)

**Files:**
- Modify: `/home/n0xx/Code/infra/service/musictide/static/admin/config.yml` (token field `readonly: true`)
- Investigate: fork change for JWT email auto-populate (see below)

**Context:**
The cms-users collection has: `name`, `email` (string, clears on save via preSave hook), `token` (string, auto-computed). The UX problem: after saving a new user, the `email` field is blank (confusing). The `token` field should be read-only to prevent accidental edits.

`field-editor.svelte:97` supports `readonly: true` on any field via the `readonly:` key in fieldConfig. This is a config-only capability.

**This task has two phases; complete Phase A even if Phase B is deferred.**

### Phase A — Config-only fixes (do first, no build needed)

- [ ] **Step 1: Mark token field as readonly**

In `config.yml`, find the `token` field under the `cms-users` collection and add `readonly: true`:

```yaml
- label: Token
  name: token
  widget: string
  required: false
  readonly: true
  hint: "Preenchido automaticamente ao guardar. Não editar manualmente."
```

- [ ] **Step 2: Improve email field hint**

Update the `email` field hint to be explicit about the clearing behavior:

```yaml
- label: Email Google
  name: email
  widget: string
  pattern: ['^[^@\s]+@[^@\s]+\.[^@\s]+$', 'Deve ser um endereço de email válido']
  hint: "Email do utilizador. Após guardar, este campo fica vazio — o token de acesso é gerado automaticamente a partir do email e guardado no campo abaixo."
```

- [ ] **Step 3: Verify via Playwright**

Open an existing cms-users entry. Confirm the token field is read-only (cannot be clicked/edited). Create a new user entry, fill in name + email, save, then re-open — confirm the token field has a value and the email field is blank, and that the hints explain this clearly. Take a screenshot of the edit view after save.

- [ ] **Step 4: Commit Phase A**

```bash
cd /home/n0xx/Code/infra/service/musictide
git add static/admin/config.yml
git commit -m "feat(cms): token field readonly; improve email field hint text"
git push origin main
```

### Phase B — Fork: auto-populate email from JWT (preferred UX, investigate first)

**Investigation:** Before writing any code, answer these questions by reading the source:
1. When the photographer opens the CMS, `mt-current-user` in localStorage contains `{ name, email }` (set by the `mt-user-data` listener in `index.html`). What fields does it have? Run in DevTools: `JSON.parse(localStorage.getItem('mt-current-user'))`.
2. Is there an existing mechanism in Sveltia to set a field's initial/default value programmatically? Check `src/lib/components/contents/details/fields/` for `defaultValue`, `default:` field config, or similar.
3. Does `compute` widget exist? Check `src/lib/components/contents/details/fields/index.js` for a `compute` entry.

**Only proceed with Phase B if:** the `mt-current-user` email is reliably present AND there is a clean hook to set field values without forking deeply.

If Phase B is viable, the implementation is:
- The email field should auto-populate from `localStorage.getItem('mt-current-user')` when creating a NEW cms-users entry
- It should be read-only once populated (to prevent mistyping someone else's email when self-registering)
- If `mt-current-user` is absent, fall back to an editable field

**This is a fork change.** If the investigation shows it requires touching more than 2 files or > 40 lines of Sveltia internals, defer it and update the backlog note in CLAUDE.md with the investigation findings.

- [ ] **Step 5: Update CLAUDE.md backlog**

In `sveltia-cms/CLAUDE.md`, update the cms-users email row: mark Phase A as `✅ done` with commit hash. If Phase B was deferred, update the backlog note with investigation findings. Commit and push.

---

## Task 4 — Gallery preview click scrolls to clicked image (fork change)

**Files:**
- Modify: `src/lib/components/contents/details/fields/file/file-preview.svelte` (per-item click handler)
- Modify: `src/lib/components/contents/details/fields/file/file-editor.svelte` (add `data-key-path` per item)
- Modify: `src/lib/components/contents/details/content-details-overlay.svelte` (fallback selector)
- Modify: `/home/n0xx/Code/infra/service/musictide/static/admin/sveltia-cms.js` (copy of fork build)

**Context:**
Current flow: clicking any gallery image in the preview pane → `field-preview.svelte` fires `{ type: 'highlight-editor-field', payload: { locale, keyPath: 'gallery' } }` → `content-details-overlay.svelte:284-286` queries `.field[data-key-path="gallery"]` → scrolls to the gallery section header.

Target flow: clicking the 3rd gallery image fires `{ keyPath: 'gallery.2' }` → overlay queries `[data-key-path="gallery.2"]` (on the `.sort-item` div) → scrolls to that specific image.

Three coordinated changes required:

- [ ] **Step 1: Add per-item data-key-path to file-editor.svelte**

In `src/lib/components/contents/details/fields/file/file-editor.svelte`, find the `{#each currentValue as value, index (value)}` block (around line 373). The div currently reads:

```svelte
<div role="none" class="sort-item" data-sort-index={index}>
```

Change it to:

```svelte
<div role="none" class="sort-item" data-sort-index={index} data-key-path="{keyPath}.{index}">
```

(Use `{keyPath}.{index}` — Svelte attribute interpolation with braces.)

- [ ] **Step 2: Add per-item click handler in file-preview.svelte**

In `src/lib/components/contents/details/fields/file/file-preview.svelte`, the multiple-value block currently reads:

```svelte
{#if isMultiple(fieldConfig)}
  {#if Array.isArray(currentValue)}
    {#each currentValue as value, index (`${value}-${index}`)}
      <FilePreviewItem {value} {fieldConfig} {typedKeyPath} />
    {/each}
  {/if}
```

This file doesn't have access to `locale` or `keyPath` directly — check what props it receives. Read the full `$props()` block and the `FieldPreviewProps` type to confirm what's available.

The component receives `keyPath` and `locale` via `FieldPreviewProps`. Add a click handler that stops propagation (so the parent `<section>` handler in `field-preview.svelte` doesn't also fire) and posts the per-item message:

```svelte
{#if isMultiple(fieldConfig)}
  {#if Array.isArray(currentValue)}
    {#each currentValue as value, index (`${value}-${index}`)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        role="none"
        onclick={(e) => {
          e.stopPropagation();
          window.postMessage(
            { type: 'highlight-editor-field', payload: { locale, keyPath: `${keyPath}.${index}` } },
            window.location.origin,
          );
        }}
      >
        <FilePreviewItem {value} {fieldConfig} {typedKeyPath} />
      </div>
    {/each}
  {/if}
```

`field-preview.svelte:94` passes `{keyPath}` and `{locale}` to `<Preview>`, but `file-preview.svelte` currently only destructures `{ typedKeyPath, fieldConfig, currentValue }` from `$props()`. Add `keyPath` and `locale` to both the `Props` typedef and the `$props()` destructuring:

```js
/**
 * @typedef {object} Props
 * @property {string} keyPath Field key path.
 * @property {string} locale Locale code.
 * @property {MediaField} fieldConfig Field configuration.
 * @property {string | string[] | undefined} currentValue Field value.
 */

let {
  keyPath,
  locale,
  typedKeyPath,
  fieldConfig,
  currentValue,
} = $props();
```

- [ ] **Step 3: Add fallback selector in content-details-overlay.svelte**

In `src/lib/components/contents/details/content-details-overlay.svelte:284-286`, the current selector only matches `.field[data-key-path=...]`. The sort-item div has class `sort-item`, not `field`, so we need a fallback:

```js
// BEFORE
const targetField = document.querySelector(
  `.content-editor .pane[data-mode="edit"][data-locale="${CSS.escape(locale)}"] ` +
    `.field[data-key-path="${CSS.escape(keyPath)}"]`,
);

// AFTER
const paneSelector =
  `.content-editor .pane[data-mode="edit"][data-locale="${CSS.escape(locale)}"]`;

const targetField =
  document.querySelector(`${paneSelector} .field[data-key-path="${CSS.escape(keyPath)}"]`) ??
  document.querySelector(`${paneSelector} [data-key-path="${CSS.escape(keyPath)}"]`);
```

Apply the same two-pass pattern to the `previewField` query at line 300-303, replacing `.pane[data-mode="preview"]` accordingly.

- [ ] **Step 4: Build and deploy**

```bash
cd /home/n0xx/Code/infra/service/sveltia-cms
pnpm build
ls -lh package/dist/sveltia-cms.js
cp package/dist/sveltia-cms.js /home/n0xx/Code/infra/service/musictide/static/admin/sveltia-cms.js
```

- [ ] **Step 5: Verify via Playwright**

Open an article with multiple gallery images. In the preview pane, click the 2nd gallery image. Confirm the edit pane scrolls to the 2nd image in the gallery list (not to the gallery section header). Take before/after screenshots. Then click the 1st image — confirm scroll targets the 1st. Click the gallery section header (not an image) — confirm it still scrolls to the gallery field root (regression check).

- [ ] **Step 6: Commit**

```bash
cd /home/n0xx/Code/infra/service/sveltia-cms
git add \
  src/lib/components/contents/details/fields/file/file-preview.svelte \
  src/lib/components/contents/details/fields/file/file-editor.svelte \
  src/lib/components/contents/details/content-details-overlay.svelte
git commit -m "feat: gallery preview click scrolls edit pane to clicked image"
git push origin musictide-patches
```

- [ ] **Step 7: Commit musictide bundle**

```bash
cd /home/n0xx/Code/infra/service/musictide
git add static/admin/sveltia-cms.js
git commit -m "chore(cms): update fork bundle — gallery click scrolls to image"
git push origin main
```

- [ ] **Step 8: Update CLAUDE.md backlog**

Mark the gallery click row as `✅ validated` in `sveltia-cms/CLAUDE.md`. Commit and push.

---

## Task 5 — Unify Colaboradores/Utilizadores (design only — invoke brainstorming)

**This task produces a design doc, not code. Do NOT write implementation code in this task.**

**Prerequisite:** Task 3 Phase A must be complete. The brainstorming should be informed by the actual state of the email/token split.

- [ ] **Step 1: Invoke brainstorming skill**

Start a fresh conversation (or continuation) and invoke:
```
/brainstorm Unify "Colaboradores" (authors, public-facing) and "Utilizadores" (CMS users, auth-only) collections into a single Sveltia-managed model. Key constraints: auth email must never be committed to git; public email (on Colaboradores) is fine to commit; current auth uses HMAC(salt, google_sub) tokens. Investigate whether the two collections can share a linked record or should merge. The inline_create for authors is now disabled in the article form.
```

- [ ] **Step 2: Ensure design doc covers these questions**

The brainstorming output must answer:
1. Single collection or two linked collections?
2. How does the public email (Colaboradores) coexist with the auth token (Utilizadores) without ever landing in git?
3. Who can edit what — photographer only, or self-service by contributors?
4. What happens to existing `data/cms-users/*.json` and `content/authors/*.md` files on migration?

- [ ] **Step 3: Save and commit design doc**

The brainstorming skill will write the spec to `docs/superpowers/specs/YYYY-MM-DD-unify-users-authors-design.md`. Commit it:

```bash
cd /home/n0xx/Code/infra/service/sveltia-cms
git add docs/superpowers/specs/
git commit -m "docs: add design spec for Colaboradores/Utilizadores unification"
git push origin musictide-patches
```

---

## Post-session

- [ ] Update `memory/project_fork_context.md` with all new patch commit hashes
- [ ] Create `memory/project_session_2026-06-14.md` with what was done
- [ ] Update `MEMORY.md` index
- [ ] Push `sveltia-cms/CLAUDE.md` with all status changes
