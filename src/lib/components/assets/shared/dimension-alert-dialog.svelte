<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { AlertDialog } from '@sveltia/ui';

  import { getListFormatter } from '$lib/services/contents/i18n';

  /**
   * @import { SharedMediaLibraryOptions } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} open Whether the dialog is open.
   * @property {string[]} fileNames Names of the files that failed the dimension constraints.
   * @property {SharedMediaLibraryOptions} config Field media-library config carrying the
   * aspect-ratio / resolution constraints.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    open = $bindable(false),
    fileNames,
    config,
    /* eslint-enable prefer-const */
  } = $props();

  const requirement = $derived.by(() => {
    const { aspect_ratio, min_width, min_height, max_width, max_height } =
      /** @type {any} */ (config ?? {});
    /** @type {string[]} */
    const parts = [];

    if (aspect_ratio !== undefined) {
      parts.push(_('dimension_hint.aspect_ratio', { values: { ratio: String(aspect_ratio) } }));
    }

    if (typeof min_width === 'number') {
      parts.push(_('dimension_hint.min_width', { values: { px: min_width } }));
    }

    if (typeof min_height === 'number') {
      parts.push(_('dimension_hint.min_height', { values: { px: min_height } }));
    }

    if (typeof max_width === 'number') {
      parts.push(_('dimension_hint.max_width', { values: { px: max_width } }));
    }

    if (typeof max_height === 'number') {
      parts.push(_('dimension_hint.max_height', { values: { px: max_height } }));
    }

    return getListFormatter(appLocale.current).format(parts);
  });
</script>

<AlertDialog bind:open title={_('assets_dialog.wrong_dimensions.title')}>
  <div>
    {_('warning_wrong_dimensions', {
      values: { count: fileNames.length, requirement },
    })}
  </div>
  <div>
    {getListFormatter(appLocale.current).format(fileNames)}
  </div>
</AlertDialog>
