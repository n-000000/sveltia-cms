<!--
  @component
  Implement the preview for the File and Image field types.
  @see https://decapcms.org/docs/widgets/#File
  @see https://decapcms.org/docs/widgets/#Image
  @see https://sveltiacms.app/en/docs/fields/file
  @see https://sveltiacms.app/en/docs/fields/image
-->
<script>
  import FilePreviewItem from '$lib/components/contents/details/fields/file/file-preview-item.svelte';
  import { isMultiple } from '$lib/services/integrations/media-libraries/shared';

  /**
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import { MediaField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {MediaField} fieldConfig Field configuration.
   * @property {string | string[] | undefined} currentValue Field value.
   */

  /** @type {FieldPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    keyPath,
    locale,
    typedKeyPath,
    fieldConfig,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();
</script>

{#if isMultiple(fieldConfig)}
  {#if Array.isArray(currentValue)}
    {#each currentValue as value, index (`${value}-${index}`)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        role="none"
        onclick={(e) => {
          e.stopPropagation();
          window.postMessage(
            { type: 'highlight-editor-field', payload: { locale, keyPath: `${keyPath}.${index}` } },
            window.location.origin,
          );
        }}
      >
        <FilePreviewItem {value} {fieldConfig} {typedKeyPath} />
      </div>
    {/each}
  {/if}
{:else if typeof currentValue === 'string' && currentValue}
  <FilePreviewItem value={currentValue} {fieldConfig} {typedKeyPath} />
{/if}
