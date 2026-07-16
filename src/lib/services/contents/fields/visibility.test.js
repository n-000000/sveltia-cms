import { describe, expect, test } from 'vitest';

import { isFieldVisible, siblingKeyPath } from './visibility';

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
