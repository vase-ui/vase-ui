<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  FieldRootState,
  FieldValidityData,
} from '../../internals/field-root-context/FieldRootContext';
import type { FormValidationMode } from '../../internals/form-context/FormContext';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export type { FieldRootState, FieldValidityData };

export interface FieldRootActions {
  validate: () => void;
}

export interface FieldRootProps
  extends VaseUIComponentProps<FieldRootState>, /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether the component should ignore user interaction.
   * Takes precedence over the `disabled` prop on the `<Field.Control>` component.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Identifies the field when a form is submitted.
   * Takes precedence over the `name` prop on the `<Field.Control>` component.
   */
  name?: string | undefined;
  /**
   * A function for custom validation. Return a string or an array of strings with
   * the error message(s) if the value is invalid. Returning nothing, `null`, an empty
   * string, or an empty array means the value is valid.
   * Asynchronous functions are supported, but they do not prevent form submission
   * when using `validationMode="onSubmit"`.
   */
  validate?:
    | ((
        value: unknown,
        formValues: Record<string, any>,
      ) => string | string[] | null | void | Promise<string | string[] | null | void>)
    | undefined;
  /**
   * Determines when the field should be validated.
   * This takes precedence over the `validationMode` prop on `<Form>`.
   *
   * - `onSubmit`: triggers validation when the form is submitted, and re-validates on change after submission.
   * - `onBlur`: triggers validation when the control loses focus.
   * - `onChange`: triggers validation on every change to the control value.
   *
   * @default 'onSubmit'
   */
  validationMode?: FormValidationMode | undefined;
  /**
   * How long to wait between `validate` callbacks if
   * `validationMode="onChange"` is used. Specified in milliseconds.
   * @default 0
   */
  validationDebounceTime?: number | undefined;
  /**
   * Whether the field is invalid.
   * Useful when the field state is controlled by an external library.
   */
  invalid?: boolean | undefined;
  /**
   * Whether the field's value has been changed from its initial value.
   * Useful when the field state is controlled by an external library.
   */
  dirty?: boolean | undefined;
  /**
   * Whether the field has been touched.
   * Useful when the field state is controlled by an external library.
   */
  touched?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed, inject, onMounted, onScopeDispose, provide, shallowRef, watch } from 'vue';
import { useFieldsetDisabled } from '../../fieldset/root/useFieldsetDisabled';
import { createFieldFocusOwner } from '../../internals/field-root-context/useSetFieldFocused';
import { DEFAULT_VALIDITY_STATE, fieldValidityMapping } from '../../internals/field-constants';
import { createIdRegistry } from '../../internals/labelable-provider/createIdRegistry';
import {
  FieldRootContext,
  getCombinedFieldValidityData,
} from '../../internals/field-root-context/FieldRootContext';
import type { FieldControlRegistration } from '../../internals/field-root-context/FieldRootContext';
import { FormContext } from '../../internals/form-context/FormContext';
import { provideLabelableContext } from '../../internals/labelable-provider';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFieldValidation } from './useFieldValidation';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<FieldRootProps>(), {
  as: 'div',
  disabled: false,
  validationDebounceTime: 0,
  invalid: undefined,
  dirty: undefined,
  touched: undefined,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Field.Root', ['invalid']);
}

defineSlots<{
  default(props: { state: FieldRootState }): unknown;
  render: ComponentRenderFn<HTMLProps, FieldRootState>;
}>();

const form = inject(FormContext, null);
const { getDescriptionProps } = provideLabelableContext();

const fieldsetDisabled = useFieldsetDisabled(() => element.value);
const isDisabled = computed(() => fieldsetDisabled.value || props.disabled);
const resolvedValidationMode = computed(
  () => props.validationMode ?? form?.validationMode.value ?? 'onSubmit',
);

const touchedState = shallowRef(false);
const dirtyState = shallowRef(false);
const filled = shallowRef(false);
const focused = shallowRef(false);

const markedDirtyRef = shallowRef(props.dirty ?? false);
watch(
  () => props.dirty,
  (dirtyProp) => {
    if (dirtyProp !== undefined) {
      markedDirtyRef.value = dirtyProp;
    }
  },
);

function setDirty(value: boolean) {
  if (props.dirty !== undefined) {
    return;
  }

  if (value) {
    markedDirtyRef.value = true;
  }
  dirtyState.value = value;
}

function setTouched(value: boolean) {
  if (props.touched !== undefined) {
    return;
  }
  touchedState.value = value;
}

