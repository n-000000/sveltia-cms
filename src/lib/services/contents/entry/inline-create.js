import { saveChanges } from '$lib/services/backends/save';
import { slugify } from '$lib/services/common/slug';
import { getCollection } from '$lib/services/contents/collection';
import { createEntryPath } from '$lib/services/contents/draft/save/entry-path';
import { formatEntryFile } from '$lib/services/contents/file/format';

/**
 * Create a new entry in the given collection directly (no entryDraft involved).
 * Used by InlineCreateDialog to commit referenced entries without leaving the article form.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Target collection name (e.g. 'events', 'authors').
 * @param {Record<string, any>} args.fieldValues Field key→value pairs to write.
 * @param {string} args.valueField The field whose value becomes the relation's stored value.
 * @returns {Promise<string>} The value of `fieldValues[valueField]`, for auto-selection.
 */
export const createInlineEntry = async ({ collectionName, fieldValues, valueField }) => {
  const collection = getCollection(collectionName);

  if (!collection || collection._type !== 'entry') {
    throw new Error(`inline_create: "${collectionName}" is not a folder collection`);
  }

  const {
    _file,
    _i18n: { defaultLocale },
    identifier_field: identifierField = 'title',
  } = /** @type {import('$lib/types/private').InternalEntryCollection} */ (collection);

  const identifierValue = String(fieldValues[identifierField] ?? '');
  const slug = slugify(identifierValue, { fallback: true });

  // Minimal draft-like object — only the properties createEntryPath actually reads
  const fakeDraft = {
    collection,
    collectionFile: undefined,
    originalEntry: undefined,
    currentValues: { [defaultLocale]: fieldValues },
    isIndexFile: false,
  };

  const path = createEntryPath({ draft: fakeDraft, locale: defaultLocale, slug });

  // Derive Entry.subPath: segment between basePath/ and .extension
  const { basePath = '', extension } = _file;
  const subPath = basePath
    ? path.slice(basePath.length + 1, -(extension.length + 1))
    : path.slice(0, -(extension.length + 1));

  const data = await formatEntryFile({ content: { ...fieldValues }, _file });

  /** @type {import('$lib/types/private').FileChange} */
  const fileChange = { action: 'create', path, slug, data };

  /** @type {import('$lib/types/private').Entry} */
  const entry = {
    id: path,
    slug,
    subPath,
    locales: { [defaultLocale]: { slug, path, content: fieldValues } },
  };

  await saveChanges({
    changes: [fileChange],
    savingEntries: [entry],
    savingAssets: [],
    options: { commitType: 'create', collection },
  });

  return String(fieldValues[valueField] ?? '');
};
