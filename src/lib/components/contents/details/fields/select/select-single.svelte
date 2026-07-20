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
   * @property {string} [comboPlaceholder] Placeholder shown when the field title is folded into
   * the combo (P18-A2); `undefined` for non-combo rendering.
   * @property {string} [comboTooltip] Field description shown as a tooltip when the combo title is
   * suppressed.
   */

  /** @type {SelectFieldSelectorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    fieldId,
    fieldLabel,
    fieldConfig,
    currentValue = $bindable(),
    required = true,
    readonly = false,
    invalid = false,
    options,
    onCreateNew = undefined,
    createLabel = 'Create new…',
    comboPlaceholder = undefined,
    comboTooltip = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const { dropdown_threshold: dropdownThreshold = 5 } = $derived(fieldConfig);
  /** @type {string | undefined} */
  let valueType = $state(undefined);
  let lastGoodValue = $state(currentValue !== '__inline_create__' ? currentValue : undefined);

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

  // The combobox shows its "select an option" placeholder only when its value is `undefined`
  // (@sveltia/ui combobox). New entries seed an unconfigured single-select as '' (or null for
  // numeric) per the field-default contract, so on *create* the empty combo matched the injected
  // "(None)" option and showed that instead of the placeholder — unlike *edit*, where the never-set
  // value is undefined and the placeholder shows. Map the empty/unselected value to undefined for
  // display so both render the same helpful placeholder; the stored `currentValue` is unchanged.
  const displayValue = $derived(
    currentValue === undefined || currentValue === null || currentValue === ''
      ? undefined
      : currentValue,
  );

  const finalOptions = $derived.by(() => {
    let opts = [...options];

    // Allow to deselect an option if the field is optional
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
  <Select
    value={displayValue}
    {readonly}
    {required}
    {invalid}
    ariaLabel={comboPlaceholder ? fieldLabel : undefined}
    aria-labelledby={comboPlaceholder ? undefined : `${fieldId}-label`}
    title={comboTooltip || undefined}
    aria-errormessage="{fieldId}-error"
    onChange={(/** @type {CustomEvent} */ event) => {
      const newValue = event.detail?.value;

      if (newValue === '__inline_create__') {
        const text = document.querySelector('.content.combobox .sui.search-bar input')?.value ?? '';

        currentValue = lastGoodValue;
        onCreateNew?.(text);
        return;
      }

      currentValue = newValue;
    }}
  >
    {#each finalOptions as { label, value, searchValue }, index (`${index}-${value}`)}
      <Option {label} {value} {valueType} {searchValue} selected={value === currentValue} wrap />
    {/each}
  </Select>
{:else}
  <RadioGroup
    {readonly}
    {required}
    {invalid}
    ariaLabel={comboPlaceholder ? fieldLabel : undefined}
    aria-labelledby={comboPlaceholder ? undefined : `${fieldId}-label`}
    title={comboTooltip || undefined}
    aria-errormessage="{fieldId}-error"
    onChange={({ detail: { value } }) => {
      currentValue = value;
    }}
  >
    {#each finalOptions as { label, value }, index (`${index}-${value}`)}
      <Radio {label} {value} {valueType} checked={value === currentValue} />
    {/each}
  </RadioGroup>
{/if}
