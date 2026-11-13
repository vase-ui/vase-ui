<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { FieldRootState } from '../internals/field-root-context/FieldRootContext';
import { REASONS } from '../internals/reasons';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../internals/types';

export interface RadioGroupState extends FieldRootState {
  /**
   * Whether the user should be unable to select a different radio button in the group.
   */
  readOnly: boolean;
  /**
   * Whether the user must tick a radio button within the group before submitting a form.
   */
  required: boolean;
}

export interface RadioGroupProps<Value = any>
  extends
    VaseUIComponentProps<RadioGroupState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id'> {
  /**
   * The id of the element of the group.
   */
  id?: string | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user should be unable to select a different radio button in the group.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the radio inputs.
   * Useful when the radio group is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * The controlled value of the radio item that should be currently selected.
   *
   * To render an uncontrolled radio group, use the `defaultValue` prop instead.
   */
  value?: Value | undefined;
  /**
   * The uncontrolled value of the radio button that should be initially selected.
   *
   * To render a controlled radio group, use the `value` prop instead.
   */
  defaultValue?: Value | undefined;
}

export type RadioGroupChangeEventReason = typeof REASONS.none;

export type RadioGroupChangeEventDetails = VaseUIChangeEventDetails<RadioGroupChangeEventReason>;
</script>

<script setup lang="ts" generic="Value = any">
import { computed, provide, shallowRef } from 'vue';
import { contains } from '../common/shadowDom';
import { useControlled } from '../common/useControlled';
import { isEligibleInput } from '../field/root/useFieldValidation';
import { useFieldsetRootContext } from '../fieldset/root/FieldsetRootContext';
import { SHIFT } from '../internals/composite/composite';
import { useCompositeRoot } from '../internals/composite/root/useCompositeRoot';
import { createChangeEventDetails } from '../internals/createBaseUIEventDetails';
import { fieldValidityMapping } from '../internals/field-constants/constants';
import { useRegisterFieldControl } from '../internals/field-register-control';
import { useClearFieldError, useFieldRootContext } from '../internals/field-root-context';
import { useFormContext } from '../internals/form-context';
import { useDeferredServerRender, useLabelableContext } from '../internals/labelable-provider';
import type { ComponentRenderFn, HTMLProps } from '../internals/types';
import { useVaseUiId } from '../internals/useBaseUiId';
import { useRenderElement } from '../internals/useRenderElement';
import { useValueChanged } from '../internals/useValueChanged';
import { RadioGroupContext } from './RadioGroupContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<RadioGroupProps<Value>>(), {
  as: 'div',
  disabled: false,
  readOnly: false,
  required: false,
  value: undefined,
});

const emit = defineEmits<{
  /**
   * Callback fired when the value changes.
   * A native reset puts a group that has no `defaultValue` back to no value. The callback then gets
   * `undefined`.
   */
  valueChange: [value: Value, eventDetails: RadioGroupChangeEventDetails];
  'update:value': [value: Value];
}>();

defineSlots<{
  default(props: { state: RadioGroupState }): unknown;
  render: ComponentRenderFn<HTMLProps, RadioGroupState>;
}>();

const {
  setTouched: setFieldTouched,
  setFocused,
  validationMode,
  name: fieldName,
  disabled: fieldDisabled,
  state: fieldState,
  validation,
  setDirty,
  setFilled,
  validityData,
} = useFieldRootContext();
const { labelId } = useLabelableContext();
const { clearErrors, elementRef: formElement } = useFormContext();
const fieldset = useFieldsetRootContext(true);

// The group binds the id of a label, a legend and a message that can come after it.
useDeferredServerRender();

const isDisabled = computed(() => fieldDisabled.value || props.disabled);
const inputName = computed(() => fieldName.value ?? props.name);
const controlId = useVaseUiId(() => props.id);
const clearFieldError = useClearFieldError(inputName);

const [checkedValue, setCheckedValueState] = useControlled<Value>({
  controlled: () => props.value,
  default: () => props.defaultValue,
  name: 'RadioGroup',
  state: 'value',
});

// The field holds `null` for a group with no value. A reset gives `undefined`, the same state.
const fieldValue = computed(() => checkedValue.value ?? null);

// A server writes the parts that come after the group before it runs the `setup` of a radio,
// because the group defers its render. The group thus sets the first `filled` state itself.
if (checkedValue.value != null) {
  setFilled(true);
}

const touched = shallowRef(false);
const inputSyncRequest = shallowRef(0);

function setTouched(value: boolean) {
  touched.value = value;
}

