<script>
  import { waitForVisibility } from '@sveltia/utils/element';

  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {Snippet} children Slot content.
   * @property {string} [style] Inline style applied to the placeholder element.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    children,
    style = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {HTMLElement | null} */
  let placeholder = $state(null);
  /** @type {boolean} */
  let visible = $state(false);

  $effect(() => {
    if (placeholder) {
      (async () => {
        await waitForVisibility(placeholder);
        visible = true;
      })();
    }
  });
</script>

{#if visible}
  {@render children()}
{:else}
  <div class="placeholder" {style} bind:this={placeholder}></div>
{/if}

<style>
  .placeholder {
    box-sizing: border-box;
    flex-basis: 100%;
    min-width: 240px;
    height: 64px;
  }
</style>
