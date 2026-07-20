import { addMessages, locale as appLocale, getLocaleFromNavigator, init } from '@sveltia/i18n';
import { resources as componentStrings } from '@sveltia/ui';
import { getPathInfo } from '@sveltia/utils/file';
import { toStore } from 'svelte/store';

import { prefs } from '$lib/services/user/prefs.svelte';

/**
 * @import { Readable } from 'svelte/store';
 */

/**
 * Current application locale as a Svelte store, derived from `locale` of `sveltia-i18n`.
 * @type {Readable<string>}
 */
export const appLocaleStore = toStore(() => appLocale.current);

/**
 * Load strings and initialize the locales.
 * @see https://github.com/sveltia/sveltia-i18n
 * @see https://vitejs.dev/guide/features.html#glob-import
 */
export const initAppLocale = () => {
  // YAML files are transformed into JS objects by the `yamlToJS` Vite plugin at build time
  const modules = import.meta.glob('$lib/locales/*.yaml', { eager: true, import: 'default' });

  Object.entries(modules).forEach(([path, content]) => {
    const locale = getPathInfo(path).filename;

    addMessages(locale, {
      .../** @type {Record<string, any>} */ (content),
      // `@sveltia/ui` ships only `en` and `ja`. Setting `_sui` to `{}` for any other locale makes
      // the namespace exist but empty, so `fallbackLocale: 'en'` never resolves its nested keys and
      // raw keys like `_sui.combobox.select_an_option` leak into the UI. Layer the sources instead:
      // English base → upstream strings for this locale → our own `_sui` block, which wins.
      // (Our own block also covers dev, where `componentStrings` is empty because Vite pre-bundles
      // `@sveltia/ui` with esbuild, which leaves its `import.meta.glob` untransformed.)
      _sui: {
        ...(componentStrings.en ?? {}),
        ...(componentStrings[locale] ?? {}),
        .../** @type {Record<string, any>} */ (content)._sui,
      },
    });
  });

  init({
    fallbackLocale: 'en',
    initialLocale: prefs.locale || (getLocaleFromNavigator() ?? '').split('-')[0] || 'en',
  });
};
