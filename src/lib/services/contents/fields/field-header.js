/**
 * Whether a field renders as a dropdown/combobox (title can fold into a placeholder). Excludes
 * radio-rendered selects (few options) and multiple-selects (checkbox group) — a placeholder is
 * meaningless there.
 * @param {Record<string, any>} fieldConfig Field config.
 * @param {number} optionCount Number of options (for the select dropdown_threshold decision).
 * @returns {boolean} True for relation or single dropdown-select.
 */
export const isComboField = (fieldConfig, optionCount) => {
  const { widget, multiple, dropdown_threshold: threshold = 5 } = fieldConfig ?? {};
  if (widget === 'relation') return true;
  if (widget === 'select' && multiple !== true) return optionCount > threshold;
  return false;
};

/**
 * The placeholder text shown in a combo whose title has been suppressed.
 * @param {string} fieldLabel Field label (already trimmed).
 * @returns {string} Label with a trailing ellipsis.
 */
export const comboPlaceholder = (fieldLabel) => `${fieldLabel}…`;
