<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon } from '@sveltia/ui';
  import { getPathInfo } from '@sveltia/utils/file';
  import { isURL } from '@sveltia/utils/string';
  import { untrack } from 'svelte';

  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import { getAssetByPath } from '$lib/services/assets';
  import { getMediaFieldURL } from '$lib/services/assets/info';
  import { getMediaKind } from '$lib/services/assets/kinds';
  import { entryDraft } from '$lib/services/contents/draft';

  /**
   * @import { Asset, AssetKind, Entry } from '$lib/types/private';
   * @import { MediaField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {string} value The file value (URL, blob URL, or file path).
   * @property {string} fieldId The field ID for accessibility.
   * @property {MediaField} fieldConfig Field configuration.
   * @property {boolean} readonly Whether the field is readonly.
   * @property {boolean} invalid Whether the field is invalid.
   * @property {boolean} required Whether the field is required.
   * @property {boolean} [draggable] Whether to show a drag handle for reordering.
   * @property {string} collectionName The collection name.
   * @property {string | undefined} fileName The file name.
   * @property {string} [typedKeyPath] Field key path for field-level media folders.
   * @property {string} [componentName] Custom editor component name for a field-level asset folder.
   * @property {Entry | undefined} entry The entry object.
   * @property {() => void} [onReplace] Event handler for replace action.
   * @property {() => void} [onRemove] Event handler for remove action.
   */

  /** @type {Props} */
  const {
    value,
    fieldId,
    fieldConfig,
    readonly = false,
    invalid = false,
    required = false,
    draggable = false,
    collectionName = '',
    fileName = undefined,
    typedKeyPath = undefined,
    componentName = undefined,
    entry = undefined,
    onReplace,
    onRemove,
  } = $props();

  /** @type {Asset | undefined} */
  let asset = $state();
  /** @type {File | undefined} */
  let file = $state();
  /** @type {AssetKind | undefined} */
  let kind = $state();
  /** @type {string | undefined} */
  let src = $state();

  const { widget: fieldType } = $derived(fieldConfig);
  const isImageField = $derived(fieldType === 'image');

  const getURLArgs = $derived({
    value,
    entry,
    collectionName,
    fileName,
    componentName,
    typedKeyPath,
    fieldConfig,
  });

  /**
   * The file name to display for the selected asset or file — just the basename, no directory
   * structure or URL. Showing the full stored value (which for R2-hosted assets is a long public
   * URL) buries the one thing the editor cares about, the file name, in storage-schema noise.
   * @type {string}
   * @todo Handle template tags and relative paths if possible.
   */
  const fileDisplayName = $derived.by(() => {
    if (!value) {
      return '';
    }

    if (file) {
      return decodeURI(file.name.normalize());
    }

    if (!value.startsWith('blob:')) {
      let decodedValue = decodeURI(value);

      // Drop the query string (mainly for Unsplash URLs, which carry long image-parameter queries)
      // before reducing to the basename.
      if (isURL(decodedValue)) {
        // eslint-disable-next-line svelte/prefer-svelte-reactivity
        const url = new URL(decodedValue);

        url.search = '';
        decodedValue = `${url}`;
      }

      // ponytail: basename keeps the extension; swap to `.filename` to also drop it.
      return getPathInfo(decodedValue).basename;
    }

    return '';
  });

  /**
   * Update properties when value changes.
   */
  const updateProps = async () => {
    // Restore `file` after a draft backup is restored
    if (value?.startsWith('blob:') && $entryDraft) {
      file = $entryDraft.files[value]?.file;
    }

    // Update the `src` when an asset is selected
    if (value) {
      if (isImageField && /^https?:/.test(value)) {
        asset = undefined;
        kind = 'image';
        src = value;
      } else if (!value.startsWith('blob:')) {
        asset = getAssetByPath({ ...getURLArgs });
        kind = undefined;
        src = undefined;
      }

      if (!asset && !src) {
        kind = await getMediaKind(value);
        src = kind ? await getMediaFieldURL({ ...getURLArgs, thumbnail: true }) : undefined;
      }
    } else {
      // Remove properties after the value is removed
      asset = undefined;
      file = undefined;
      kind = undefined;
      src = undefined;
    }
  };

  $effect(() => {
    void [value];

    untrack(() => {
      updateProps();
    });
  });
</script>

<div role="none" class="filled">
  {#if draggable && !readonly}
    <div role="none" class="drag-handle" title={_('reorder')}>
      <Icon name="drag_indicator" />
    </div>
  {/if}
  {#if kind && src}
    <AssetPreview {kind} {src} variant="tile" checkerboard={true} />
  {:else if asset}
    <AssetPreview kind={asset.kind} {asset} variant="tile" checkerboard={true} />
  {:else}
    <span role="none" class="preview no-thumbnail">
      <Icon name="draft" />
    </span>
  {/if}
  <div role="none">
    {#if typeof value === 'string'}
      <div
        role="textbox"
        id="{fieldId}-value"
        tabindex="0"
        class="filename"
        aria-readonly={readonly}
        aria-invalid={invalid}
        aria-required={required}
        aria-labelledby="{fieldId}-label"
        aria-errormessage="{fieldId}-error"
      >
        {fileDisplayName}
      </div>
    {/if}
    <div role="none">
      {#if onReplace}
        <Button
          disabled={readonly}
          variant="tertiary"
          size="small"
          label={_('replace')}
          aria-label={_(`replace_${fieldType}`)}
          aria-controls="{fieldId}-value"
          onclick={() => {
            onReplace();
          }}
        />
      {/if}
      {#if onRemove}
        <Button
          disabled={readonly}
          variant="tertiary"
          size="small"
          label={_('remove')}
          aria-label={_(`remove_${fieldType}`)}
          aria-controls="{fieldId}-value"
          onclick={() => {
            onRemove();
          }}
        />
      {/if}
    </div>
  </div>
</div>

<style>
  .filled {
    display: flex !important;
    align-items: center;
    gap: 12px;
    margin: var(--sui-focus-ring-width);

    :global {
      .preview {
        flex: none;
        width: 120px !important;
        height: 120px !important;
        border-color: var(--sui-control-border-color) !important;
        border-radius: var(--sui-control-medium-border-radius);
        padding: 8px !important;

        &.no-thumbnail {
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--sui-secondary-background-color);

          .icon {
            font-size: 64px;
          }
        }
      }

      .sui.button.tertiary.small {
        margin: var(--sui-focus-ring-width);
      }
    }

    & > div {
      flex: auto;
      overflow: hidden;

      .filename {
        margin: var(--sui-focus-ring-width);
        padding: 4px;
        word-break: break-all;

        &:empty {
          margin: 0;
          padding: 0;
        }
      }
    }
  }

  .drag-handle {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    color: var(--sui-secondary-foreground-color);
    cursor: grab;
    touch-action: none;

    &:active {
      cursor: grabbing;
    }
  }
</style>
