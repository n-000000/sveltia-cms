<script>
  import { _ } from '@sveltia/i18n';
  import { Icon, Menu, MenuButton, Spacer } from '@sveltia/ui';
  import { escapeRegExp } from '@sveltia/utils/string';
  import equal from 'fast-deep-equal';
  import { sanitize } from 'isomorphic-dompurify';
  import { parseInline } from 'marked';
  import { getContext, setContext } from 'svelte';
  import { writable } from 'svelte/store';

  import CopyMenuItems from '$lib/components/contents/details/editor/copy-menu-items.svelte';
  import FieldEditorGroup from '$lib/components/contents/details/editor/field-editor-group.svelte';
  import TranslateButton from '$lib/components/contents/details/editor/translate-button.svelte';
  import ValidationError from '$lib/components/contents/details/editor/validation-error.svelte';
  import { editors } from '$lib/components/contents/details/fields';
  import { entryDraft, INTERNAL_PROP_REGEX } from '$lib/services/contents/draft';
  import { resetFieldToDefault } from '$lib/services/contents/draft/defaults';
  import {
    resolveOriginalKeyPath,
    revertChanges,
  } from '$lib/services/contents/draft/update/revert';
  import { isFieldMultiple, isFieldRequired } from '$lib/services/contents/entry/fields';
  import { comboPlaceholder, isComboField } from '$lib/services/contents/fields/field-header';
  import { parseFieldWidth } from '$lib/services/contents/fields/layout';
  import { isFieldVisible, isRoleVisible, ROLE_VALUES } from '$lib/services/contents/fields/visibility';
  import { DEFAULT_I18N_CONFIG } from '$lib/services/contents/i18n/config';
  import { prefs } from '$lib/services/user/prefs.svelte';

  /**
   * @import { Component } from 'svelte';
   * @import { Writable } from 'svelte/store';
   * @import {
   * DraftValueStoreKey,
   * FieldContext,
   * FieldEditorContext,
   * InternalLocaleCode,
   * TypedFieldKeyPath,
   * } from '$lib/types/private';
   * @import {
   * BooleanField,
   * Field,
   * FieldKeyPath,
   * NumberField,
   * StringField,
   * VisibleField,
   * } from '$lib/types/public';
   */

  /** @type {FieldEditorContext} */
  const parent = getContext('field-editor') ?? {};

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Current pane’s locale.
   * @property {FieldKeyPath} keyPath Field key path.
   * @property {TypedFieldKeyPath} typedKeyPath Typed field key path.
   * @property {Field} fieldConfig Field configuration.
   * @property {FieldContext} [context] Where the field is rendered.
   * @property {string} [componentName] Name of the parent rich text editor component, if any.
   * @property {DraftValueStoreKey} [valueStoreKey] Key to store the values in {@link EntryDraft}.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    typedKeyPath,
    fieldConfig,
    context: fieldContext = parent.fieldContext ?? undefined,
    componentName,
    valueStoreKey = parent.valueStoreKey ?? 'currentValues',
    /* eslint-enable prefer-const */
  } = $props();

  const fieldId = $props.id();

  /**
   * Parse the given string as Markdown and sanitize the result to only allow certain tags.
   * @param {string} str Original string.
   * @returns {string} Sanitized string.
   */
  const _sanitize = (str) =>
    sanitize(/** @type {string} */ (parseInline(str.replaceAll('\\n', '<br>'))), {
      ALLOWED_TAGS: ['strong', 'em', 'del', 'code', 'a', 'br'],
      ALLOWED_ATTR: ['href'],
    });

  /** @type {Writable<Component>} */
  const extraHint = writable();

  setContext(
    'field-editor',
    // svelte-ignore state_referenced_locally
    /** @type {FieldEditorContext} */ ({
      fieldContext,
      parentComponentNames: [...(parent.parentComponentNames ?? []), componentName].filter(Boolean),
      extraHint,
      valueStoreKey,
    }),
  );

  const inEditorComponent = $derived(fieldContext === 'rich-text-editor-component');
  const { name: fieldName, widget: fieldType = 'string', i18n = false } = $derived(fieldConfig);
  const {
    label = '',
    comment = '',
    hint = '',
    readonly: readonlyOption = false,
  } = $derived(/** @type {VisibleField} */ (fieldConfig));
  const required = $derived(isFieldRequired({ fieldConfig, locale }));
  const multiple = $derived(isFieldMultiple(fieldConfig));
  // Combo detection (P18-A2): dropdown-rendered `select`/`relation` fields fold their title into
  // the widget's placeholder instead of showing the `<h4>` + comment row. Guarded with `!multiple`
  // because a multi-value relation/select renders through the isList branch below (checkbox group
  // or tag combobox via `select-multiple.svelte`), which doesn't consume the combo props — without
  // this guard the header would be suppressed with nothing to replace it.
  const optionCount = $derived(
    Array.isArray(fieldConfig?.options) ? fieldConfig.options.length : 0,
  );
  const isCombo = $derived(isComboField(fieldConfig, optionCount) && !multiple);
  const allowPrefix = $derived(['string'].includes(fieldType));
  const prefix = $derived(
    allowPrefix ? /** @type {StringField} */ (fieldConfig).prefix : undefined,
  );
  const suffix = $derived(
    allowPrefix ? /** @type {StringField} */ (fieldConfig).suffix : undefined,
  );
  const allowExtraLabels = $derived(['boolean', 'number', 'string'].includes(fieldType));
  const beforeInputLabel = $derived(
    allowExtraLabels
      ? /** @type {BooleanField | NumberField | StringField} */ (fieldConfig).before_input
      : undefined,
  );
  const afterInputLabel = $derived(
    allowExtraLabels
      ? /** @type {BooleanField | NumberField | StringField} */ (fieldConfig).after_input
      : undefined,
  );
  const hasExtraLabels = $derived(!!(prefix || suffix || beforeInputLabel || afterInputLabel));
  const isList = $derived(fieldType === 'list' || multiple);
  const collection = $derived($entryDraft?.collection);
  const collectionFile = $derived($entryDraft?.collectionFile);
  const originalValues = $derived($entryDraft?.originalValues);
  const { i18nEnabled, allLocales, defaultLocale } = $derived(
    (collectionFile ?? collection)?._i18n ?? DEFAULT_I18N_CONFIG,
  );
  const otherLocales = $derived(i18nEnabled ? allLocales.filter((l) => l !== locale) : []);
  const canTranslate = $derived(i18nEnabled && (i18n === true || i18n === 'translate'));
  const canDuplicate = $derived(i18nEnabled && i18n === 'duplicate');
  const canEdit = $derived(
    inEditorComponent || locale === defaultLocale || canTranslate || canDuplicate,
  );
  const canCopy = $derived(!inEditorComponent && canTranslate && otherLocales.length);
  const canRevert = $derived(!inEditorComponent && !(canDuplicate && locale !== defaultLocale));
  const keyPathRegex = $derived(new RegExp(`^${escapeRegExp(keyPath)}\\.\\d+$`));
  const currentValue = $derived.by(() => {
    const valueMap = $state.snapshot($entryDraft?.[valueStoreKey][locale] ?? {});
    const value = valueMap[keyPath];

    if (!isList) {
      return value;
    }

    // Multiple values are flattened in the value map object
    const list = Object.entries(valueMap).filter(([_keyPath]) => keyPathRegex.test(_keyPath));

    if (list.length) {
      return list.map(([, val]) => val).filter((val) => val !== undefined);
    }

    // Convert invalid single value to list. This is in place to handle the case when a field is
    // changed from single to multiple. (Continue to the `$effect` block below.)
    // @todo Move this logic to entry normalization module
    if (multiple && value !== undefined && typeof value !== 'object') {
      return [value];
    }

    return [];
  });
  const originalValue = $derived.by(() => {
    if (isList) {
      return Object.entries(originalValues?.[locale] ?? {})
        .filter(([_keyPath]) => keyPathRegex.test(_keyPath))
        .map(([, val]) => val)
        .filter((val) => val !== undefined);
    }

    // For fields inside list items, use the original key path if the item was reordered
    const currentMap = $state.snapshot($entryDraft?.[valueStoreKey][locale] ?? {});
    const resolved = resolveOriginalKeyPath(currentMap, keyPath);

    if (resolved) {
      return originalValues?.[locale]?.[resolved.originalKeyPath];
    }

    return originalValues?.[locale]?.[keyPath];
  });
  const isRevertDisabled = $derived.by(() => {
    if (fieldType === 'list') {
      // For list fields, compare all flat entries under the keyPath prefix, because `currentValue`
      // and `originalValue` may not capture complex (nested) list items correctly
      const currentMap = $state.snapshot($entryDraft?.[valueStoreKey][locale] ?? {});
      const originalMap = originalValues?.[locale] ?? {};
      const keyPathPrefix = `${keyPath}.`;

      const currentEntries = Object.entries(currentMap)
        .filter(([k]) => k.startsWith(keyPathPrefix) && !INTERNAL_PROP_REGEX.test(k))
        .sort(([a], [b]) => a.localeCompare(b));

      const originalEntries = Object.entries(originalMap)
        .filter(([k]) => k.startsWith(keyPathPrefix) && !INTERNAL_PROP_REGEX.test(k))
        .sort(([a], [b]) => a.localeCompare(b));

      return equal(currentEntries, originalEntries);
    }

    return equal(currentValue, originalValue);
  });
  const validity = $derived($entryDraft?.validities[locale][keyPath]);
  const fieldLabel = $derived(label || fieldName);
  const readonly = $derived(
    readonlyOption ||
      (i18n === 'duplicate' && locale !== defaultLocale) ||
      fieldType === 'compute' ||
      fieldType === 'uuid',
  );
  const invalid = $derived(validity?.valid === false);
  // Conditional visibility: hide the field when its `condition` references a sibling whose value
  // doesn't match. Mirrors `currentValue`'s snapshot read so it re-evaluates on sibling edits.
  const fieldVisible = $derived(
    isFieldVisible({
      fieldConfig,
      valueMap: $state.snapshot($entryDraft?.[valueStoreKey][locale] ?? {}),
      keyPath,
    }),
  );

  // Role filter (P16): a render-only view filter driven by the app-chrome toggles. Kept separate
  // from `fieldVisible` (P8) — it must NOT clear or drop the value, only hide the control, so a
  // role's data survives while its fields are filtered out.
  const roleVisible = $derived(
    isRoleVisible(
      /** @type {any} */ (fieldConfig)?.roles,
      ROLE_VALUES.filter((r) => prefs.roleFilter?.[r] !== false),
    ),
  );

  // Inline layout (P10): map an optional `width` fraction to a flex-basis; undefined ⇒ full width.
  const fieldBasis = $derived(parseFieldWidth(/** @type {any} */ (fieldConfig)?.width));

  $effect(() => {
    // Suppressed field (P8): when hidden by an unmet `condition`, wipe its value back to default so
    // no invisible data lingers and re-showing starts clean (toggle off→on ⇒ empty). The helper
    // no-ops once already at default, which stops this effect from looping on its own write. The
    // save path (`serialize.js`) independently drops hidden fields, so on-disk correctness doesn’t
    // depend on this effect having run.
    if ($entryDraft && !fieldVisible) {
      resetFieldToDefault({
        valueMap: $entryDraft[valueStoreKey][locale],
        keyPath,
        fieldConfig,
        locale,
        defaultLocale,
      });
    }
  });

  $effect(() => {
    // Convert invalid single value to list. This is in place to handle the case when a field is
    // changed from single to multiple. (Continued from the `currentValue` store above.)
    // @todo Move this logic to entry normalization module
    if ($entryDraft && multiple && Array.isArray(currentValue)) {
      const listItem = $entryDraft[valueStoreKey][locale]?.[`${keyPath}.0`];
      const [value] = currentValue;

      if (listItem === undefined && value !== undefined) {
        $entryDraft[valueStoreKey][locale][`${keyPath}.0`] = value;
        delete $entryDraft[valueStoreKey][locale][keyPath];
      }
    }
  });

  $effect(() => {
    // Convert invalid list to single value. This is in place to handle the case when a field is
    // changed from multiple to single.
    // @todo Move this logic to entry normalization module
    if ($entryDraft && !multiple && currentValue === undefined) {
      const listItem = $entryDraft[valueStoreKey][locale]?.[`${keyPath}.0`];

      if (listItem !== undefined) {
        $entryDraft[valueStoreKey][locale][keyPath] = listItem;
        // Remove all list items
        Object.keys($entryDraft[valueStoreKey][locale]).forEach((key) => {
          if (keyPathRegex.test(key)) {
            delete $entryDraft[valueStoreKey][locale][key];
          }
        });
      }
    }
  });
