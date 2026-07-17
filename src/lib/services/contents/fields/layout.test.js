import { describe, expect, test } from 'vitest';

import { parseFieldWidth } from './layout';

describe('parseFieldWidth', () => {
  test('valid fractions → exact calc()', () => {
    expect(parseFieldWidth('1/2')).toBe('calc(100% * 1 / 2)');
    expect(parseFieldWidth('1/3')).toBe('calc(100% * 1 / 3)');
    expect(parseFieldWidth('2/3')).toBe('calc(100% * 2 / 3)');
    expect(parseFieldWidth('3/4')).toBe('calc(100% * 3 / 4)');
    expect(parseFieldWidth(' 1/2 ')).toBe('calc(100% * 1 / 2)');
  });

  test('absent / malformed / out-of-range → undefined (⇒ full width)', () => {
    expect(parseFieldWidth(undefined)).toBeUndefined();
    expect(parseFieldWidth('')).toBeUndefined();
    expect(parseFieldWidth('half')).toBeUndefined();
    expect(parseFieldWidth('x/2')).toBeUndefined();
    expect(parseFieldWidth('1/0')).toBeUndefined();
    expect(parseFieldWidth('3/2')).toBeUndefined();
    expect(parseFieldWidth(0.5)).toBeUndefined();
  });
});
