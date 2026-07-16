import { beforeEach, describe, expect, test, vi } from 'vitest';

import { isFieldVisible, siblingKeyPath, soleRoleHolder } from './visibility';

const { getCollection, getEntriesByCollection } = vi.hoisted(() => ({
  getCollection: vi.fn(),
  getEntriesByCollection: vi.fn(),
}));

vi.mock('$lib/services/contents/collection', () => ({ getCollection }));
vi.mock('$lib/services/contents/collection/entries', () => ({ getEntriesByCollection }));

/**
 * Build a roster entry whose multiple-select `roles` field holds the given roles (flattened as
 * `roles.0`, `roles.1`, …), matching how the CMS stores list values.
 * @param {string[]} roles Roles the entry holds.
 * @param {object} [opts] Options.
 * @param {string} [opts.slug] Entry slug.
 * @param {Record<string, any>} [opts.content] Extra flattened content fields.
 * @returns {any} Minimal entry shape.
 */
const rosterEntry = (roles, { slug, content = {} } = {}) => ({
  slug,
  locales: {
    _default: {
      content: { ...Object.fromEntries(roles.map((role, i) => [`roles.${i}`, role])), ...content },
    },
  },
});

describe('siblingKeyPath()', () => {
  test('top-level field → sibling name', () => {
    expect(siblingKeyPath('youtube_url', 'has_video')).toBe('has_video');
  });

  test('nested field → swaps last segment', () => {
    expect(siblingKeyPath('a.b.youtube_url', 'has_video')).toBe('a.b.has_video');
  });

  test('list item field → swaps last segment', () => {
    expect(siblingKeyPath('items.0.url', 'kind')).toBe('items.0.kind');
  });
});

describe('isFieldVisible()', () => {
  test('no condition → always visible', () => {
    expect(isFieldVisible({ fieldConfig: {}, valueMap: {}, keyPath: 'x' })).toBe(true);
  });

  test('single condition met (scalar value)', () => {
    expect(
      isFieldVisible({
        fieldConfig: { condition: { field: 'has_video', value: true } },
        valueMap: { has_video: true },
        keyPath: 'youtube_url',
      }),
    ).toBe(true);
  });

  test('single condition unmet → hidden', () => {
    expect(
      isFieldVisible({
        fieldConfig: { condition: { field: 'has_video', value: true } },
        valueMap: { has_video: false },
        keyPath: 'youtube_url',
      }),
    ).toBe(false);
  });

  test('unset sibling reads as undefined → hidden', () => {
    expect(
      isFieldVisible({
        fieldConfig: { condition: { field: 'has_video', value: true } },
        valueMap: {},
        keyPath: 'youtube_url',
      }),
    ).toBe(false);
  });

  test('array value → matches any', () => {
    const fieldConfig = { condition: { field: 'kind', value: ['video', 'reel'] } };

    expect(isFieldVisible({ fieldConfig, valueMap: { kind: 'reel' }, keyPath: 'url' })).toBe(true);
    expect(isFieldVisible({ fieldConfig, valueMap: { kind: 'photo' }, keyPath: 'url' })).toBe(false);
  });

  test('list of conditions → ANDed', () => {
    const fieldConfig = {
      condition: [
        { field: 'type', value: 'article' },
        { field: 'has_video', value: true },
      ],
    };

    expect(
      isFieldVisible({ fieldConfig, valueMap: { type: 'article', has_video: true }, keyPath: 'u' }),
    ).toBe(true);
    expect(
      isFieldVisible({ fieldConfig, valueMap: { type: 'article', has_video: false }, keyPath: 'u' }),
    ).toBe(false);
  });

  test('nested field resolves sibling at same level', () => {
    expect(
      isFieldVisible({
        fieldConfig: { condition: { field: 'has_video', value: true } },
        valueMap: { 'block.0.has_video': true },
        keyPath: 'block.0.youtube_url',
      }),
    ).toBe(true);
  });
});

