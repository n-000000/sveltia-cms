# Inline Create for Relation Fields v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite inline-create so new referenced entries (events, authors) are committed to git directly without touching `entryDraft`, keeping the article form mounted throughout — the user never leaves the page.

**Architecture:** A new `createInlineEntry` utility builds the slug/path, serializes content via `formatEntryFile`, and commits via `saveChanges` (which also patches `allEntries`). `InlineCreateDialog` is rewritten to own its own `$state` and call this utility — no `entryDraft` access at all. `relation-editor` subscribes to `$allEntries` reactively so the new option appears immediately after commit without a page reload.

**Tech Stack:** Svelte 5 runes (`$state`, `$derived`, `$derived.by`, `$effect`), `@sveltia/ui` (Dialog, Button, Alert, TextInput), `saveChanges` (backends/save.js), `formatEntryFile` (contents/file/format.js), `slugify` (common/slug.js), `createEntryPath` (draft/save/entry-path.js), `fillTemplate` (common/template)

---

## Context

The previous implementation (`inline-create-dialog.svelte`, commit `3295fad1`) called `createDraft()` to set up a new entry for editing. But `createDraft()` mutates the global `entryDraft` store, which drives the entire content editor. Changing `entryDraft` causes `ContentEditor` to re-render with the new collection's fields — destroying `RelationEditor` and `InlineCreateDialog` (they are children of that tree). The dialog self-destructed before showing.

**Root cause:** `InlineCreateDialog` cannot call `createDraft()` from within the component tree driven by `entryDraft`.

**Fix:** Don't use `entryDraft` at all. The new dialog holds its own `$state`, collects field values, then calls `createInlineEntry` which does the full serialize → commit → store-update cycle independently.

**Already done (do not change):**
- `select-single.svelte` — sentinel `'__inline_create__'` option + DOM search text read ✓
- `select-editor.svelte` — `onCreateNew` / `createLabel` props threaded to SelectSingle ✓
- `musictide/static/admin/config.yml` — `inline_create: true` + `create_label` on 4 fields ✓
- `relation-editor.svelte` — `handleCreateNew`, `dialogOpen`, `searchText` wiring ✓

---

## File Map

| File | Change |
|------|--------|
| `src/lib/services/contents/entry/inline-create.js` | **NEW** — `createInlineEntry` utility |
| `src/lib/components/contents/details/fields/relation/inline-create-dialog.svelte` | **REWRITE** — lightweight dialog; own state; no entryDraft |
| `src/lib/components/contents/details/fields/relation/relation-editor.svelte` | **MODIFY** — `$allEntries` reactive dependency in `refEntries` |

---

## Task 1: Create `createInlineEntry` utility

**Files:**
- Create: `src/lib/services/contents/entry/inline-create.js`

Steps:
1. Get collection via `getCollection(collectionName)` — has `_file`, `_i18n`, `identifier_field`
2. Slugify: `slugify(String(fieldValues[identifierField] ?? ''))`
3. Build the file path using `createEntryPath` with a minimal fake draft (only the properties the function actually reads: `collection`, `collectionFile`, `originalEntry`, `currentValues`, `isIndexFile`)
4. Derive `entry.subPath` from the path: strip `basePath/` prefix and `.extension` suffix
5. Serialize: `await formatEntryFile({ content: { ...fieldValues }, _file })`
6. Call `saveChanges` — this commits to git AND calls `updateStores` which patches `allEntries`
7. Return `String(fieldValues[valueField] ?? '')` for the relation field to auto-select

**Why `createEntryPath` instead of building the path manually:** it handles the `path: "{{slug}}/_index"` subPath template used by the `events` collection, so `content/events/{slug}/_index.md` paths work correctly.

- [ ] **Step 1: Write the file**

