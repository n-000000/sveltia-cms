# Inline Create for Relation Fields — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Create new…" option to single-select relation field dropdowns so users can create referenced entries (authors, events) inline without leaving the article form; the new entry commits to git immediately and is auto-selected on completion.

**Architecture:** `onCreateNew(searchText)` callback is threaded from `relation-editor` → `select-editor` → `select-single`; `select-single` appends a sentinel option and intercepts its selection; `relation-editor` owns dialog state and mounts a new `inline-create-dialog` that temporarily swaps `entryDraft`, renders required fields via existing `FieldEditor`, calls `saveEntry()`, then restores the article draft and auto-selects the new value.

**Tech Stack:** Svelte 5 runes (`$state`, `$derived`, `$effect`), `@sveltia/ui` (`Dialog`, `Alert`, `Button`), existing `createDraft` / `saveEntry` / `getCollection` / `isFieldRequired` services.

**Spec:** `docs/superpowers/specs/2026-06-09-inline-create-relation-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/components/contents/details/fields/select/select-editor.svelte` | modify | accept + thread `onCreateNew` / `createLabel` optional props |
| `src/lib/components/contents/details/fields/select/select-single.svelte` | modify | append sentinel option; capture search text; intercept + reset sentinel selection |
| `src/lib/components/contents/details/fields/relation/inline-create-dialog.svelte` | **create** | entryDraft swap, FieldEditor rendering, saveEntry flow, error handling |
| `src/lib/components/contents/details/fields/relation/relation-editor.svelte` | modify | read `inline_create`/`create_label`; pass callback; mount dialog |
| `/home/n0xx/Code/infra/service/musictide/static/admin/config.yaml` | modify | enable `inline_create` on 4 relation fields |

---

## Task 1: Thread props through `select-editor.svelte`

**Files:**
- Modify: `src/lib/components/contents/details/fields/select/select-editor.svelte`

- [ ] **Step 1: Add `onCreateNew` and `createLabel` to props and thread to child**

  Replace the entire file content with:

  ```svelte
  <!--
    @component
    Implement the editor for a Select field.
    @see https://decapcms.org/docs/widgets/#Select
    @see https://sveltiacms.app/en/docs/fields/select
  -->
  <script>
    import { isObject } from '@sveltia/utils/object';
    import { compare } from '@sveltia/utils/string';

    import SelectMultiple from '$lib/components/contents/details/fields/select/select-multiple.svelte';
    import SelectSingle from '$lib/components/contents/details/fields/select/select-single.svelte';

    /**
     * @import { FieldEditorProps, SelectFieldSelectorOption } from '$lib/types/private';
     * @import { SelectField } from '$lib/types/public';
     */

    /**
     * @typedef {object} Props
     * @property {SelectField} fieldConfig Field configuration.
     * @property {any} currentValue Field value.
     * @property {boolean} [sortOptions] Whether to sort the options by label.
     * @property {((searchText: string) => void) | undefined} [onCreateNew] Inline-create callback.
     * @property {string} [createLabel] Label for the inline-create option.
     */

    /** @type {FieldEditorProps & Props} */
    let {
      /* eslint-disable prefer-const */
      locale,
      keyPath,
      fieldId,
      fieldConfig,
      currentValue = $bindable(),
      required = true,
      readonly = false,
      invalid = false,
      sortOptions = false,
      onCreateNew = undefined,
      createLabel = 'Create new…',
      /* eslint-enable prefer-const */
    } = $props();

    const {
      // Field type-specific options
      options: fieldOptions,
      multiple,
    } = $derived(fieldConfig);
    const Select = $derived(multiple ? SelectMultiple : SelectSingle);
    const options = $derived.by(() => {
      const _options = fieldOptions.map(
        (option) =>
          /** @type {SelectFieldSelectorOption} */ (
            isObject(option) ? option : { label: option, value: option }
          ),
      );

      if (sortOptions) {
        _options.sort((a, b) => compare(a.label, b.label));
      }

      return _options;
    });
  </script>

  {#key JSON.stringify(options)}
    <Select
      {locale}
      {keyPath}
      {fieldId}
      {fieldConfig}
      bind:currentValue
      {readonly}
      {required}
      {invalid}
      {options}
      {...(!multiple ? { onCreateNew, createLabel } : {})}
    />
  {/key}
  ```

- [ ] **Step 2: Verify the build compiles cleanly**

  ```bash
  cd /home/n0xx/Code/infra/service/sveltia-cms
  pnpm build 2>&1 | tail -20
  ```

  Expected: no errors (warnings about unused exports are acceptable).

- [ ] **Step 3: Commit**

  ```bash
  git add src/lib/components/contents/details/fields/select/select-editor.svelte
  git commit -m "feat(relation): thread onCreateNew + createLabel through SelectEditor"
  ```

