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
