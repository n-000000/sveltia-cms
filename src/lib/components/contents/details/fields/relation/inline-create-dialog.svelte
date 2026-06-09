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
      if (!snapshot) {
        snapshot = get(entryDraft);
        createDraft({
          collection: targetCollection,
          dynamicValues: prefillText ? { [valueField]: prefillText } : {},
        });
      }
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
    if (saving) return;
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