---

## Task 2: Sentinel option + interceptor in `select-single.svelte`

**Files:**
- Modify: `src/lib/components/contents/details/fields/select/select-single.svelte`

The key changes:
- Add `onCreateNew` and `createLabel` props
- Replace the two separate `$effect` mutations of `options` with a single `$derived.by` (`finalOptions`) that computes the final option list including the optional unselected entry and optional sentinel
- Add `pendingSearchText` (updated by `oninput` bubbling from the combobox filter input)
- Add `lastGoodValue` (tracks last non-sentinel value to restore on cancel)
- Wrap the `<Select>` in a `display:contents` div to capture input events without affecting layout
- Add `onChange` handler to intercept sentinel selection

- [ ] **Step 1: Replace `select-single.svelte` with the new implementation**

  ```svelte
  <script>
    import { _ } from '@sveltia/i18n';
    import { Option, Radio, RadioGroup, Select } from '@sveltia/ui';

    /**
     * @import { SelectFieldSelectorProps } from '$lib/types/private';
     * @import { SelectFieldValue } from '$lib/types/public';
     */

    /**
     * @typedef {object} Props
     * @property {SelectFieldValue | undefined} currentValue Field value.
     * @property {((searchText: string) => void) | undefined} [onCreateNew] Inline-create callback.
     * @property {string} [createLabel] Label for the sentinel option.
     */

    /** @type {SelectFieldSelectorProps & Props} */
    let {
      /* eslint-disable prefer-const */
      fieldId,
      fieldConfig,
      currentValue = $bindable(),
      required = true,
      readonly = false,
      invalid = false,
      options,
      onCreateNew = undefined,
      createLabel = 'Create new…',
      /* eslint-enable prefer-const */
    } = $props();

    const { dropdown_threshold: dropdownThreshold = 5 } = $derived(fieldConfig);
    /** @type {string | undefined} */
    let valueType = $state(undefined);
    let pendingSearchText = $state('');
    let lastGoodValue = $state(currentValue);

    $effect(() => {
      if (!valueType) {
        valueType = options[0]?.value !== undefined ? typeof options[0]?.value : 'string';
      }
    });

    $effect(() => {
      if (currentValue !== '__inline_create__') {
        lastGoodValue = currentValue;
      }
    });

    const finalOptions = $derived.by(() => {
      let opts = [...options];

      if (!required && !opts.some(({ value }) => !value)) {
        opts = [
          {
            label: _('unselected_option'),
            value: valueType === 'number' ? null : '',
            searchValue: '',
          },
          ...opts,
        ];
      }

      if (onCreateNew) {
        opts = [...opts, { label: createLabel, value: '__inline_create__', searchValue: '' }];
      }

      return opts;
    });
  </script>

  {#if finalOptions.length > dropdownThreshold || onCreateNew}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      role="none"
      style="display: contents"
      oninput={(e) => {
        if (e.target instanceof HTMLInputElement) pendingSearchText = e.target.value;
      }}
    >
      <Select
        bind:value={currentValue}
        {readonly}
        {required}
        {invalid}
        aria-labelledby="{fieldId}-label"
        aria-errormessage="{fieldId}-error"
        onChange={() => {
          if (currentValue === '__inline_create__') {
            const text = pendingSearchText;
            currentValue = lastGoodValue;
            pendingSearchText = '';
            onCreateNew?.(text);
          }
        }}
      >
        {#each finalOptions as { label, value, searchValue } (value)}
          <Option {label} {value} {valueType} {searchValue} selected={value === currentValue} wrap />
        {/each}
      </Select>
    </div>
  {:else}
    <RadioGroup
      {readonly}
      {required}
      {invalid}
      aria-labelledby="{fieldId}-label"
      aria-errormessage="{fieldId}-error"
      onChange={({ detail: { value } }) => {
        currentValue = value;
      }}
    >
      {#each finalOptions as { label, value } (value)}
        <Radio {label} {value} {valueType} checked={value === currentValue} />
      {/each}
    </RadioGroup>
  {/if}
  ```

- [ ] **Step 2: Verify the build compiles cleanly**

  ```bash
  pnpm build 2>&1 | tail -20
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/lib/components/contents/details/fields/select/select-single.svelte
  git commit -m "feat(relation): sentinel option + search-text interceptor in SelectSingle"
  ```

---

## Task 3: Create `inline-create-dialog.svelte`

**Files:**
- Create: `src/lib/components/contents/details/fields/relation/inline-create-dialog.svelte`

This component:
1. On open: snapshots `entryDraft`, calls `createDraft` with the target collection (pre-fills `valueField` with any search text)
2. Renders `FieldEditor` for each required field in the target collection
3. On save: captures the new value, calls `saveEntry()`, restores article draft, calls `onCreated`
4. On close/cancel: restores article draft without saving

