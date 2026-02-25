/* eslint-disable no-await-in-loop */

/**
 * @import {
 * ExternalAsset,
 * MediaLibraryService,
 * } from '$lib/types/private';
 */

/**
 * @typedef {object} FetchResult
 * @property {string} id Asset ID.
 * @property {string} author Photographer name.
 * @property {number} width Image width.
 * @property {number} height Image height.
 * @property {string} download_url Full-size image URL.
 */

const ENDPOINT = 'https://picsum.photos/v2/list';
const LIMIT = 100;
const TOTAL_PAGES = 10;
const FETCH_PAGES = 3;

/**
 * Parse API results into ExternalAsset format.
 * @param {FetchResult[]} results API results.
 * @returns {ExternalAsset[]} Assets.
 */
export const parseResults = (results) =>
  results.map(({ id, download_url: downloadURL }) => ({
    id,
    // The service doesn’t provide descriptions
    description: '',
    previewURL: `https://picsum.photos/id/${id}/400/300.webp`,
    downloadURL: `${downloadURL}.webp`,
    fileName: `picsum-${id}.webp`,
    kind: 'image',
    // No credit is required as the photos are licensed under CC0
    // https://github.com/DMarby/picsum-photos/issues/81#issuecomment-1340068800
  }));

/**
 * Fetch all available pictures across all pages.
 * @returns {Promise<ExternalAsset[]>} Assets.
 * @see https://picsum.photos/#list-images
 */
export const list = async () => {
  /** @type {FetchResult[]} */
  const results = [];

  // Pick random pages from the 10 available (100 images each).
  const pages = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1)
    .sort(() => Math.random() - 0.5)
    .slice(0, FETCH_PAGES);

  for (let i = 0; i < pages.length; i += 1) {
    const params = new URLSearchParams({ page: String(pages[i]), limit: String(LIMIT) });
    const response = await fetch(`${ENDPOINT}?${params}`);

    if (!response.ok) {
      return Promise.reject();
    }

    /** @type {FetchResult[]} */
    const pageResults = await response.json();

    results.push(...pageResults);
  }

  // Randomize the results for variety, as the API returns them in the same order for the same page.
  return parseResults(results.sort(() => Math.random() - 0.5));
};

/**
 * @type {MediaLibraryService}
 */
export default {
  serviceType: 'stock_assets',
  serviceId: 'picsum',
  serviceLabel: 'Lorem Picsum',
  serviceURL: 'https://picsum.photos/',
  showServiceLink: true,
  hotlinking: true,
  authType: 'none',
  list,
};