function shouldValidateOnChange() {
  return (
    resolvedValidationMode.value === 'onChange' ||
    (resolvedValidationMode.value === 'onSubmit' && (form?.submitCountRef.value ?? 0) > 0)
  );
}

const validityData = shallowRef<FieldValidityData>({
  state: DEFAULT_VALIDITY_STATE,
  error: '',
  errors: [],
  value: null,
  initialValue: null,
});

function setValidityData(next: FieldValidityData) {
  validityData.value = next;
}

const { ids: controls, registerId: registerControl } = createIdRegistry<{
  source: symbol;
  registration: FieldControlRegistration;
}>();
const activeControl = computed(() => controls.value.at(-1));
const activeSource = () => activeControl.value?.source;
const effectiveName = computed(() => props.name ?? activeControl.value?.registration.name);

const registerFieldControl: FieldRootContext['registerFieldControl'] = (
  source,
  getRegistration,
) => {
  // The last changed control takes precedence over earlier controls.
  registerControl(source, undefined);
  if (getRegistration) {
    registerControl(source, () => {
      const registration = getRegistration();
      return registration && { source, registration };
    });
  }
};

const isInvalid = computed(() => {
  const name = effectiveName.value;
  const errors = form?.errors.value;
  const formError = name && errors && Object.hasOwn(errors, name) ? errors[name] : null;
  const hasFormError = !!(Array.isArray(formError) ? formError.length : formError);
  return props.invalid === true || hasFormError;
});

// App-controlled invalidity (the `invalid` prop and `<Form>` errors) keeps the field marked
// invalid even while disabled. Only computed validity (native constraints and `validate`)
// is suppressed when disabled, matching `:disabled` not participating in constraint validation.
const valid = computed(
  () => !isInvalid.value && (isDisabled.value ? null : validityData.value.state.valid),
);

const state = computed<FieldRootState>(() => ({
  disabled: isDisabled.value,
  touched: props.touched ?? touchedState.value,
  dirty: props.dirty ?? dirtyState.value,
  valid: valid.value,
  filled: filled.value,
  focused: focused.value,
}));

const validation = useFieldValidation({
  setValidityData,
  validate: (value, formValues) => props.validate?.(value, formValues),
  validityData,
  validationDebounceTime: () => props.validationDebounceTime,
  markedDirtyRef,
  state,
  shouldValidateOnChange,
  validationMode: resolvedValidationMode,
  getDescriptionProps,
});

function getFormValue() {
  const control = activeControl.value?.registration;
  return control?.getValue ? control.getValue() : control?.value;
}

function getControlValue(control: FieldControlRegistration) {
  return control.value === undefined ? getFormValue() : control.value;
}

function validateField() {
  const control = activeControl.value?.registration;
  markedDirtyRef.value = true;
  void validation.commit(control ? getControlValue(control) : validityData.value.value);
}

watch(activeSource, (_source, previous) => {
  if (previous !== undefined) {
    validation.change(undefined, true);
  }
});

// A replacement keeps the first control's value as the baseline for dirty state.
watch(
  activeSource,
  () => {
    const control = activeControl.value?.registration;
    if (control) {
      const initialValue = getControlValue(control);
      if (validityData.value.initialValue !== initialValue) {
        setValidityData({ ...validityData.value, initialValue });
      }
    }
  },
  { flush: 'post', once: true },
);

if (form) {
  const source = Symbol();
  onMounted(() =>
    form.registerField(source, () => {
      const control = activeControl.value?.registration;
      if (!control?.id) {
        return undefined;
      }
      return {
        name: effectiveName.value,
        validate: validateField,
        validityData: getCombinedFieldValidityData(validityData.value, isInvalid.value),
        controlRef: control.controlRef,
        getValue: getFormValue,
      };
    }),
  );
  onScopeDispose(() => form.registerField(source, undefined));
}

provide(FieldRootContext, {
  invalid: isInvalid,
  name: effectiveName,
  validityData,
  setValidityData,
  disabled: isDisabled,
  setTouched,
  setDirty,
  setFilled(value) {
    filled.value = value;
  },
  setFocused(value) {
    focused.value = value;
  },
  setFocusOwner: createFieldFocusOwner(),
  validationMode: resolvedValidationMode,
  shouldValidateOnChange,
  state,
  registerFieldControl,
  validation,
});

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: fieldValidityMapping,
});

defineExpose({ element, validate: validateField });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