function setCheckedValue(value: Value, eventDetails: RadioGroupChangeEventDetails) {
  emit('valueChange', value, eventDetails);

  if (eventDetails.isCanceled) {
    return;
  }

  emit('update:value', value);
  setCheckedValueState(value);
  inputSyncRequest.value += 1;
}

// The exposed input is the checked input, or else the first enabled input. The field validates
// each registered input, so the group does not write `validation.inputRef`. A stale input of an
// unmounted radio there would block the submit of the form.
const inputElement = shallowRef<HTMLInputElement | null>(null);
let firstEnabledInput: HTMLInputElement | null = null;

function registerInputRef(input: HTMLInputElement) {
  if (!input.disabled) {
    firstEnabledInput ??= input;

    const currentInput = inputElement.value;
    if (input.checked || currentInput == null || currentInput.disabled) {
      inputElement.value = input;
    }
  }

  // A later call can make this input the exposed input, so the cleanup checks both.
  return () => {
    if (firstEnabledInput === input) {
      firstEnabledInput = null;
    }
    if (inputElement.value === input) {
      inputElement.value = null;
    }
  };
}

function getFormValue() {
  const form = formElement.value;
  if (!form) {
    return fieldValue.value;
  }

  for (const input of validation.registeredInputs.keys()) {
    if (input.checked && isEligibleInput(input, form)) {
      return fieldValue.value;
    }
  }

  return null;
}

useRegisterFieldControl(
  () => validation.getInputControl(),
  controlId,
  () => fieldValue.value,
  getFormValue,
  () => !isDisabled.value,
  () => props.name,
);

// The change of a reset reaches `useValueChanged` after the reset timeout. A clear in the timeout
// would come before `validation.change`, and the validation could show a new error. The timeout sets
// this flag, and the callback clears the field and starts no validation.
let isResetChangePending = false;

useValueChanged(checkedValue, () => {
  clearErrors(inputName.value);

  setDirty(fieldValue.value !== validityData.value.initialValue);
  setFilled(checkedValue.value != null);

  if (isResetChangePending) {
    isResetChangePending = false;
    clearFieldError(fieldValue.value);
  } else {
    validation.change(checkedValue.value);
  }

  const fallbackInput = firstEnabledInput;
  if (checkedValue.value == null && fallbackInput && !fallbackInput.disabled) {
    inputElement.value = fallbackInput;
  }
});

let handledReset: Event | undefined;

function reset(event: Event) {
  if (event === handledReset) {
    return;
  }
  handledReset = event;

  if (props.value === undefined && checkedValue.value !== props.defaultValue) {
    const details = createChangeEventDetails(REASONS.none, event);
    // `Value` cannot name the value of a group that has no default.
    setCheckedValue(props.defaultValue as Value, details);

    if (!details.isCanceled) {
      isResetChangePending = true;
      return;
    }
  }

  clearFieldError(fieldValue.value);
}

const state = computed<RadioGroupState>(() => ({
  ...fieldState.value,
  disabled: isDisabled.value,
  required: props.required,
  readOnly: props.readOnly,
}));

provide(RadioGroupContext, {
  checkedValue,
  disabled: isDisabled,
  form: computed(() => props.form),
  validation,
  name: inputName,
  readOnly: computed(() => props.readOnly),
  registerInputRef,
  required: computed(() => props.required),
  setCheckedValue,
  setTouched,
  touched,
  inputSyncRequest,
  reset,
});

// With a value, the server HTML has the tab stop on the checked radio. Base UI has `-1` on each radio.
const composite = useCompositeRoot({
  enableHomeAndEndKeys: false,
  modifierKeys: [SHIFT],
  hasActiveItem: () => checkedValue.value != null,
});

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [composite.rootRef],
  stateAttributesMapping: fieldValidityMapping,
  props: (attrs) => [
    composite.props,
    {
      id: props.id,
      role: 'radiogroup',
      'aria-required': props.required || undefined,
      'aria-disabled': isDisabled.value || undefined,
      'aria-readonly': props.readOnly || undefined,
      'aria-labelledby': labelId.value ?? fieldset?.legendId.value,
      onFocusout(event: FocusEvent) {
        if (
          !contains(event.currentTarget as Element | null, event.relatedTarget as Element | null)
        ) {
          setTouched(false);
          setFieldTouched(true);
          setFocused(false);

          if (validationMode.value === 'onBlur') {
            void validation.commit(checkedValue.value);
          }
        }
      },
      onKeydownCapture(event: KeyboardEvent) {
        if (event.key.startsWith('Arrow')) {
          setTouched(true);
        }
      },
    },
    attrs,
    (merged) => validation.getValidationProps(isDisabled.value, merged),
  ],
});

defineExpose({ element, inputElement });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