- [ ] **Step 1: Create the file**

  ```svelte
  <script>
    import { Alert, Button, Dialog } from '@sveltia/ui';
    import { get } from 'svelte/store';

    import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
    import { getCollection } from '$lib/services/contents/collection';
    import { createDraft } from '$lib/services/contents/draft/create';
    import { entryDraft } from '$lib/services/contents/draft';
    import { saveEntry } from '$lib/services/contents/draft/save';
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

    /** @type {object | undefined} */
    let snapshot = $state(undefined);
    let saving = $state(false);
    let error = $state('');

    const targetCollection = $derived(getCollection(collectionName));

    const requiredFields = $derived(
      (targetCollection?.fields ?? []).filter((f) => isFieldRequired({ fieldConfig: f, locale })),
    );

    $effect(() => {
      if (open && targetCollection) {
        snapshot = get(entryDraft);
        createDraft({
          collection: targetCollection,
          dynamicValues: prefillText ? { [valueField]: prefillText } : {},
        });
        saving = false;
        error = '';
      }
    });

    const handleClose = () => {
      if (snapshot) {
        entryDraft.set(snapshot);
        snapshot = undefined;
      }
      saving = false;
      error = '';
      open = false;
    };

    const handleSave = async () => {
      saving = true;
      error = '';

      try {
        const draft = get(entryDraft);
        const newValue = $state.snapshot(draft.currentValues[draft.defaultLocale])?.[valueField];

        await saveEntry();

        entryDraft.set(snapshot);
        snapshot = undefined;
        onCreated?.(newValue ?? '');
        open = false;
      } catch (e) {
        saving = false;
        error = e instanceof Error ? e.message : 'Save failed. Please try again.';
      }
    };
  </script>

  <Dialog title={createLabel} bind:open onClose={handleClose}>
    {#each requiredFields as fieldCfg (fieldCfg.name)}
      <FieldEditor
        keyPath={fieldCfg.name}
        typedKeyPath={fieldCfg.name}
        {locale}
        fieldConfig={fieldCfg}
      />
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
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
  </style>
  ```

- [ ] **Step 2: Verify the build compiles cleanly**

  ```bash
  pnpm build 2>&1 | tail -20
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/lib/components/contents/details/fields/relation/inline-create-dialog.svelte
  git commit -m "feat(relation): add InlineCreateDialog component"
  ```

---

## Task 4: Wire `relation-editor.svelte`

**Files:**
- Modify: `src/lib/components/contents/details/fields/relation/relation-editor.svelte`

Add: import `InlineCreateDialog`; read `inline_create` + `create_label` from `fieldConfig`; own `dialogOpen` and `searchText` state; pass `onCreateNew` callback to `SelectEditor`; mount `InlineCreateDialog`.

- [ ] **Step 1: Replace `relation-editor.svelte` with the wired version**

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

    const refEntries = $derived(
      fileName
        ? [getCollectionFileEntry(collectionName, fileName)].filter((entry) => !!entry)
        : getEntriesByCollection(collectionName),
    );
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

- [ ] **Step 2: Verify the build compiles cleanly**

  ```bash
  pnpm build 2>&1 | tail -20
  ```

  Expected: no errors.

- [ ] **Step 3: Copy bundle to musictide**

  ```bash
  cp package/dist/sveltia-cms.js /home/n0xx/Code/infra/service/musictide/static/admin/sveltia-cms.js
  ```

- [ ] **Step 4: Commit the fork change**

  ```bash
  git add src/lib/components/contents/details/fields/relation/relation-editor.svelte
  git commit -m "feat(relation): wire InlineCreateDialog into RelationEditor"
  ```

---

## Task 5: Enable `inline_create` in musictide config

**Files:**
- Modify: `/home/n0xx/Code/infra/service/musictide/static/admin/config.yaml`

- [ ] **Step 1: Add `inline_create` and `create_label` to the `event` field**

  Find the `event` field in the `posts` collection (it has `collection: events`) and add the two new properties:

  ```yaml
        - label: Evento
          name: event
          widget: relation
          collection: events
          search_fields: [title]
          value_field: title
          display_fields: [title]
          dropdown_threshold: 0
          required: false
          inline_create: true
          create_label: "Criar evento…"
          hint: "Evento associado (ex: Vagos Metal Fest 2025). Crie o evento primeiro em Eventos."
  ```

- [ ] **Step 2: Add `inline_create` and `create_label` to `credit_texto`**

  ```yaml
        - label: Texto
          name: credit_texto
          widget: relation
          collection: authors
          search_fields: [title]
          value_field: title
          display_fields: [title]
          dropdown_threshold: 0
          required: false
          inline_create: true
          create_label: "Criar colaborador…"
          hint: "Autor do texto"
  ```

