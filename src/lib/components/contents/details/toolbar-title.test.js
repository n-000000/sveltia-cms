import { describe, expect, test } from 'vitest';

import { getEntrySummaryFromContent } from '$lib/services/contents/entry/summary';

// B2’s breadcrumb reads the live draft title the same way the entry list does — from content, not
// `originalEntry` — so it updates as the user types. This test pins that contract.
describe('live title from draft content', () => {
  test('uses the identifier field value as typed', () => {
    expect(
      getEntrySummaryFromContent({ title: 'Draft Name' }, { identifierField: 'title' }),
    ).toBe('Draft Name');
  });

  test('empty title yields empty string (breadcrumb shows placeholder)', () => {
    expect(
      getEntrySummaryFromContent({ title: '' }, { identifierField: 'title', useBody: false }),
    ).toBe('');
  });

  test('falls back to a custom identifier field', () => {
    expect(
      getEntrySummaryFromContent(
        { name: 'Custom Field Name' },
        { identifierField: 'name', useBody: false },
      ),
    ).toBe('Custom Field Name');
  });
});
