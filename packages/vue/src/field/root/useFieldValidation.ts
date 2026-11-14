import { shallowRef, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import { useTimeout } from '../../common/useTimeout';
import { DEFAULT_VALIDITY_STATE } from '../../internals/field-constants/constants';
import type {
  FieldRootState,
  FieldValidityData,
  RegisteredInput,
  RegisteredInputs,
  UseFieldValidationReturnValue,
} from '../../internals/field-root-context/FieldRootContext';
import { useFormContext } from '../../internals/form-context/FormContext';
import type { FormValidationMode } from '../../internals/form-context/FormContext';
import type { LabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { mergeProps } from '../../merge-props';

export type { RegisteredInput, RegisteredInputs, UseFieldValidationReturnValue };

const validityKeys = Object.keys(DEFAULT_VALIDITY_STATE) as Array<keyof ValidityState>;

type ValidateResult = string | string[] | null | void;

/**
 * Whether an input participates in the surrounding form. Inputs that are effectively
 * disabled, or whose `form` attribute explicitly associates them with another form, are excluded.
 * DOM position only matters when it associates the input with a different form. Otherwise, field
 * registration is context-driven, so portaled inputs (for example inside a dialog) still belong to
 * the form for both validation and values projected into `onFormSubmit`.
 */
export function isEligibleInput(input: HTMLInputElement, formElement: HTMLFormElement | null) {
  if (input.matches(':disabled')) {
    return false;
  }

  if (!formElement || input.form === formElement) {
    return true;
  }

  // Context crosses portal boundaries. An unassociated portaled input still participates in
  // contextual validation, unless an explicit `form` attribute opts it out of the surrounding form.
  return input.form === null && !input.hasAttribute('form');
}

/**
 * Picks the input whose native validity should represent a field that owns several inputs (such as a
 * checkbox or radio group). Prefers the first eligible currently-invalid input, where "first" follows
 * registration order (mount order), and otherwise returns the first eligible input.
 */
function findRepresentativeInput(
  inputs: RegisteredInputs,
  formElement: HTMLFormElement | null,
): HTMLInputElement | null {
  let fallback: HTMLInputElement | null = null;
  for (const input of inputs.keys()) {
    if (!isEligibleInput(input, formElement)) {
      continue;
    }
    if (!input.validity.valid) {
      return input;
    }
    fallback ??= input;
  }
  return fallback;
}

function makeState(customError: boolean): Record<keyof ValidityState, boolean> {
  return { ...DEFAULT_VALIDITY_STATE, valid: !customError, customError };
}

function getNativeErrors(element: HTMLInputElement | null): string[] {
  return element && element.validationMessage ? [element.validationMessage] : [];
}

export function useFieldValidation(
  params: UseFieldValidationParameters,
): UseFieldValidationReturnValue {
  const { elementRef: formElementRef, fields } = useFormContext();

  const {
    setValidityData,
    validate,
    validityData,
    validationDebounceTime,
    markedDirtyRef,
    state,
    shouldValidateOnChange,
    validationMode,
    getDescriptionProps,
  } = params;

  const timeout = useTimeout();
  const inputRef = shallowRef<HTMLInputElement | null>(null);
  const registeredInputs = new Map<HTMLInputElement, RegisteredInput>();
  let validationCommitId = 0;
  // Tracks the message installed by Vase UI and the custom message it displaced.
  let customValidity: [element: HTMLInputElement, message: string, displaced: string] | null = null;

  // The validity of the last render. A handler of a control clears the error of the form and then
  // calls `change`. Base UI reads the state of the last render there, in which the field is still
  // invalid. A read of `state` at that moment gives the value after the clear.
  let renderedValid = state.value.valid;
  watch(
    () => state.value.valid,
    (valid) => {
      renderedValid = valid;
    },
  );

  // Groups register several inputs against a single field so focus, validation, and form-value
  // projection can use the same live controls. This also ensures a `required` checkbox can't be
  // satisfied by another input in the group, matching native per-checkbox behavior.
  function registerInput(element: HTMLInputElement, registration: RegisteredInput) {
    registeredInputs.set(element, registration);
    return () => {
      registeredInputs.delete(element);
    };
  }

  function getInputControl() {
    const element = findRepresentativeInput(registeredInputs, formElementRef.value);
    return (element && toValue(registeredInputs.get(element)?.controlRef)) || null;
  }

  function setCustomValidity(element: HTMLInputElement, message: string) {
    // Never reinstall a native constraint message as custom validity.
    const displaced = element.validity.customError ? element.validationMessage : '';
    const ownedMessage = message.replace(/\r\n?/g, '\n');
    element.setCustomValidity(ownedMessage);
    customValidity = [element, ownedMessage, displaced];
  }

  function clearCustomValidity() {
    const record = customValidity;
    customValidity = null;
    // Replacement transfers ownership; barred controls hide `validationMessage`.
    if (record && (!record[0].willValidate || record[0].validationMessage === record[1])) {
      record[0].setCustomValidity(record[2]);
    }
  }

  async function commit(value: unknown, countValueMissing = false, revalidate = false) {
    validationCommitId += 1;
    const commitId = validationCommitId;

    function makeValidityData(
      validityState: FieldValidityData['state'],
      errorMessages: string[],
    ): FieldValidityData {
      // `valueMissing` may be suppressed while the native message remains non-empty.
      const errors = validityState.valid === false ? errorMessages : [];
      return {
        value,
        state: validityState,
        error: errors[0] ?? '',
        errors,
        initialValue: validityData.value.initialValue,
      };
    }

    function publish(validityState: FieldValidityData['state'], errorMessages: string[]) {
      setValidityData(makeValidityData(validityState, errorMessages));
    }

    function getState(el: HTMLInputElement) {
      const computedState = validityKeys.reduce(
        (acc, key) => {
          acc[key] = el.validity[key];
          return acc;
        },
        {} as Record<keyof ValidityState, boolean>,
      );

      let hasOnlyValueMissingError = false;

      for (const key of validityKeys) {
        if (key === 'valid') {
          continue;
        }
        if (key === 'valueMissing' && computedState[key]) {
          hasOnlyValueMissingError = true;
        } else if (computedState[key]) {
          return computedState;
        }
      }

      // Only make `valueMissing` mark the field invalid if it's been changed
      // to reduce error noise. A control that has no text to type has no such change, so it asks
      // for the error with `countValueMissing`.
      if (hasOnlyValueMissingError && !markedDirtyRef.value && !countValueMissing) {
        computedState.valid = true;
        computedState.valueMissing = false;
      }
      return computedState;
    }

    // A field can own several inputs (such as a checkbox or radio group), but only the last-mounted
    // one wins the shared `inputRef`. Validate against the registry instead so every input counts;
    // `inputRef` is the fallback only when no inputs are registered.
    function resolveRepresentativeInput() {
      return registeredInputs.size > 0
        ? findRepresentativeInput(registeredInputs, formElementRef.value)
        : inputRef.value;
    }

    // A field with no eligible input has no native constraint, but its custom validator still
    // applies to the logical value at the configured validation boundary.
    let element = resolveRepresentativeInput();

    function refreshState() {
      element = resolveRepresentativeInput();
      // Barred controls expose no usable native constraint state.
      return element?.willValidate ? getState(element) : makeState(false);
    }

    if (revalidate) {
      if (renderedValid !== false || !element) {
        return;
      }

      if (!element.validity.valueMissing) {
        // The 'valueMissing' (required) condition has been resolved by the user typing.
        // Temporarily mark the field as valid for this onChange event.
        // Other native errors (e.g., typeMismatch) will be caught by full validation on blur or submit.
        // The required value is now present; ignore stale external invalid state for this pass.
        clearCustomValidity();
        // Clearing can make another registered input with a custom error representative.
        const currentElement = resolveRepresentativeInput();
        const foreign = currentElement?.validity.customError ? getNativeErrors(currentElement) : [];
        publish(makeState(foreign.length > 0), foreign);
        return;
      }

      // A stale custom error can coexist with valueMissing, but defer any other native errors.
      for (const key of validityKeys) {
        if (
          key !== 'valid' &&
          key !== 'valueMissing' &&
          key !== 'customError' &&
          element.validity[key]
        ) {
          return;
        }
      }

      // Value is still missing: publish the current native state so valueMissing and the changed
      // value are observable immediately. Full custom validation still waits for its boundary.
    }

    timeout.clear();

    // Do not read the previous message of Vase UI back as a native constraint.
    clearCustomValidity();

    let nextState: FieldValidityData['state'] = refreshState();
    let validationErrors = getNativeErrors(element);

    const isValidatingOnChange = shouldValidateOnChange();

    // Native or externally set errors take precedence outside onChange validation.
    if (validationErrors.length === 0 || isValidatingOnChange) {
      // call the validate function because either
      // - validating on change, or
      // - native constraint validations passed, custom validity check is next
      const formValues: Record<string, unknown> = {};
      for (const field of fields.value) {
        if (field.name) {
          formValues[field.name] = field.getValue();
        }
      }

      const resultOrPromise = validate(value, formValues);
      let result: ValidateResult;

      if (
        typeof resultOrPromise === 'object' &&
        resultOrPromise !== null &&
        'then' in resultOrPromise
      ) {
        // Validity is unknown while the validator runs, so go neutral, but keep what must block
        // submission synchronously: native failures, and a previous custom error outside onSubmit
        // mode. A previous native error is never kept, since `nextState` already carries the fresh
        // native verdict.
        if (nextState.valid === false) {
          publish(nextState, validationErrors);
        } else if (validationMode.value === 'onSubmit' || !validityData.value.state.customError) {
          nextState.valid = null;
          publish(nextState, validationErrors);
        }

        // A rejected validator keeps the previously published state, so a transient
        // failure can't retire an error and unblock submission.
        result = await resultOrPromise;

        if (commitId !== validationCommitId) {
          return;
        }
        nextState = refreshState();
      } else {
        result = resultOrPromise;
      }

      // Empty results and empty array entries are valid.
      validationErrors = result ? ([] as string[]).concat(result).filter(Boolean) : [];

      if (validationErrors.length > 0) {
        nextState.valid = false;
        nextState.customError = true;
        // Keep custom errors for barred controls in field state only.
        if (element?.willValidate) {
          setCustomValidity(element, validationErrors.join('\n'));
        }
      } else {
        validationErrors = getNativeErrors(element);
      }
    }

    publish(nextState, validationErrors);
  }

  function change(value: unknown, cancelPending = false) {
    timeout.clear();
    validationCommitId += 1;
    if (cancelPending) {
      return;
    }

    const validateOnChange = shouldValidateOnChange();
    const debounceTime = toValue(validationDebounceTime);

    if (validateOnChange && value !== '' && debounceTime) {
      timeout.start(debounceTime, () => {
        commit(value);
      });
    } else {
      commit(value, false, !validateOnChange);
    }
  }

  // A cancel in `change` keeps the message on the input, because the field still shows its error.
  // A reset removes the error of the field, so it removes the message too.
  function reset() {
    timeout.clear();
    validationCommitId += 1;
    clearCustomValidity();
  }

  // The control calls it in each render, so it reads the current state and not `renderedValid`.
  function getValidationProps(disabled: boolean, externalProps: Record<string, any> = {}) {
    return mergeProps<any>(
      getDescriptionProps(externalProps),
      state.value.valid === false && !state.value.disabled && !disabled
        ? { 'aria-invalid': true }
        : EMPTY_OBJECT,
    );
  }

  return {
    getValidationProps,
    inputRef,
    registeredInputs,
    registerInput,
    getInputControl,
    commit,
    change,
    reset,
  };
}

export interface UseFieldValidationParameters {
  setValidityData: (data: FieldValidityData) => void;
  validate: (
    value: unknown,
    formValues: Record<string, any>,
  ) => ValidateResult | Promise<ValidateResult>;
  validityData: Readonly<Ref<FieldValidityData>>;
  validationDebounceTime: MaybeRefOrGetter<number>;
  markedDirtyRef: Ref<boolean>;
  state: ComputedRef<FieldRootState>;
  shouldValidateOnChange: () => boolean;
  validationMode: ComputedRef<FormValidationMode>;
  getDescriptionProps: LabelableContext['getDescriptionProps'];
}