```js
import { saveChanges } from '$lib/services/backends/save';
import { slugify } from '$lib/services/common/slug';
import { getCollection } from '$lib/services/contents/collection';
import { createEntryPath } from '$lib/services/contents/draft/save/entry-path';
import { formatEntryFile } from '$lib/services/contents/file/format';

/**
 * Create a new entry in the given collection directly (no entryDraft involved).
 * Used by InlineCreateDialog to commit referenced entries without leaving the article form.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Target collection name (e.g. 'events', 'authors').
 * @param {Record<string, any>} args.fieldValues Field key→value pairs to write.
 * @param {string} args.valueField The field whose value becomes the relation's stored value.
 * @returns {Promise<string>} The value of `fieldValues[valueField]`, for auto-selection.
 */
export const createInlineEntry = async ({ collectionName, fieldValues, valueField }) => {
  const collection = getCollection(collectionName);

  if (!collection || collection._type !== 'entry') {
    throw new Error(`inline_create: "${collectionName}" is not a folder collection`);
  }

  const {
    _file,
    _i18n: { defaultLocale },
    identifier_field: identifierField = 'title',
  } = /** @type {import('$lib/types/private').InternalEntryCollection} */ (collection);

  const identifierValue = String(fieldValues[identifierField] ?? '');
  const slug = slugify(identifierValue, { fallback: true });

  // Minimal draft-like object — only the properties createEntryPath actually reads
  const fakeDraft = {
    collection,
    collectionFile: undefined,
    originalEntry: undefined,
    currentValues: { [defaultLocale]: fieldValues },
    isIndexFile: false,
  };

  const path = createEntryPath({ draft: fakeDraft, locale: defaultLocale, slug });

  // Derive the Entry.subPath: segment between basePath/ and .extension
  const { basePath = '', extension } = _file;
  const subPath = basePath
    ? path.slice(basePath.length + 1, -(extension.length + 1))
    : path.slice(0, -(extension.length + 1));

  const data = await formatEntryFile({ content: { ...fieldValues }, _file });

  /** @type {import('$lib/types/private').FileChange} */
  const fileChange = { action: 'create', path, slug, data };

  /** @type {import('$lib/types/private').Entry} */
  const entry = {
    id: path,
    slug,
    subPath,
    locales: { [defaultLocale]: { slug, path, content: fieldValues } },
  };

  await saveChanges({
    changes: [fileChange],
    savingEntries: [entry],
    savingAssets: [],
    options: { commitType: 'create', collection },
  });

  return String(fieldValues[valueField] ?? '');
};
```

- [ ] **Step 2: Verify build passes**

Run: `cd /home/n0xx/Code/infra/service/sveltia-cms && pnpm build 2>&1 | tail -20`
Expected: exits 0, no errors (warnings about unused exports acceptable)

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/contents/entry/inline-create.js
git commit -m "feat: createInlineEntry utility — direct git commit without entryDraft"
```

---

## Task 2: Rewrite `inline-create-dialog.svelte`

**Files:**
- Modify: `src/lib/components/contents/details/fields/relation/inline-create-dialog.svelte`

The rewritten dialog:
- Owns `fieldValues: Record<string, string>` as `$state({})`
- Opens → `$effect` pre-populates each required field: the `valueField` gets `prefillText`, others get `''`
- Renders a labeled `TextInput` per required field (all required fields in the musictide target collections are string type)
- On Save: calls `createInlineEntry`, calls `onCreated(newValue)`, closes
- Does NOT import or touch `entryDraft`, `createDraft`, `saveEntry`, or `FieldEditor`

**`isFieldRequired` stays** — it reads field config, not `entryDraft`.

- [ ] **Step 1: Overwrite the file completely**

```svelte
<script>
  import { Alert, Button, Dialog, TextInput } from '@sveltia/ui';

  import { createInlineEntry } from '$lib/services/contents/entry/inline-create';
  import { getCollection } from '$lib/services/contents/collection';
  import { isFieldRequired } from '$lib/services/contents/entry/fields';

  /**
   * @import { InternalLocaleCode } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} open Whether the dialog is open.
   * @property {string} collectionName Target collection name (e.g. 'authors').
   * @property {string} valueField Field name stored as the relation value (e.g. 'title').
   * @property {string} createLabel Dialog title and save button label.
   * @property {string} prefillText Text to pre-populate the value field (from combobox search).
   * @property {InternalLocaleCode} locale Current editor locale.
   * @property {(value: string) => void} onCreated Called with the new entry's value after save.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    open = $bindable(false),
    collectionName,
    valueField,
    createLabel,
    prefillText = '',
    locale,
    onCreated,
    /* eslint-enable prefer-const */
  } = $props();

  const targetCollection = $derived(getCollection(collectionName));

  const requiredFields = $derived(
    (targetCollection?.fields ?? []).filter((f) => isFieldRequired({ fieldConfig: f, locale })),
  );

  /** @type {Record<string, string>} */
  let fieldValues = $state({});
  let saving = $state(false);
  let error = $state('');

  $effect(() => {
    if (open) {
      /** @type {Record<string, string>} */
      const initial = {};

      requiredFields.forEach((f) => {
        initial[f.name] = f.name === valueField ? prefillText : '';
      });

      fieldValues = initial;
      saving = false;
      error = '';
    }
  });

  const handleClose = () => {
    open = false;
  };

  const handleSave = async () => {
    if (saving) return;
    saving = true;
    error = '';

    try {
      const newValue = await createInlineEntry({ collectionName, fieldValues, valueField });
      onCreated?.(newValue);
      open = false;
    } catch (e) {
      saving = false;
      error = e instanceof Error ? e.message : 'Save failed. Please try again.';
    }
  };
</script>

