import { describe, expect, test } from 'vitest';
import { isComboField, comboPlaceholder } from './field-header';

describe('isComboField', () => {
  test('relation is always a combo', () => {
    expect(isComboField({ widget: 'relation' }, 0)).toBe(true);
  });
  test('single select above dropdown_threshold is a combo', () => {
    expect(isComboField({ widget: 'select' }, 6)).toBe(true); // default threshold 5
  });
  test('single select at/below threshold is NOT a combo (renders as radios)', () => {
    expect(isComboField({ widget: 'select' }, 5)).toBe(false);
  });
  test('respects explicit dropdown_threshold', () => {
    expect(isComboField({ widget: 'select', dropdown_threshold: 10 }, 6)).toBe(false);
  });
  test('multiple select is NOT a combo (renders as checkboxes)', () => {
    expect(isComboField({ widget: 'select', multiple: true }, 99)).toBe(false);
  });
  test('non-select/relation widgets are never combos', () => {
    expect(isComboField({ widget: 'string' }, 99)).toBe(false);
  });
});

describe('comboPlaceholder', () => {
  test('appends a single ellipsis', () => {
    expect(comboPlaceholder('Category')).toBe('Category…');
  });
});
