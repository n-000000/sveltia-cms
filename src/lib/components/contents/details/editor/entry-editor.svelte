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

  /*
   * Scope the flex-item sizing to the top-level form's DIRECT children only (`>`), never nested
   * `object`/`list` subfields — those `.field` sections live deeper in the tree, out of P10's scope.
   * `min-width` is the one property that isn't inert outside a flex parent, so leaking it would force
   * nested subfields wider than their container on narrow viewports. A field's inline `flex-basis`
   * (from its `width`) overrides the 100% default here; unwidthed fields stay full-width, own row.
   */
  .field-flow > :global(.field),
  .field-flow > :global(.placeholder) {
    box-sizing: border-box;
    flex: 0 1 100%;
    min-width: 240px;
  }
</style>
