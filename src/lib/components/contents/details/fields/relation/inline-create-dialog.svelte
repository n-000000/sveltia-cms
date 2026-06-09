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
