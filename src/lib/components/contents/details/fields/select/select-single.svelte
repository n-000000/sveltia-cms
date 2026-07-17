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
    bind:value={currentValue}
    {readonly}
    {required}
    {invalid}
    ariaLabel={comboPlaceholder ? fieldLabel : undefined}
    aria-labelledby={comboPlaceholder ? undefined : `${fieldId}-label`}
    title={comboTooltip || undefined}
    aria-errormessage="{fieldId}-error"
    onChange={() => {
      if (currentValue === '__inline_create__') {
        const text = document.querySelector('.content.combobox .sui.search-bar input')?.value ?? '';

        currentValue = lastGoodValue;
        onCreateNew?.(text);
      }
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
