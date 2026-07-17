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
   * @property {string} [comboPlaceholder] Placeholder shown when the field title is folded into
   * the combo (P18-A2); `undefined` for non-combo rendering.
   * @property {string} [comboTooltip] Field description shown as a tooltip when the combo title is
   * suppressed.
   */

  /** @type {FieldEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    fieldId,
    fieldLabel,
    fieldConfig,
    currentValue = $bindable(),
    required = true,
    readonly = false,
    invalid = false,
    sortOptions = false,
    onCreateNew = undefined,
    createLabel = 'Create new…',
    comboPlaceholder = undefined,
    comboTooltip = undefined,
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
    {fieldLabel}
    {fieldConfig}
    bind:currentValue
    {readonly}
    {required}
    {invalid}
    {options}
    {comboPlaceholder}
    {comboTooltip}
    {...(!multiple ? { onCreateNew, createLabel } : {})}
  />
{/key}
