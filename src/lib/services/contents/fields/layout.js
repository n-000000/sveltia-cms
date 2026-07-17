/**
 * Map a field’s `width` config to a CSS `flex-basis` value. Accepts a fraction string `"a/b"` with
 * integer `0 < a ≤ b` (e.g. `1/2`, `1/3`, `2/3`). Returns an exact `calc()` (so thirds don’t round),
 * or `undefined` when absent/malformed/out-of-range — the caller then leaves the field full width.
 * @param {any} width Raw `width` from field config.
 * @returns {string | undefined} A CSS length for `flex-basis`, or `undefined` for full width.
 */
export const parseFieldWidth = (width) => {
  if (typeof width !== 'string') {
    return undefined;
  }

  const match = width.trim().match(/^(\d+)\/(\d+)$/);

  if (!match) {
    return undefined;
  }

  const a = Number(match[1]);
  const b = Number(match[2]);

  if (!b || a <= 0 || a > b) {
    return undefined;
  }

  return `calc(100% * ${a} / ${b})`;
};
