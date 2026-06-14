import { addMessages, locale as appLocale, getLocaleFromNavigator, init } from '@sveltia/i18n';
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
 * Locale override from the CMS `config.yml` `locale:` key. Set once after config is parsed;
 * takes precedence over browser locale but can still be overridden by the user's prefs.
 * @type {string}
 */
let configLocale = '';

/**
 * Store the config-specified locale so that `initAppLocale` can use it on subsequent calls.
 * Call this from the config service after parsing `rawConfig.locale`.
 * @param {string} locale Locale code (e.g. `'pt'`).
 */
export const setConfigLocale = (locale) => {
  configLocale = locale;
};

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

    addMessages(locale, /** @type {Record<string, any>} */ (content));
  });

  init({
    fallbackLocale: 'en',
    // prefs.locale (user's explicit choice) wins; then config locale; then browser locale.
    initialLocale:
      prefs.locale || configLocale || (getLocaleFromNavigator() ?? '').split('-')[0] || 'en',
  });
};
