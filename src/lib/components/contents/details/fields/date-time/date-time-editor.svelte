<!--
  @component
  Implement the editor for a DateTime field.
  @see https://decapcms.org/docs/widgets/#Datetime
  @see https://sveltiacms.app/en/docs/fields/datetime
  @todo Replace the native `<input>` with a custom component.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, TextInput } from '@sveltia/ui';
  import { untrack } from 'svelte';

  import { parseDateTimeConfig } from '$lib/services/contents/fields/date-time/config';
  import {
    getCurrentDateTime,
    getCurrentValue,
    getDate,
    getDisplayInputValue,
    getInputValue,
    getValueFromDisplayInput,
  } from '$lib/services/contents/fields/date-time/helper';
  import {
    getInitialTimeZone,
    getTimeZoneLabel,
  } from '$lib/services/contents/fields/date-time/timezone';

  /**
   * @import { FieldEditorProps } from '$lib/types/private';
   * @import { DateTimeField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {DateTimeField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
   */

  /** @type {FieldEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    fieldId,
    fieldConfig,
    currentValue = $bindable(),
    required = true,
    readonly = false,
    invalid = false,
    /* eslint-enable prefer-const */
  } = $props();

  let inputValue = $state('');
  let isInputFocused = $state(false);

  const { type, min, max, step, dateOnly, utc, singleCustomTimeZone, displayFormat } = $derived(
    parseDateTimeConfig(fieldConfig),
  );
  // P59: when `date_format`/`time_format` are configured, render a text input that honours that
  // format (native `<input>` display is browser-locale-locked and ignores the config). Fields with
  // no display format keep the native picker unchanged.
  const useTextInput = $derived(!!displayFormat);
  const timeZone = $derived(getInitialTimeZone(currentValue, fieldConfig));

  /**
   * Update {@link inputValue} based on {@link currentValue}. Only update if the input is not
   * currently focused to avoid interfering with user typing.
   */
  const setInputValue = () => {
    if (isInputFocused) {
      return;
    }

    const _inputValue = useTextInput
      ? getDisplayInputValue({ currentValue, fieldConfig, timeZone })
      : getInputValue({ currentValue, fieldConfig, timeZone });

    // Avoid a cycle dependency & infinite loop
    if (_inputValue !== undefined && _inputValue !== inputValue) {
      inputValue = _inputValue;
    }
  };

  /**
   * Update {@link currentValue} based on {@link inputValue}.
   */
  const setCurrentValue = () => {
    const _currentValue = useTextInput
      ? getValueFromDisplayInput({ inputValue, currentValue, fieldConfig, timeZone })
      : getCurrentValue({ inputValue, currentValue, fieldConfig, timeZone });

    // Avoid a cycle dependency & infinite loop
    if (
      _currentValue !== undefined &&
      _currentValue !== currentValue &&
      // Compare the actual date/time: if a user edits an existing entry in a different location
      // than where it was originally written, `inputValue` and `_currentValue` may shift to the
      // current timezone, but the epoch won’t change. Don’t update `currentValue` in that case.
      Number(getDate(_currentValue, fieldConfig)) !== Number(getDate(currentValue, fieldConfig))
    ) {
      currentValue = _currentValue;
    }
  };

  $effect(() => {
    // Keep the displayed value in sync with the stored entry value.
    void [currentValue];

    untrack(() => {
      setInputValue();
    });
  });

  $effect(() => {
    // Only update currentValue when inputValue changes (not when timezone changes)
    void [inputValue];

    untrack(() => {
      setCurrentValue();
    });
  });

  /**
   * Handle input focus event.
   */
  const handleFocus = () => {
    isInputFocused = true;
  };

  /**
   * Handle input blur event - sync values when user finishes editing.
   */
  const handleBlur = () => {
    isInputFocused = false;
    // After losing focus, ensure inputValue is synced with currentValue
    setInputValue();
  };
</script>

<div role="none">
  {#if useTextInput}
    <!-- P59: styled TextInput (matches sibling fields) honouring the config display format; `flex`
         lets it fill the cell so the Now/Clear buttons wrap below instead of overflowing a
         width-constrained (P10) field cell. -->
    <TextInput
      flex
      placeholder={displayFormat}
      bind:value={inputValue}
      {readonly}
      {invalid}
      aria-required={required}
      aria-labelledby="{fieldId}-label"
      aria-errormessage="{fieldId}-error"
      onfocus={handleFocus}
      onblur={handleBlur}
    />
  {:else}
    <input
      {...{ type, min, max, step }}
      bind:value={inputValue}
      {readonly}
      aria-readonly={readonly}
      aria-required={required}
      aria-invalid={invalid}
      aria-labelledby="{fieldId}-label"
      aria-errormessage="{fieldId}-error"
      onfocus={handleFocus}
      onblur={handleBlur}
    />
  {/if}
  {#if !readonly}
    <Button
      variant="tertiary"
      label={_(dateOnly ? 'today' : 'now')}
      onclick={() => {
        inputValue = useTextInput
          ? getDisplayInputValue({
              currentValue: getCurrentDateTime(fieldConfig, timeZone),
              fieldConfig,
              timeZone,
            })
          : getCurrentDateTime(fieldConfig, timeZone);
      }}
    />
  {/if}
  {#if !readonly && !required}
    <Button
      variant="tertiary"
      label={_('clear')}
      disabled={!currentValue}
      onclick={() => {
        currentValue = '';
      }}
    />
  {/if}
</div>

{#if singleCustomTimeZone}
  <div role="none" class="timezone">
    {getTimeZoneLabel(singleCustomTimeZone, getDate(currentValue, fieldConfig))}
  </div>
{:else if utc}
  <div role="none" class="timezone">UTC</div>
{/if}

<style>
  div {
    display: flex;
    /* P59-fix: let the Now/Clear buttons drop below the input when the field cell is too narrow to
       hold them side-by-side (P10 fractions on a phone). Without this the row can't shrink to fit
       and overflows its cell horizontally instead of flowing down like every other control. */
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    /* P59-fix: @sveltia/ui controls carry `margin-block: 4px`, which collapses through the block
       `field-wrapper` for normal widgets so they sit flush at the wrapper top. This flex row does
       NOT collapse its children’s margins, so the honoured 4px pushed the datetime control 4px
       below the dropdowns it shares an inline (P10) row with. Carry the 4px on the row itself
       (block-level → collapses like siblings) and zero it on the children so they align. */
    margin-block: 4px;
  }

  div > :global(.sui) {
    margin-block: 0;
  }

  /* P59: the input fills the row and may shrink to nothing (min-width: 0), but an 8em basis makes
     the Now/Clear buttons wrap below as a group before the input becomes unusably small — so on a
     narrow cell you get [input] over [Now][Clear] rather than a squished single line. Targets both
     the native `<input>` (no display format) and the `.sui` TextInput (custom display format). */

  div > input,
  div > :global(.sui.text-input) {
    flex: 1 1 8em;
    min-width: 0;
  }

  /* Keep the buttons at their intrinsic size so they wrap as whole units instead of squishing. */
  div > :global(.sui.button) {
    flex: none;
  }

  .timezone {
    margin: 4px 8px 0;
    color: var(--sui-secondary-foreground-color);
    font-size: var(--sui-font-size-small);
    white-space: nowrap;
  }
</style>
