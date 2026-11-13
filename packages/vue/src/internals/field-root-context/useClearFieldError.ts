import { toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { DEFAULT_VALIDITY_STATE } from '../field-constants';
import { useFormContext } from '../form-context';
import { useFieldRootContext } from './FieldRootContext';

/**
 * Returns a function that removes the error of the field after a native reset of its form. Call
 * `useClearFieldError` in `setup`. With no field and no form, the function does nothing.
 * @param name The name of the field in the errors of the form.
 * @returns A function that takes the value of the control after the reset. The validity data of the
 * field gets it as `value`.
 */
export function useClearFieldError(
  name: MaybeRefOrGetter<string | undefined>,
): (value: unknown) => void {
  const { validation, validityData, setValidityData } = useFieldRootContext();
  const { clearErrors } = useFormContext();

  function clearFieldError(value: unknown) {
    // After the reset the error of the field is out of date: the validation that is pending,
    // the message on the input and the error of the form must go.
    validation.reset();
    setValidityData({
      ...validityData.value,
      state: DEFAULT_VALIDITY_STATE,
      error: '',
      errors: [],
      value,
    });
    clearErrors(toValue(name));
  }

  return clearFieldError;
}