<Dialog title={createLabel} bind:open onClose={handleClose}>
  {#each requiredFields as field (field.name)}
    <div role="none" class="field">
      <label for="inline-{field.name}">{field.label}</label>
      <TextInput
        id="inline-{field.name}"
        bind:value={fieldValues[field.name]}
        disabled={saving}
      />
    </div>
  {/each}

  {#if error}
    <Alert status="error">{error}</Alert>
  {/if}

  <div role="none" class="actions">
    <Button variant="ghost" disabled={saving} onclick={handleClose}>Cancel</Button>
    <Button variant="primary" disabled={saving} onclick={handleSave}>
      {saving ? '…' : 'Save'}
    </Button>
  </div>
</Dialog>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }

  label {
    font-size: 13px;
    font-weight: 500;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }
</style>
```

- [ ] **Step 2: Verify build passes**

Run: `pnpm build 2>&1 | tail -20`
Expected: exits 0, no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/contents/details/fields/relation/inline-create-dialog.svelte
git commit -m "refactor: rewrite InlineCreateDialog — own field state + createInlineEntry, no entryDraft"
```

---

## Task 3: Add `$allEntries` reactive dependency to `relation-editor.svelte`

**Files:**
- Modify: `src/lib/components/contents/details/fields/relation/relation-editor.svelte`

**Problem:** `getEntriesByCollection` calls `get(allEntries)` — a non-reactive read. After `saveChanges` updates `allEntries`, the `refEntries` derived won't re-run unless it has a reactive dependency on the store.

**Fix:** Use `$derived.by(() => { ... })` and access `$allEntries` inside the getter. Svelte 5 tracks the subscription and re-runs the derived whenever `allEntries` changes.

- [ ] **Step 1: Add import and rewrite `refEntries`**

Add to the imports (after the existing import block):
```js
import { allEntries } from '$lib/services/contents';
```

Replace the `refEntries` derived:
```js
// BEFORE
const refEntries = $derived(
  fileName
    ? [getCollectionFileEntry(collectionName, fileName)].filter((entry) => !!entry)
    : getEntriesByCollection(collectionName),
);

// AFTER
const refEntries = $derived.by(() => {
  // eslint-disable-next-line no-unused-expressions
  $allEntries; // reactive touch — re-runs when allEntries changes after inline create
  return fileName
    ? [getCollectionFileEntry(collectionName, fileName)].filter((entry) => !!entry)
    : getEntriesByCollection(collectionName);
});
```

Full updated `relation-editor.svelte` for reference:

```svelte
<!--
  @component
  Implement the editor for a Relation field.
  @see https://decapcms.org/docs/widgets/#Relation
  @see https://sveltiacms.app/en/docs/fields/relation
-->
<script>
  import InlineCreateDialog from '$lib/components/contents/details/fields/relation/inline-create-dialog.svelte';
  import SelectEditor from '$lib/components/contents/details/fields/select/select-editor.svelte';
  import { allEntries } from '$lib/services/contents';
  import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
  import { getCollectionFileEntry } from '$lib/services/contents/collection/files';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getOptions } from '$lib/services/contents/fields/relation/helper';

  /**
   * @import { FieldEditorProps } from '$lib/types/private';
   * @import { RelationField, SelectField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {RelationField} fieldConfig Field configuration.
   * @property {string | string[] | undefined} currentValue Field value.
   */

  /** @type {FieldEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    typedKeyPath,
    fieldId,
    fieldLabel,
    fieldConfig,
    currentValue = $bindable(),
    required = true,
    readonly = false,
    invalid = false,
    /* eslint-enable prefer-const */
  } = $props();

  const {
    collection: collectionName,
    file: fileName,
    inline_create: inlineCreate = false,
    create_label: createLabel = 'Create new…',
    value_field: valueField = 'title',
  } = $derived(fieldConfig);

  const refEntries = $derived.by(() => {
    // eslint-disable-next-line no-unused-expressions
    $allEntries; // reactive touch — re-runs when allEntries changes after inline create
    return fileName
      ? [getCollectionFileEntry(collectionName, fileName)].filter((entry) => !!entry)
      : getEntriesByCollection(collectionName);
  });
  const currentLocaleValues = $derived($entryDraft?.currentValues[locale]);
  const currentSlug = $derived($entryDraft?.currentSlugs[locale] ?? $entryDraft?.currentSlugs._);
  /** @type {SelectField} */
  const selectFieldConfig = $derived({
    ...fieldConfig,
    widget: 'select',
    options: getOptions({ locale, fieldConfig, refEntries, currentLocaleValues, currentSlug }),
  });

  let dialogOpen = $state(false);
  let searchText = $state('');

  /** @param {string} text */
  const handleCreateNew = (text) => {
    searchText = text;
    dialogOpen = true;
  };
</script>

<div role="none" class="wrapper">
  <SelectEditor
    {locale}
    {keyPath}
    {typedKeyPath}
    {fieldId}
    {fieldLabel}
    fieldConfig={selectFieldConfig}
    bind:currentValue
    {readonly}
    {required}
    {invalid}
    sortOptions={true}
    onCreateNew={inlineCreate ? handleCreateNew : undefined}
    {createLabel}
  />

  {#if inlineCreate}
    <InlineCreateDialog
      bind:open={dialogOpen}
      {collectionName}
      {valueField}
      {createLabel}
      prefillText={searchText}
      {locale}
      onCreated={(value) => {
        currentValue = value;
      }}
    />
  {/if}
</div>
```

- [ ] **Step 2: Verify build passes**

Run: `pnpm build 2>&1 | tail -20`
Expected: exits 0, no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/contents/details/fields/relation/relation-editor.svelte
git commit -m "fix: subscribe to \$allEntries in refEntries so inline-created entries appear"
```

---

## Task 4: Copy build and verify end-to-end

**Files:** none changed

- [ ] **Step 1: Build and copy to musictide**

```bash
pnpm build && cp package/dist/sveltia-cms.js /home/n0xx/Code/infra/service/musictide/static/admin/sveltia-cms.js
ls -lh package/dist/sveltia-cms.js
```
Expected: file exists, 1.8–2.2 MB

- [ ] **Step 2: Check Hugo**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:1313/admin/
```
Expected: `200`. If not: `cd /home/n0xx/Code/infra/service/musictide && hugo server --port 1313 &`

- [ ] **Step 3: Open admin and seed token**

Navigate to `http://localhost:1313/admin/` via Playwright. Then:
```js
localStorage.setItem('sveltia-cms.user', JSON.stringify({ token: '<GITHUB_PAT_FROM_PASSWORD_MANAGER>' }));
location.reload();
```

- [ ] **Step 4: Navigate to Artigos → new article**

Click "Artigos" → "New Artigo". Verify the article form loads with Evento and credit relation fields.

- [ ] **Step 5: Trigger inline create for Evento**

Click the "Evento" field. Type a new event name (e.g. "Sonic Blast 2025"). Wait for the dropdown to show "Criar evento…" at the bottom. Click it.

Expected:
- A dialog opens with title "Criar evento…" and a "Nome" text input pre-filled with "Sonic Blast 2025"
- The article form is still visible behind the dialog (NOT replaced by a new form)

- [ ] **Step 6: Save the inline entry**

Click "Save" in the dialog.

Expected:
- Dialog closes
- Evento field now shows "Sonic Blast 2025" selected
- User is still on the article form (no navigation occurred)

- [ ] **Step 7: Verify the commit landed in musictide**

Check git log on the musictide repo:
```bash
cd /home/n0xx/Code/infra/service/musictide && git log --oneline -3
```
Expected: top commit references the new event (e.g. Sveltia's "Create Sonic Blast 2025" message).
And verify the file exists:
```bash
ls content/events/
```
Expected: a `sonic-blast-2025/` directory with `_index.md` inside.

- [ ] **Step 8: Verify new entry appears in dropdown**

Without reloading, open the Evento dropdown again.
Expected: "Sonic Blast 2025" is listed as an option.

- [ ] **Step 9: Test credit inline create**

Click the "Texto" (credit_texto) field. Type a collaborator name. Click "Criar colaborador…". Save.
Expected: same flow — dialog opens without leaving article, field auto-selects after save.

---

## Self-Review Checklist

**Spec coverage:**
- ✅ User types in dropdown filter, sees "Criar…" option — handled by sentinel in `select-single.svelte` (pre-existing)
- ✅ Clicking "Criar…" opens dialog pre-filled with search text — `handleCreateNew` + `prefillText` + `$effect` on open
- ✅ Dialog commits to git directly — `createInlineEntry` → `saveChanges`
- ✅ Dropdown auto-selects new value — `onCreated(newValue)` → `currentValue = value`; `$allEntries` touch re-derives options
- ✅ User never leaves article form — `entryDraft` untouched; article editor tree not re-rendered
- ✅ Events collection path template (`{{slug}}/_index`) handled — `createEntryPath` with fakeDraft
- ✅ Authors collection path (plain slug) handled — `createEntryPath` fallback to slug

**Placeholder scan:** None — all code is complete.

**Type consistency:**
- `createInlineEntry` returns `Promise<string>` — dialog's `handleSave` awaits it ✓
- `onCreated` callback receives `string` — `relation-editor` assigns it to `currentValue` ✓
- `fieldValues` is `Record<string, string>` — `TextInput` `bind:value` expects `string` ✓
