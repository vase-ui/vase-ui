import { computed, onMounted, onScopeDispose, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue';
import { getCombinedFieldValidityData } from '../field-root-context/getCombinedFieldValidityData';
import type {
  FieldControlRegistration,
  FieldRootContext,
  FieldValidityData,
} from '../field-root-context/FieldRootContext';
import { useFormContext } from '../form-context/FormContext';
import { createIdRegistry } from '../labelable-provider/createIdRegistry';

export type { FieldControlRegistration } from '../field-root-context/FieldRootContext';

/**
 * A field root calls it in `setup`. It keeps the controls of the field and gives the field to the
 * form.
 */
export function useFieldControlRegistration(
  params: UseFieldControlRegistrationParameters,
): UseFieldControlRegistrationReturnValue {
  const { change, commit, invalid, markedDirtyRef, name, setValidityData, validityData } = params;

  const { registerField } = useFormContext();

  const { ids: controls, registerId: registerControl } = createIdRegistry<{
    source: symbol;
    registration: FieldControlRegistration;
  }>();
  // The active control is the last control of the registry that gives a registration. When it goes
  // away, the field uses the control before it.
  const activeControl = computed(() => controls.value.at(-1));
  const getActiveSource = () => activeControl.value?.source;

  const registerFieldControl: FieldRootContext['registerFieldControl'] = (
    source,
    getRegistration,
  ) => {
    // A control that registers again goes to the end. The registry then has the order in which the
    // controls registered or changed.
    registerControl(source, undefined);
    if (getRegistration) {
      registerControl(source, () => {
        const registration = getRegistration();
        return registration && { source, registration };
      });
    }
  };

  const registeredFieldName = computed(() =>
    toValue(name) ? undefined : activeControl.value?.registration.name,
  );

  function getValueForForm() {
    const registration = activeControl.value?.registration;
    if (!registration) {
      return undefined;
    }

    if (registration.getValue) {
      return registration.getValue();
    }

    return registration.value;
  }

  function getRegistrationValue(registration: FieldControlRegistration) {
    return registration.value === undefined ? getValueForForm() : registration.value;
  }

  function validate() {
    const registration = activeControl.value?.registration;
    markedDirtyRef.value = true;
    commit(registration ? getRegistrationValue(registration) : validityData.value.value);
  }

  // The baseline belongs to the field, not to a control instance: a control that unmounts and
  // remounts (or is swapped for another one) comes back as a brand new registration. Capturing
  // more than once would turn whichever value the control happens to hold at that point into the
  // initial value, so a modified field would read pristine and its real initial value would read
  // dirty. Consumers that want a fresh baseline remount or key `<Field.Root>` itself.
  let initialValueCaptured = false;
  function captureInitialValue() {
    const registration = activeControl.value?.registration;
    if (initialValueCaptured || !registration) {
      return;
    }

    initialValueCaptured = true;
    const initialValue = getRegistrationValue(registration);

    if (validityData.value.initialValue !== initialValue) {
      setValidityData({ ...validityData.value, initialValue });
    }
  }

  // Drop work owned by a replaced control, but not on first registration.
  watch(getActiveSource, (_source, previousSource) => {
    if (previousSource !== undefined) {
      change(undefined, true);
    }
  });

  watch(getActiveSource, captureInitialValue, { flush: 'post' });

  const fieldSource = Symbol();

  // The registration waits for the mount, as the registration of a control does. The key of the
  // entry is the source, and not the `id` of the control. A change of the `id` or of the control
  // then keeps the place of the field in the form.
  onMounted(() => {
    registerField(fieldSource, () => {
      const registration = activeControl.value?.registration;
      if (!registration?.id) {
        return undefined;
      }

      return {
        name: toValue(name) ?? registration.name,
        validate,
        validityData: getCombinedFieldValidityData(validityData.value, toValue(invalid)),
        controlRef: registration.controlRef,
        getValue: getValueForForm,
      };
    });
  });

  onScopeDispose(() => registerField(fieldSource, undefined));

  return { validate, registerFieldControl, registeredFieldName };
}

export interface UseFieldControlRegistrationParameters {
  change: (value: unknown, cancelPending?: boolean) => void;
  commit: (value: unknown) => void;
  invalid: MaybeRefOrGetter<boolean | undefined>;
  markedDirtyRef: Ref<boolean>;
  name: MaybeRefOrGetter<string | undefined>;
  setValidityData: (validityData: FieldValidityData) => void;
  validityData: Readonly<Ref<FieldValidityData>>;
}

export interface UseFieldControlRegistrationReturnValue {
  validate: () => void;
  registerFieldControl: FieldRootContext['registerFieldControl'];
  registeredFieldName: ComputedRef<string | undefined>;
}