</script>

{#if $entryDraft && canEdit && fieldType !== 'hidden' && fieldVisible && roleVisible}
  <FieldEditorGroup
    aria-label={_('x_field', { values: { field: fieldLabel } })}
    data-field-type={fieldType}
    data-key-path={keyPath}
    data-typed-key-path={typedKeyPath}
    hidden={fieldType === 'compute'}
    style={fieldBasis ? `flex-basis: ${fieldBasis}` : undefined}
  >
    {#if canRevert && !isRevertDisabled}
      <button
        type="button"
        class="revert-field"
        aria-label={_('revert_changes')}
        onclick={() => {
          revertChanges({ locale, keyPath });
        }}
      >
        <Icon name="undo" />
      </button>
    {/if}
    <header role="none">
      {#if !isCombo}
        <h4 role="none" id="{fieldId}-label">{fieldLabel}</h4>
      {/if}
      {#if !readonly && required}
        <div class="required" aria-label={_('required')}>*</div>
      {/if}
      <Spacer flex />
      {#if canCopy && ['richtext', 'markdown', 'string', 'text', 'list', 'object'].includes(fieldType)}
        <TranslateButton size="small" {locale} {otherLocales} {keyPath} />
      {/if}
      {#if canCopy}
        <MenuButton
          variant="ghost"
          size="small"
          iconic
          popupPosition="bottom-right"
          aria-label={_('show_field_options')}
        >
          {#snippet popup()}
            <Menu aria-label={_('field_options')}>
              <CopyMenuItems {locale} {otherLocales} {keyPath} />
            </Menu>
          {/snippet}
        </MenuButton>
      {/if}
    </header>
    {#if !readonly && comment && !isCombo}
      <div role="none" class="comment-wrapper">
        <p class="comment">{@html _sanitize(comment)}</p>
      </div>
    {/if}
    {#if validity?.valid === false}
      <ValidationError id="{fieldId}-error">
        {$entryDraft?.validationMessages[locale][keyPath]?.join(' ')}
      </ValidationError>
    {/if}
    <div role="none" class="field-wrapper" class:has-extra-labels={hasExtraLabels}>
      {#if !(fieldType in editors)}
        <div role="none">{_('unsupported_field_type_x', { values: { name: fieldType } })}</div>
      {:else if isList}
        {@const Editor = editors[fieldType]}
        <Editor
          {locale}
          {keyPath}
          {typedKeyPath}
          {fieldId}
          {fieldLabel}
          {fieldConfig}
          {currentValue}
          {readonly}
          {required}
          {invalid}
        />
      {:else}
        {#if beforeInputLabel}
          <div role="none" class="before-input">{@html _sanitize(beforeInputLabel)}</div>
        {/if}
        {#if prefix}
          <div role="none" class="prefix">{prefix}</div>
        {/if}
        {@const Editor = editors[fieldType]}
        <Editor
          {locale}
          {keyPath}
          {typedKeyPath}
          {fieldId}
          {fieldLabel}
          {fieldConfig}
          bind:currentValue={$entryDraft[valueStoreKey][locale][keyPath]}
          {readonly}
          {required}
          {invalid}
          comboPlaceholder={isCombo ? comboPlaceholder(fieldLabel) : undefined}
          comboTooltip={isCombo ? comment : undefined}
        />
        {#if suffix}
          <div role="none" class="suffix">{suffix}</div>
        {/if}
        {#if afterInputLabel}
          <div role="none" class="after-input">{@html _sanitize(afterInputLabel)}</div>
        {/if}
      {/if}
    </div>
    {#if !readonly && (hint || $extraHint)}
      {@const ExtraHint = $extraHint}
      <div role="none" class="footer">
        {#if hint}
          <p class="hint">{@html _sanitize(hint)}</p>
        {/if}
        <ExtraHint {fieldConfig} {locale} {currentValue} />
      </div>
    {/if}
  </FieldEditorGroup>
{/if}

<style>
  /*
   * The field `<section class="field">` element is rendered by the child `FieldEditorGroup`
   * component (field-editor-group.svelte), not written literally in this file's template, so
   * Svelte's per-component style scoping can't reach it directly. `:global()` opts the ancestor
   * part of the selector out of scoping so it matches the real DOM section; `.revert-field` itself
   * stays scoped normally since that button is written in this file's markup.
   */
  :global(section.field) {
    position: relative;
  }

  .revert-field {
    position: absolute;
    inset-block-start: 4px;
    inset-inline-end: 4px;
    opacity: 0;
    transition: opacity 0.1s;
    border: 0;
    background: transparent;
    cursor: pointer;
  }

  :global(section.field:hover) > .revert-field,
  :global(section.field:focus-within) > .revert-field {
    opacity: 1;
  }

  .field-wrapper {
    &.has-extra-labels {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 4px;
    }

    :global {
      :is(input[type='text'], textarea) {
        width: 100%;
      }

      input:is([type='color'], [type='number']) {
        outline: 0;
        border-width: 1px;
        border-color: var(--sui-primary-border-color);
        border-radius: var(--sui-control-medium-border-radius);
        height: var(--sui-button-medium-height);
        color: inherit;
        background-color: var(--sui-textbox-background-color);
      }

      input:is([type='file'], [type='checkbox']) {
        color: inherit;
      }

      & > div {
        color: inherit;
      }

      input:is([type='date'], [type='datetime-local'], [type='time']) {
        outline: 0;
        margin: var(--sui-focus-ring-width);
        border-width: var(--sui-textbox-border-width, 1px);
        border-color: var(--sui-primary-border-color);
        border-radius: var(--sui-control-medium-border-radius);
        padding: var(--sui-textbox-singleline-padding);
        width: auto;
        height: var(--sui-textbox-height);
        color: var(--sui-textbox-foreground-color);
        background-color: var(--sui-textbox-background-color);
        font-family: var(--sui-textbox-font-family);
        font-size: var(--sui-textbox-font-size);
        text-transform: uppercase;

        &:disabled {
          opacity: 0.4;
        }
      }

      input[aria-invalid='true']:is(
          [type='color'],
          [type='date'],
          [type='datetime-local'],
          [type='time']
        ) {
        border-color: var(--sui-error-border-color);
      }

      input:read-only {
        /* Make readonly inputs selectable */
        -webkit-user-select: text;
        user-select: text;
        pointer-events: auto;
      }
    }
  }

  .before-input,
  .after-input,
  .prefix,
  .suffix {
    color: var(--sui-secondary-foreground-color);
    white-space: nowrap;
  }

  .comment,
  .hint {
    margin-inline: var(--sui-focus-ring-width) !important;
    font-size: var(--sui-font-size-small);
    line-height: var(--sui-line-height-compact);
  }

  .comment {
    margin-block: var(--sui-focus-ring-width) !important;
  }

  .hint {
    flex: auto;
    margin-block: var(--sui-focus-ring-width) 0 !important;
    color: var(--sui-tertiary-foreground-color);
  }

  .footer {
    display: flex;
    gap: 16px;
    justify-content: flex-end;
    margin-top: 4px;
  }
</style>
