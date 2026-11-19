<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIChangeEventDetails } from '../internals/createVaseUIEventDetails';
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
  modelValue?: Value | undefined;
  /**
   * The uncontrolled value of the radio button that should be initially selected.
   *
   * To render a controlled radio group, use the `modelValue` prop instead.
   */
  defaultValue?: Value | undefined;
}

export type RadioGroupChangeEventReason = typeof REASONS.none;

export type RadioGroupChangeEventDetails = VaseUIChangeEventDetails<RadioGroupChangeEventReason>;
</script>

<script setup lang="ts" generic="Value = any">
import { computed, provide, shallowRef, triggerRef } from 'vue';
import { queueInputTake } from '../common/hydration';
import { contains } from '../common/shadowDom';
import { useControlled } from '../common/useControlled';
import { isEligibleInput } from '../field/root/useFieldValidation';
import { useFieldsetRootContext } from '../fieldset/root/FieldsetRootContext';
import { useFieldsetDisabled } from '../fieldset/root/useFieldsetDisabled';
import { comesBeforeInSameTree } from '../internals/comesBeforeInSameTree';
import { SHIFT } from '../internals/composite/listIndex';
import { useCompositeRoot } from '../internals/composite/root/useCompositeRoot';
import { createChangeEventDetails } from '../internals/createVaseUIEventDetails';
import { fieldValidityMapping } from '../internals/field-constants/constants';
import { useFieldControl } from '../internals/field-register-control';
import { useClearFieldError, useFieldRootContext } from '../internals/field-root-context';
import { useFormContext } from '../internals/form-context';
import { given } from '../internals/givenAttributes';
import { useDeferredServerRender, useLabelableContext } from '../internals/labelable-provider';
import type { ComponentRenderFn, HTMLProps } from '../internals/types';
import { useVaseUiId } from '../internals/useVaseUiId';
import { useFormRestore } from '../internals/useFormRestore';
import { useRenderElement } from '../internals/useRenderElement';
import { useValueChanged } from '../internals/useValueChanged';
import { RadioGroupContext } from './RadioGroupContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<RadioGroupProps<Value>>(), {
  as: 'div',
  disabled: false,
  readOnly: false,
  required: false,
  modelValue: undefined,
});

const emit = defineEmits<{
  /**
   * Callback fired when the value changes.
   * A native reset puts a group that has no `defaultValue` back to no value. The callback then gets
   * `undefined`.
   */
  valueChange: [value: Value, eventDetails: RadioGroupChangeEventDetails];
  /**
   * Event handler called after `valueChange` with the new value, unless a listener cancels the
   * change. `v-model` uses it.
   */
  'update:modelValue': [value: Value];
}>();

defineSlots<{
  default(props: { state: RadioGroupState }): unknown;
  render: ComponentRenderFn<HTMLProps, RadioGroupState>;
}>();

const {
  setTouched: setFieldTouched,
  setFocused,
  validationMode,
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

const fieldsetDisabled = useFieldsetDisabled(() => element.value);
const isDisabled = computed(() => fieldDisabled.value || fieldsetDisabled.value || props.disabled);
const controlId = useVaseUiId(() => props.id);

const checkedValue = useControlled<Value>({
  controlled: () => props.modelValue,
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

// The group asks all its radios in one flush. With one take for each radio, a take of another
// part between two radios waits for a flush, and the write of the earlier radio unchecks the input
// that the browser checked in a group with a name.
const inputTakeRequest = shallowRef<{ event?: Event | undefined }>();
let isInputTakeQueued = false;

function takeInputsAfterMount() {
  if (isInputTakeQueued) {
    return;
  }
  isInputTakeQueued = true;
  queueInputTake(() => {
    isInputTakeQueued = false;
    inputTakeRequest.value = {};
    return true;
  });
}

function setTouched(value: boolean) {
  touched.value = value;
}

function setCheckedValue(value: Value, eventDetails: RadioGroupChangeEventDetails) {
  emit('valueChange', value, eventDetails);

  if (eventDetails.isCanceled) {
    return;
  }

  emit('update:modelValue', value);
  checkedValue.value = value;
  inputSyncRequest.value += 1;
}

// The exposed input is the checked input when it is enabled, or else the first enabled input in the
// document. The field validates each registered input, so the group does not write
// `validation.inputRef`. A stale input of an unmounted radio there would block the submit of the
// form.
const radioInputs = new Set<HTMLInputElement>();
// `inputElement` is `null` after the radio of the input that it gives unmounts, as in Base UI. The
// registration of an input whose `disabled` property is `false` and a value that becomes `null` end
// this state.
const isExposedInputDetached = shallowRef(false);

// A keyed move runs no registration, and a radio follows a change of a native `<fieldset>` only after
// its observer calls back. The group thus reads its inputs at each read. `:disabled` also matches an
// input in a disabled `<fieldset>`, and the browser does not focus that input.
function getExposedInput() {
  if (isExposedInputDetached.value) {
    return null;
  }

  let firstInput: HTMLInputElement | null = null;
  for (const input of radioInputs) {
    if (input.matches(':disabled')) {
      continue;
    }
    if (input.checked) {
      return input;
    }
    if (!firstInput || comesBeforeInSameTree(input, firstInput)) {
      firstInput = input;
    }
  }
  return firstInput;
}

function registerInputRef(input: HTMLInputElement) {
  radioInputs.add(input);

  // A radio reads a native `<fieldset>` after its mount. The first registration of a radio that
  // mounts in a disabled fieldset thus sees no `disabled` attribute, and it ends the detach, as in
  // Base UI.
  if (!input.disabled) {
    isExposedInputDetached.value = false;
  }
  // A `computed` that reads `inputElement` then follows each registration.
  triggerRef(isExposedInputDetached);

  return () => {
    const givenInput = getExposedInput();
    radioInputs.delete(input);
    if (givenInput === input) {
      isExposedInputDetached.value = true;
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

const { name: inputName } = useFieldControl(() => validation.getInputControl(), {
  id: controlId,
  name: () => props.name,
  value: fieldValue,
  getValue: getFormValue,
  enabled: () => !isDisabled.value,
});
const clearFieldError = useClearFieldError(inputName);

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

  if (checkedValue.value == null) {
    isExposedInputDetached.value = false;
  }
});

let handledReset: Event | undefined;

function reset(event: Event) {
  if (event === handledReset) {
    return;
  }
  handledReset = event;

  if (props.modelValue === undefined && checkedValue.value !== props.defaultValue) {
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
  inputTakeRequest,
  takeInputsAfterMount,
  reset,
});

// With a value, the server HTML has the tab stop on the checked radio. Base UI has `-1` on each radio.
const composite = useCompositeRoot({
  enableHomeAndEndKeys: false,
  modifierKeys: [SHIFT],
  hasActiveItem: () => checkedValue.value != null,
});

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  ref: composite.registerRoot,
  stateAttributesMapping: fieldValidityMapping,
  props: (attrs) => [
    {
      onFocusin: composite.onFocusin,
      onFocusout: composite.onFocusout,
      onKeydown: composite.onKeydown,
    },
    {
      id: given('id', props.id),
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

          // A user cannot empty a group, so a missing value counts with no earlier change.
          if (validationMode.value === 'onBlur') {
            void validation.commit(checkedValue.value, true);
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

useFormRestore(element, (event) => {
  inputTakeRequest.value = { event };
});

defineExpose({
  element,
  get inputElement() {
    return getExposedInput();
  },
});
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
