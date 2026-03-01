import { isFieldRequired } from '$lib/services/contents/entry/fields';

/**
 * @import { EntryValidityState, ValidateFieldFuncArgs } from '$lib/types/private';
 * @import { NumberField } from '$lib/types/public';
 */

/**
 * Validate a Number field value against the field configuration.
 * @param {ValidateFieldFuncArgs} args Arguments.
 * @returns {{ validity: EntryValidityState }} Result.
 */
export const validateNumberField = ({ fieldConfig, locale, value }) => {
  const config = /** @type {NumberField} */ (fieldConfig);
  const { value_type: valueType = 'int', min, max } = config;
  const rangeUnderflow = typeof min === 'number' && value !== null && Number(value) < min;

  const rangeOverflow =
    !rangeUnderflow && typeof max === 'number' && value !== null && Number(value) > max;

  const typeMismatch =
    (valueType === 'int' || valueType === 'float') &&
    isFieldRequired({ fieldConfig, locale }) &&
    value === null;

  return {
    validity: { rangeUnderflow, rangeOverflow, typeMismatch },
  };
};
