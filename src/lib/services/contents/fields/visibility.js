/**
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * A single visibility condition on a field. Matches when the referenced sibling field’s current
 * value equals `value` — or, when `value` is an array, is included in it.
 * @typedef {object} FieldCondition
 * @property {string} field Name of a sibling field (same nesting level) to test.
 * @property {any} value Value (or array of accepted values) the sibling must hold.
 */

/**
 * Resolve the key path of a sibling field at the same nesting level as `keyPath`. For a top-level
 * field the sibling is just its name; for a nested field (`a.b.c`) it swaps the last segment
 * (`a.b.<siblingName>`).
 * @param {FieldKeyPath} keyPath Current field key path.
 * @param {string} siblingName Sibling field name.
 * @returns {string} Sibling key path.
 */
export const siblingKeyPath = (keyPath, siblingName) => {
  const dot = keyPath.lastIndexOf('.');

  return dot === -1 ? siblingName : `${keyPath.slice(0, dot + 1)}${siblingName}`;
};

/**
 * Determine whether a field should be shown, given an optional `condition` on its config and the
 * current sibling values. A field with no `condition` is always visible. A `condition` is a single
 * {@link FieldCondition} or a list of them (all must match — logical AND). References resolve to
 * siblings at the same nesting level; a referenced field that isn’t set reads as `undefined` and
 * only matches a condition whose `value` explicitly includes `undefined`.
 * @param {object} args Arguments.
 * @param {any} args.fieldConfig Field configuration; may carry a `condition`.
 * @param {Record<string, any>} args.valueMap Flattened current values for the locale.
 * @param {FieldKeyPath} args.keyPath This field’s key path.
 * @returns {boolean} Whether the field is visible.
 */
export const isFieldVisible = ({ fieldConfig, valueMap, keyPath }) => {
  const { condition } = fieldConfig ?? {};

  if (!condition) {
    return true;
  }

  const conditions = Array.isArray(condition) ? condition : [condition];

  return conditions.every(({ field, value }) => {
    const actual = valueMap[siblingKeyPath(keyPath, field)];
    const accepted = Array.isArray(value) ? value : [value];

    return accepted.includes(actual);
  });
};
