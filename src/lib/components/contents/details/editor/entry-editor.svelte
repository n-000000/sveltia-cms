<script>
  import VisibilityObserver from '$lib/components/common/visibility-observer.svelte';
  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
  import SlugEditor from '$lib/components/contents/details/editor/slug-editor.svelte';
  import { entryDraft } from '$lib/services/contents/draft';
  import { parseFieldWidth } from '$lib/services/contents/fields/layout';

  /**
   * @import { InternalLocaleCode } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Current pane’s locale.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    /* eslint-enable prefer-const */
  } = $props();

  const fields = $derived($entryDraft?.fields ?? []);
</script>

<VisibilityObserver>
  {#if !!$entryDraft?.slugEditor[locale]}
    <SlugEditor {locale} />
  {/if}
  <div class="field-flow">
    {#each fields as fieldConfig (fieldConfig.name)}
      {@const basis = parseFieldWidth(fieldConfig.width)}
      <VisibilityObserver style={basis ? `flex-basis: ${basis}` : undefined}>
        <FieldEditor
          keyPath={fieldConfig.name}
          typedKeyPath={fieldConfig.name}
          {locale}
          {fieldConfig}
        />
      </VisibilityObserver>
    {/each}
  </div>
</VisibilityObserver>

<style>
  .field-flow {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
  }
</style>
