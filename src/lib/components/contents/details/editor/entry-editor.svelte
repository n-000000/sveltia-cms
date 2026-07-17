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
    /*
     * Live inside the app's 768px reading column (the same constant field-editor-group applies to
     * each field's content via `max-width: 768px`). Fractional fields then subdivide THIS column and
     * align with full-width fields — instead of full-width fields being inset to 768 while fractions
     * fill the whole pane (the misalignment). Full-width fields look identical to before (768 centred).
     */
    max-width: 768px;
    margin-inline: auto;
  }

  /*
   * Direct children of the top-level form only (`>`) — never nested `object`/`list` subfields (they
   * live deeper in the tree, out of P10's scope). A field's inline `flex-basis` (from its `width`)
   * subdivides the column; the default 100% = full row.
   *
   * NO `min-width`: fields scale proportionally as the column narrows and KEEP their row structure
   * at every width — responsiveness is "shrink in place", not "reflow / move fields to new rows".
   * (Dropping min-width also retires the earlier nested-context leak: min-width was the only property
   * here that isn't inert outside a flex parent.)
   */
  .field-flow > :global(.field),
  .field-flow > :global(.placeholder) {
    box-sizing: border-box;
    flex: 0 1 100%;
  }
</style>
