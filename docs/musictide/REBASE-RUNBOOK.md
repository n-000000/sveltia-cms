# Musictide fork — re-derivation runbook

Upstream Sveltia **rewrites its git history** (release tags get clobbered, old bases stop
being ancestors of new tags). A `git rebase` of our patch branch is therefore unreliable:
there is no stable shared spine to replay against. Re-derive **semantically** each time.

This directory holds the rewrite-proof artifacts:
- `000*-*.patch` — the patch series (`git format-patch`), appliable with `git am` or `git apply`.
- This runbook — the human guide for when a hunk no longer applies.

## Base of the current series

- **Upstream base:** `v0.170.5`
- **Previous base:** `v0.166.1` (commit `76c154e7`; original March integration was ~0.159.x)

## How to move to a newer upstream release

1. `git fetch upstream --tags --force` (tags will "clobber" — that's the rewrite; expected).
2. New worktree off the target tag: `git worktree add <dir> -b musictide-patches-<ver> v<ver>`.
3. `pnpm install --frozen-lockfile --config.engine-strict=false`
   (the engines gate is a dev-only eslint plugin; irrelevant to the vite build).
   Then re-add our only runtime dep if the lockfile doesn't carry it: `sortablejs` (+ `@types/sortablejs`, dev).
4. Try `git apply --3way` of each patch file. Clean files apply; churned files reject or
   auto-merge — **eyeball every auto-merge on a churned file**, 3-way can silently misplace hunks.
5. Build + test with the **direct binaries** (pnpm's pre-run deps check re-hits the engine gate):
   `./node_modules/.bin/vite build` and
   `NODE_OPTIONS=--no-experimental-webstorage ./node_modules/.bin/vitest run`.

## Patch groups (what each touches, and the traps)

| Group | Essence | Trap when re-deriving |
|-------|---------|-----------------------|
| **A. PT-PT locale** | `locales/pt.yaml` (new) + `config/index.js` forces `config.yml` `locale:` via `appLocale.set()` when no user pref | Adding a locale bumps `i18n.test.js`'s `addMessages` count (glob-loads every `locales/*.yaml`) — update the count. Do **not** re-introduce a `config -> $lib/services/app/i18n` import edge (it drags module-level `toStore`/`locale` into mocked test suites). |
| **B. Google SSO + local-repo** | `entrance/sign-in.svelte`, `backends/fs/local.js` (showDirectoryPicker before IndexedDB) | Auth area churns upstream (Runes migration). |
| **C. Scroll-sync** | `pane-body.svelte`, `content-details-overlay.svelte`, `toolbar.svelte` (also hides "View on live site" for drafts) | Editor internals; hunks drift with reflows. |
| **D. Gallery / file-editor UX** | Ctrl+A select-all, DnD reorder (`sortablejs`), gallery auto-select, DropZone guard across `file-editor*.svelte`, `select-assets-dialog.svelte`, `assets-panel.svelte`, `external-assets-panel.svelte`, `drop-zone.svelte`, `file/helper.js` | `sortablejs` dep must be present. `reorderItems(newOrder)` uses a `$state.snapshot` permutation — a 3-way merge may splice upstream's adjacent-swap (which references an out-of-scope `index`); keep our permutation loop. |
| **F. preSave hook chaining** | `contents/api/events.js` (was `contents/draft/events.js`) — re-read `content`/`path` **inside** the hook loop so hooks chain | The whole file gets rewritten/moved upstream. Behavioral, not mechanical: **must** re-run the `events.test.js` "chain multiple preSave hooks" regression test. This is the hashtag→`tags` bug. |

## Group E — inline-create-from-relation — **PORTED 2026-07-11**

Feared to be the highest-cost patch (upstream split `relation/helper.js` into a 9-file
`relation/helper/` module), but the re-derivation was cheap: **every internal API the patch depends
on kept its signature** in v0.170.5 — `createEntryPath({draft,locale,slug})`,
`formatEntryFile({content,_file})`, `saveChanges(...)`, `slugify`, `getCollection`,
`isFieldRequired`, `allEntries` (still `get()`-read, so the reactive-touch workaround is still
needed). New files `relation/inline-create-dialog.svelte` + `contents/entry/inline-create.js` port
verbatim. Only `select-single.svelte` needed real work: upstream left the "deselect option" logic as
an `$effect` and re-keyed the `{#each}` to `` `${index}-${value}` `` — re-derived the `finalOptions`
$derived + sentinel option while preserving the new keying. `relation-editor.svelte` keeps the new
`valueStoreKey` context form. Build clean (2.05 MB), full suite 6902 passed.

**Not covered by unit tests** (matches the old fork — the original patch shipped no test either): the
feature is Svelte-component + Select-DOM-interaction heavy. Verify manually in `/admin/`: a relation
field with `inline_create: true` shows a "Create new…" sentinel; picking it opens the dialog
pre-filled with the combobox search text; saving commits the entry and auto-selects it.

## Manual verification (not covered by unit tests)

Load `/admin/` (musictide `run` + local-repo mode) and confirm: PT-PT UI (A), scroll-sync (C),
gallery multi-select + Ctrl+A + DnD reorder (D), and — the known trap — create a post with
`#foo` in the body, save, confirm `tags: [foo]` is written (F).
