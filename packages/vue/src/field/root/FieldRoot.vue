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
import { computed, provide, shallowRef, watch } from 'vue';
import { useFieldsetRootContext } from '../../fieldset/root/FieldsetRootContext';
import { DEFAULT_VALIDITY_STATE, fieldValidityMapping } from '../../internals/field-constants';
import { useFieldControlRegistration } from '../../internals/field-register-control';
import { FieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useFormContext } from '../../internals/form-context/FormContext';
import { provideLabelableContext } from '../../internals/labelable-provider';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
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

defineSlots<{
  default(props: { state: FieldRootState }): unknown;
  render: ComponentRenderFn<HTMLProps, FieldRootState>;
}>();

const { errors, validationMode: formValidationMode, submitCountRef } = useFormContext();
const fieldsetContext = useFieldsetRootContext(true);
const labelable = provideLabelableContext();

const isDisabled = computed(() => (fieldsetContext?.disabled.value ?? false) || props.disabled);
const resolvedValidationMode = computed(() => props.validationMode ?? formValidationMode.value);

const touchedState = shallowRef(false);
const dirtyState = shallowRef(false);
const filled = shallowRef(false);
const focused = shallowRef(false);
const focusOwnerRef = shallowRef<unknown>();

const isDirty = computed(() => props.dirty ?? dirtyState.value);
const isTouched = computed(() => props.touched ?? touchedState.value);

// The watcher is sync. A `validate()` call that follows the change of the prop in one handler then
// reads the new value.
const markedDirtyRef = shallowRef(isDirty.value);
watch(
  () => props.dirty,
  (dirtyProp) => {
    if (dirtyProp !== undefined) {
      markedDirtyRef.value = dirtyProp;
    }
  },
  { flush: 'sync' },
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
    (resolvedValidationMode.value === 'onSubmit' && submitCountRef.value > 0)
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

// The registration comes first, because the name of the field can come from its control.
// `validation` exists when a control calls `change` or `commit`.
const {
  validate: validateField,
  registerFieldControl,
  registeredFieldName,
} = useFieldControlRegistration({
  change: (value, cancelPending) => validation.change(value, cancelPending),
  commit: (value) => validation.commit(value),
  invalid: () => isInvalid.value,
  markedDirtyRef,
  name: () => props.name,
  setValidityData,
  validityData,
});

const effectiveName = computed(() => props.name ?? registeredFieldName.value);

const isInvalid = computed(() => {
  const name = effectiveName.value;
  const formError = name && Object.hasOwn(errors.value, name) ? errors.value[name] : null;
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
  touched: isTouched.value,
  dirty: isDirty.value,
  valid: valid.value,
  filled: filled.value,
  focused: focused.value,
}));

const validation = useFieldValidation({
  setValidityData,
  validate: (value, formValues) => (props.validate ? props.validate(value, formValues) : null),
  validityData,
  validationDebounceTime: () => props.validationDebounceTime,
  markedDirtyRef,
  state,
  shouldValidateOnChange,
  validationMode: resolvedValidationMode,
  getDescriptionProps: labelable.getDescriptionProps,
});

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
  focusOwnerRef,
  validationMode: resolvedValidationMode,
  shouldValidateOnChange,
  state,
  registerFieldControl,
  validation,
});

const { element, elementProps } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: fieldValidityMapping,
});

defineExpose({ element, validate: validateField });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
