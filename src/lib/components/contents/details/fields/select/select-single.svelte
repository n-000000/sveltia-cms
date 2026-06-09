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