describe('isFieldVisible() — roster-count condition (P8b)', () => {
  beforeEach(() => {
    getEntriesByCollection.mockReset();
    getCollection.mockReturnValue({ _i18n: { defaultLocale: '_default' } });
  });

  /**
   * Evaluate a roster-count field config against an empty value map.
   * @param {any} fieldConfig Field configuration carrying the condition.
   * @returns {boolean} Whether the field is visible.
   */
  const visible = (fieldConfig) => isFieldVisible({ fieldConfig, valueMap: {}, keyPath: 'credit' });

  test('shows when role holders meet the minimum', () => {
    getEntriesByCollection.mockReturnValue([
      rosterEntry(['text', 'photos']),
      rosterEntry(['photos']),
      rosterEntry(['videos']),
    ]);

    expect(
      visible({ condition: { role_count: 'photos', min: 2, collection: 'cms-users' } }),
    ).toBe(true);
  });

  test('hides when below the minimum', () => {
    getEntriesByCollection.mockReturnValue([rosterEntry(['photos']), rosterEntry(['text'])]);

    expect(
      visible({ condition: { role_count: 'photos', min: 2, collection: 'cms-users' } }),
    ).toBe(false);
  });

  test('min defaults to 1', () => {
    getEntriesByCollection.mockReturnValue([rosterEntry(['videos'])]);

    expect(visible({ condition: { role_count: 'videos', collection: 'cms-users' } })).toBe(true);
    expect(visible({ condition: { role_count: 'photos', collection: 'cms-users' } })).toBe(false);
  });

  test('no role holders → hidden', () => {
    getEntriesByCollection.mockReturnValue([rosterEntry(['text'])]);

    expect(visible({ condition: { role_count: 'photos', collection: 'cms-users' } })).toBe(false);
  });

  test('missing collection → count 0 → hidden', () => {
    expect(visible({ condition: { role_count: 'photos' } })).toBe(false);
    expect(getEntriesByCollection).not.toHaveBeenCalled();
  });

  test('custom roster field name via `field`', () => {
    getEntriesByCollection.mockReturnValue([
      { locales: { _default: { content: { 'jobs.0': 'photos', 'jobs.1': 'text' } } } },
    ]);

    expect(
      visible({ condition: { role_count: 'photos', collection: 'staff', field: 'jobs' } }),
    ).toBe(true);
  });

  test('ANDed with a sibling-value condition', () => {
    getEntriesByCollection.mockReturnValue([rosterEntry(['photos']), rosterEntry(['photos'])]);

    const fieldConfig = {
      condition: [
        { field: 'has_credits', value: true },
        { role_count: 'photos', min: 2, collection: 'cms-users' },
      ],
    };

    expect(isFieldVisible({ fieldConfig, valueMap: { has_credits: true }, keyPath: 'credit' })).toBe(
      true,
    );
    expect(
      isFieldVisible({ fieldConfig, valueMap: { has_credits: false }, keyPath: 'credit' }),
    ).toBe(false);
  });
});

describe('soleRoleHolder() — implied value (P8b)', () => {
  beforeEach(() => {
    getEntriesByCollection.mockReset();
    getCollection.mockReturnValue({ _i18n: { defaultLocale: '_default' } });
  });

  test('exactly one holder → its slug', () => {
    getEntriesByCollection.mockReturnValue([
      rosterEntry(['text'], { slug: 'ana' }),
      rosterEntry(['photos'], { slug: 'ben' }),
    ]);

    expect(soleRoleHolder({ collection: 'cms-users', role: 'text' })).toBe('ana');
  });

  test('no holder → empty', () => {
    getEntriesByCollection.mockReturnValue([rosterEntry(['photos'], { slug: 'ben' })]);

    expect(soleRoleHolder({ collection: 'cms-users', role: 'text' })).toBe('');
  });

  test('more than one holder → empty (picker supplies the value)', () => {
    getEntriesByCollection.mockReturnValue([
      rosterEntry(['text'], { slug: 'ana' }),
      rosterEntry(['text'], { slug: 'cid' }),
    ]);

    expect(soleRoleHolder({ collection: 'cms-users', role: 'text' })).toBe('');
  });

  test('custom value_field reads a content field', () => {
    getEntriesByCollection.mockReturnValue([
      rosterEntry(['text'], { slug: 'ana', content: { name: 'Ana Lima' } }),
    ]);

    expect(soleRoleHolder({ collection: 'cms-users', role: 'text', valueField: 'name' })).toBe(
      'Ana Lima',
    );
  });

  test('custom roster field via `field`', () => {
    getEntriesByCollection.mockReturnValue([
      { slug: 'ana', locales: { _default: { content: { 'jobs.0': 'text' } } } },
    ]);

    expect(soleRoleHolder({ collection: 'staff', role: 'text', field: 'jobs' })).toBe('ana');
  });

  test('missing collection → empty', () => {
    expect(soleRoleHolder({ role: 'text' })).toBe('');
    expect(getEntriesByCollection).not.toHaveBeenCalled();
  });
});
