import { describe, expect, test } from 'vitest';

import { getLocalizedEntrySummary } from '$lib/services/contents/entry/summary';

// B2’s breadcrumb reads the live draft title from per-locale draft content (not `originalEntry`), so
// it updates as the user types. It reflects the locale being edited, falling back across locales so a
// title typed in any single locale still shows. These tests pin that selection contract.
describe('localized live title from draft content', () => {
  const en = { title: 'Hello' };
  const fr = { title: 'Bonjour' };

  test('prefers the current (being-edited) locale over the default', () => {
    expect(
      getLocalizedEntrySummary({ en, fr }, { localePriority: ['fr', 'en'], identifierField: 'title' }),
    ).toBe('Bonjour');
  });

  test('falls back to the default locale when the current locale has no title', () => {
    expect(
      getLocalizedEntrySummary(
        { en, fr: {} },
        { localePriority: ['fr', 'en'], identifierField: 'title' },
      ),
    ).toBe('Hello');
  });

  test('falls back to any locale with a title when the priority locales are empty', () => {
    // The reported bug: a title typed only in a non-default, non-priority locale still shows.
    expect(
      getLocalizedEntrySummary(
        { en: {}, fr },
        { localePriority: [undefined, 'en'], identifierField: 'title' },
      ),
    ).toBe('Bonjour');
  });

  test('empty everywhere yields an empty string (breadcrumb shows no title segment)', () => {
    expect(
      getLocalizedEntrySummary(
        { en: {}, fr: {} },
        { localePriority: ['fr', 'en'], identifierField: 'title' },
      ),
    ).toBe('');
  });

  test('honors a custom identifier field', () => {
    expect(
      getLocalizedEntrySummary(
        { en: { name: 'Custom' } },
        { localePriority: ['en'], identifierField: 'name' },
      ),
    ).toBe('Custom');
  });
});