- [ ] **Step 3: Add `inline_create` and `create_label` to `credit_fotos`**

  ```yaml
        - label: Fotos
          name: credit_fotos
          widget: relation
          collection: authors
          search_fields: [title]
          value_field: title
          display_fields: [title]
          dropdown_threshold: 0
          required: false
          inline_create: true
          create_label: "Criar colaborador…"
          hint: "Autor das fotografias"
  ```

- [ ] **Step 4: Add `inline_create` and `create_label` to `credit_video`**

  ```yaml
        - label: Vídeo
          name: credit_video
          widget: relation
          collection: authors
          search_fields: [title]
          value_field: title
          display_fields: [title]
          dropdown_threshold: 0
          required: false
          inline_create: true
          create_label: "Criar colaborador…"
          hint: "Autor do vídeo (se aplicável)"
  ```

- [ ] **Step 5: Commit musictide config**

  ```bash
  cd /home/n0xx/Code/infra/service/musictide
  git add static/admin/config.yaml
  git commit -m "feat(cms): enable inline-create on event + author relation fields"
  ```

---

## Task 6: End-to-end verification

- [ ] **Step 1: Rebuild the fork and copy**

  ```bash
  cd /home/n0xx/Code/infra/service/sveltia-cms
  pnpm build
  cp package/dist/sveltia-cms.js /home/n0xx/Code/infra/service/musictide/static/admin/sveltia-cms.js
  ls -lh package/dist/sveltia-cms.js
  ```

  Expected: file exists, size ~1.8–2.2 MB.

- [ ] **Step 2: Start Hugo (if not already running)**

  ```bash
  cd /home/n0xx/Code/infra/service/musictide
  hugo server --port 1313
  ```

  Leave running in a terminal.

- [ ] **Step 3: Open the CMS and seed the auth token**

  Navigate to `http://localhost:1313/admin/` via Playwright. Seed the GitHub token:

  ```js
  localStorage.setItem('sveltia-cms.user', JSON.stringify({
    token: 'REDACTED_PAT'
  }));
  ```

  Reload and sign in.

- [ ] **Step 4: Verify "Criar evento…" appears in the Event dropdown**

  1. Navigate to Artigos → create a new article
  2. Click the **Evento** field dropdown
  3. Confirm "Criar evento…" appears at the bottom of the option list
  4. Take a screenshot

- [ ] **Step 5: Verify search-text pre-fill**

  1. Type "Primavera Sound 2026" in the Evento combobox
  2. Select "Criar evento…"
  3. Confirm the dialog opens with "Primavera Sound 2026" pre-filled in the Nome field
  4. Take a screenshot

- [ ] **Step 6: Verify inline create saves and auto-selects**

  1. With "Primavera Sound 2026" pre-filled (or typed), click Save in the dialog
  2. Confirm the dialog closes
  3. Confirm the Evento field now shows "Primavera Sound 2026" selected
  4. Confirm the article draft is intact (title, other fields unchanged)
  5. Take a screenshot

- [ ] **Step 7: Verify error handling**

  1. Create a new article, click Evento, select "Criar evento…"
  2. Clear the Nome field (leave it empty)
  3. Click Save
  4. Confirm an error message appears and the dialog stays open
  5. Take a screenshot

- [ ] **Step 8: Verify "Criar colaborador…" on author fields**

  1. Click the **Texto** (credit_texto) field dropdown
  2. Confirm "Criar colaborador…" appears at the bottom
  3. Select it, fill in a name, save
  4. Confirm the field is auto-selected with the new author name

- [ ] **Step 9: Commit the bundle to musictide**

  ```bash
  cd /home/n0xx/Code/infra/service/musictide
  git add static/admin/sveltia-cms.js
  git commit -m "feat(cms): inline create for relation fields (event + authors)"
  git push origin main
  ```

- [ ] **Step 10: Commit the final fork state**

  ```bash
  cd /home/n0xx/Code/infra/service/sveltia-cms
  git log --oneline -5
  ```

  Confirm Tasks 1–4 commits are all present on `musictide-patches`.

---

## Known edge cases

- **`value_field: '{{slug}}'`** (not used in musictide) — the auto-select step (`newValue = draft.currentValues[defaultLocale]['{{slug}}']`) returns `undefined`; the field is not auto-selected but the entry is still saved. Acceptable for now.
- **Empty collection** — `options` is empty but the "Criar…" sentinel still appears. Users can create the first entry of a collection inline.
- **Dialog cancel mid-save** — Cancel is `disabled={saving}` so the user cannot cancel while `saveEntry()` is in flight.
- **Concurrent dialog opens** — Not possible; the sentinel triggers `dialogOpen = true` and the sentinel is reset to the previous value immediately, preventing a second open.
