import { getCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';

/**
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * A single visibility condition on a field. Either a **sibling-value** condition (P8) that matches
 * when a sibling field holds `value`, or a **roster-count** condition (P8b) that matches when at
 * least `min` entries of another collection hold a given role.
 * @typedef {object} FieldCondition
 * @property {string} [field] Sibling-value: name of a sibling field (same nesting level) to test.
 * @property {any} [value] Sibling-value: value (or array of accepted values) the sibling must hold.
 * @property {string} [role_count] Roster-count: the role value to tally across the roster. Its
 * presence selects the roster-count branch, where `field` names the roster’s roles field instead.
 * @property {string} [collection] Roster-count: roster collection name to read.
 * @property {number} [min] Roster-count: minimum matching entries required to show. Defaults to 1.
 */

/**
 * Count entries in `collection` whose multiple-select `field` includes `role`. Reads the roster
 * from the entry store (not reactive to live edits, which is fine — a git-backed roster only
 * changes between sessions).
 * @param {object} args Arguments.
 * @param {string} [args.collection] Roster collection name.
 * @param {string} args.field Multiple-select field holding the roles.
 * @param {string} args.role Role value to tally.
 * @returns {number} Number of matching entries.
 */
const countRoleHolders = ({ collection, field, role }) => {
  const locale = collection ? getCollection(collection)?._i18n?.defaultLocale : undefined;

  if (!collection || !locale) {
    return 0;
  }

  const prefix = `${field}.`;

  return getEntriesByCollection(collection).filter((entry) => {
    const content = entry.locales?.[locale]?.content ?? {};

    // Multiple-select values are flattened as `field.0`, `field.1`, …; tolerate a scalar or array
    // too, so a single-value or unflattened roster still counts.
    return Object.entries(content)
      .filter(([key]) => key === field || key.startsWith(prefix))
      .flatMap(([, value]) => (Array.isArray(value) ? value : [value]))
      .includes(role);
  }).length;
};

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
 * Determine whether a field should be shown, given an optional `condition` on its config. A field
 * with no `condition` is always visible. A `condition` is a single {@link FieldCondition} or a list
 * of them (all must match — logical AND). Each condition is either **sibling-value** (matches a
 * sibling at the same nesting level; an unset sibling reads as `undefined` and only matches a
 * `value` that explicitly includes `undefined`) or **roster-count** (matches when at least `min`
 * roster entries hold the `role_count` role).
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

  return conditions.every((cond) => {
    // Roster-count condition (P8b): show when enough roster entries hold the role.
    if (cond.role_count !== undefined) {
      const count = countRoleHolders({
        collection: cond.collection,
        field: cond.field ?? 'roles',
        role: cond.role_count,
      });

      return count >= (cond.min ?? 1);
    }

    // Sibling-value condition (P8).
    const actual = valueMap[siblingKeyPath(keyPath, cond.field)];
    const accepted = Array.isArray(cond.value) ? cond.value : [cond.value];

    return accepted.includes(actual);
  });
};
