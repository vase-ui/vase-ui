<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { FieldRootState } from '../../internals/field-root-context/FieldRootContext';
import { REASONS } from '../../internals/reasons';
import type {
  NonNativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';

export interface CheckboxRootState extends FieldRootState {
  /**
   * Whether the checkbox is currently ticked.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to tick or untick the checkbox.
   */
  readOnly: boolean;
  /**
   * Whether the user must tick the checkbox before submitting a form.
   */
  required: boolean;
  /**
   * Whether the checkbox is in a mixed state: neither ticked, nor unticked.
   */
  indeterminate: boolean;
}

export interface CheckboxRootProps
  extends
    NonNativeButtonProps,
    VaseUIComponentProps<CheckboxRootState>,
    /* @vue-ignore */ Omit<
      WithVaseUIEvent<HTMLAttributes>,
      'id' | 'aria-label' | 'aria-labelledby' | 'onChange'
    > {
  /**
   * The id of the hidden input element.
   *
   * When `nativeButton` is `true`, the id is applied to the root element.
   */
  id?: string | undefined;
  /**
   * Identifies the field when a form is submitted.
   * @default undefined
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the hidden input.
   * Useful when the checkbox is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * Whether the checkbox is currently ticked.
   *
   * To render an uncontrolled checkbox, use the `defaultChecked` prop instead.
   * @default undefined
   */
  checked?: boolean | undefined;
  /**
   * Whether the checkbox is initially ticked.
   *
   * To render a controlled checkbox, use the `checked` prop instead.
   * @default false
   */
  defaultChecked?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user should be unable to tick or untick the checkbox.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must tick the checkbox before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the checkbox is in a mixed state: neither ticked, nor unticked.
   * @default false
   */
  indeterminate?: boolean | undefined;
  /**
   * The value submitted with the form when the checkbox is unchecked.
   * By default, unchecked checkboxes do not submit any value, matching native checkbox behavior.
   */
  uncheckedValue?: string | undefined;
  /**
   * The checkbox's value. Identifies it within a Checkbox Group, falling back to `name` when omitted.
   * When submitting a form, a checked box submits `value`; with no `value`, it submits the native "on".
   */
  value?: string | undefined;
  /**
   * The accessible name of the checkbox. With a name here, no label names the checkbox.
   */
  ariaLabel?: string | undefined;
  /**
   * The ids of the elements that name the checkbox. They replace the label of the checkbox.
   */
  ariaLabelledby?: string | undefined;
}

export type CheckboxRootChangeEventReason = typeof REASONS.none;
export type CheckboxRootChangeEventDetails =
  VaseUIChangeEventDetails<CheckboxRootChangeEventReason>;
</script>

<script setup lang="ts">
import { computed, nextTick, shallowRef, watch } from 'vue';
import { addEventListener } from '../../common/addEventListener';
import { getDefaultFormSubmitter } from '../../common/getDefaultFormSubmitter';
import { ownerWindow } from '../../common/owner';
import { useControlled } from '../../common/useControlled';
import { useTimeout } from '../../common/useTimeout';
import { visuallyHiddenInput, visuallyHiddenInputPinned } from '../../common/visuallyHidden';
import { useFieldItemContext } from '../../field/item/FieldItemContext';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { useRegisterFieldControl } from '../../internals/field-register-control';
import { useClearFieldError, useFieldRootContext } from '../../internals/field-root-context';
import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
import { useFormContext } from '../../internals/form-context';
import { handleHiddenInputInvalid } from '../../internals/handleHiddenInputInvalid';
import {
  useAriaLabelledBy,
  useControlLabelId,
  useLabelableContext,
  useLabelableId,
} from '../../internals/labelable-provider';
import type { ComponentRenderFn, HTMLProps, VaseUIEvent } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useFormReset } from '../../internals/useFormReset';
import { useRenderElement } from '../../internals/useRenderElement';
import { useValueChanged } from '../../internals/useValueChanged';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import { getCheckboxStateAttributesMapping } from '../utils/getCheckboxStateAttributesMapping';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CheckboxRootProps>(), {
  as: 'span',
  checked: undefined,
  defaultChecked: false,
  disabled: false,
  indeterminate: false,
  name: undefined,
  nativeButton: false,
  readOnly: false,
  required: false,
});

const emit = defineEmits<{
  /**
   * Event handler called when the checkbox is ticked or unticked.
   */
  checkedChange: [checked: boolean, eventDetails: CheckboxRootChangeEventDetails];
  'update:checked': [checked: boolean];
}>();

defineSlots<{
  default(props: { state: CheckboxRootState }): unknown;
  render: ComponentRenderFn<HTMLProps, CheckboxRootState>;
}>();

const { clearErrors } = useFormContext();
const {
  state: fieldState,
  setTouched,
  setDirty,
  validityData,
  setFilled,
  validationMode,
  disabled: fieldDisabled,
  name: fieldName,
  validation,
} = useFieldRootContext();
const fieldItemContext = useFieldItemContext();
const { getDescriptionProps } = useLabelableContext();

const isDisabled = computed(
  () => fieldDisabled.value || fieldItemContext.disabled.value || props.disabled,
);
const inputName = computed(() => fieldName.value ?? props.name);
const clearFieldError = useClearFieldError(inputName);

const inputElement = shallowRef<HTMLInputElement | null>(null);
// Vue calls a ref setter during a render, so the setter reads no reactive state.
let heldInput: HTMLInputElement | null = null;
let unregisterInput: (() => void) | void;

function setInputElement(value: unknown) {
  const input = value as HTMLInputElement | null;
  // Vue calls a function ref again on each patch, with the same element.
  if (input === heldInput) {
    return;
  }

  heldInput = input;
  inputElement.value = input;
  unregisterInput?.();
  // A field can have more than one input, so the input goes to the registry of the field and not
  // to `validation.inputRef`.
  unregisterInput = input
    ? validation.registerInput(input, { controlRef: () => element.value, value: undefined })
    : undefined;
}

const setFocused = useSetFieldFocused(isDisabled, () => element.value);

const rootId = useVaseUiId();
// An empty `id` is not an own id: the control takes the id of the provider.
const controlId = useLabelableId({ id: () => props.id || undefined });
const hiddenInputId = computed(() => (props.nativeButton ? undefined : controlId.value));

const [isChecked, setCheckedState] = useControlled({
  controlled: () => props.checked,
  default: () => props.defaultChecked,
  name: 'Checkbox',
  state: 'checked',
});

useRegisterFieldControl(
  () => element.value,
  rootId,
  () => isChecked.value,
  undefined,
  () => !isDisabled.value,
  () => props.name,
);

setFilled(isChecked.value);
watch(isChecked, setFilled);

// The change of a reset reaches `useValueChanged` after the reset timeout. A clear in the timeout
// would come before `validation.change`, and the validation could show a new error. The timeout sets
// this flag, and the callback clears the field and starts no validation.
let isResetChangePending = false;

useValueChanged(isChecked, () => {
  clearErrors(inputName.value);
  setDirty(isChecked.value !== validityData.value.initialValue);

  if (isResetChangePending) {
    isResetChangePending = false;
    clearFieldError(isChecked.value);
    return;
  }

  validation.change(isChecked.value);
});

const { getButtonProps, buttonRef } = useButton({
  disabled: isDisabled,
  native: () => props.nativeButton,
});

const ariaLabelledBy = useAriaLabelledBy(
  () => props.ariaLabelledby,
  useControlLabelId(),
  inputElement,
  () => !props.nativeButton,
  controlId,
  () => props.ariaLabel,
);

// Vue writes `checked` to the input only when the value changes between two renders, and
// hydration does not write it. HTML has no attribute for `indeterminate`, so a server cannot write
// it. A browser also changes the input with no change of the state: it restores the form state of a
// page, and a click on the input sets `indeterminate` to `false` and keeps the new `checked`, also
// when a parent does not accept the click. A form would then submit a state that the checkbox does
// not show.
function writeStateToInput() {
  const input = inputElement.value;
  if (!input) {
    return;
  }

  if (input.checked !== isChecked.value) {
    input.checked = isChecked.value;
  }

  if (input.indeterminate !== props.indeterminate) {
    input.indeterminate = props.indeterminate;
  }
}

function requestChange(nextChecked: boolean, event: Event) {
  const details = createChangeEventDetails(REASONS.none, event);

  emit('checkedChange', nextChecked, details);

  if (details.isCanceled) {
    return false;
  }

  emit('update:checked', nextChecked);
  setCheckedState(nextChecked);
  return true;
}

function onInputClick(event: MouseEvent) {
  // The root dispatches this click for its own click. The ancestors already got that click.
  event.stopPropagation();

  // The browser puts the old state back after a click whose default action is prevented.
  if (event.defaultPrevented) {
    return;
  }

  if (props.readOnly || !requestChange((event.currentTarget as HTMLInputElement).checked, event)) {
    event.preventDefault();
    return;
  }

  // A parent that controls the checkbox can keep the old value. The input then has the new one.
  void nextTick(writeStateToInput);
}

useFormReset(inputElement, (event) => {
  const hasChanged =
    props.checked === undefined &&
    isChecked.value !== props.defaultChecked &&
    requestChange(props.defaultChecked, event);

  if (hasChanged) {
    isResetChangePending = true;
  } else {
    clearFieldError(isChecked.value);
  }
});

watch(
  inputElement,
  (input, _previous, onCleanup) => {
    if (!input) {
      return;
    }

    writeStateToInput();

    // Chromium restores the form state of a page after `load`, with no event on the input.
    onCleanup(addEventListener(ownerWindow(input), 'pageshow', writeStateToInput));
  },
  { flush: 'post' },
);

watch([isChecked, () => props.indeterminate], writeStateToInput, { flush: 'post' });

const enterTimeout = useTimeout();

function onKeydown(event: VaseUIEvent<KeyboardEvent>) {
  if (event.key !== 'Enter') {
    return;
  }

  // `useButton` would click the part on Enter, and the checkbox does not change on Enter.
  event.preventVaseUIHandler();

  if (event.defaultPrevented) {
    return;
  }

  const form = inputElement.value?.form ?? null;
  let isPreventedLater = false;

  // A native `<button>` clicks on Enter, and the checkbox must not change.
  event.preventDefault();

  // A listener of an ancestor reads the event later. It must read `false` and it must be able to
  // prevent the submit, so the event has own properties until the timeout.
  Object.defineProperties(event, {
    defaultPrevented: { configurable: true, get: () => isPreventedLater },
    preventDefault: {
      configurable: true,
      value: () => {
        isPreventedLater = true;
      },
    },
  });

  // The browser runs the microtasks after each listener of a real key press, so a microtask would
  // run before the listener of the next ancestor. A timeout runs after all listeners.
  enterTimeout.start(0, () => {
    Reflect.deleteProperty(event, 'defaultPrevented');
    Reflect.deleteProperty(event, 'preventDefault');

    if (!isPreventedLater) {
      getDefaultFormSubmitter(form)?.click();
    }
  });
}

const state = computed<CheckboxRootState>(() => ({
  ...fieldState.value,
  checked: isChecked.value,
  disabled: isDisabled.value,
  readOnly: props.readOnly,
  required: props.required,
  indeterminate: props.indeterminate,
}));

const stateAttributesMapping = getCheckboxStateAttributesMapping(state);

const { element, elementProps } = useRenderElement('span', props, {
  state,
  ref: [buttonRef],
  stateAttributesMapping,
  props: (attrs) => [
    {
      id: props.nativeButton ? controlId.value : rootId.value,
      role: 'checkbox',
      'aria-checked': props.indeterminate ? 'mixed' : isChecked.value,
      'aria-readonly': props.readOnly || undefined,
      'aria-required': props.required || undefined,
      'aria-label': props.ariaLabel,
      'aria-labelledby': ariaLabelledBy.value,
      onFocusin() {
        setFocused(true);
      },
      onFocusout() {
        const input = inputElement.value;
        if (!input) {
          return;
        }

        setTouched(true);
        setFocused(false);

        if (validationMode.value === 'onBlur') {
          void validation.commit(input.checked);
        }
      },
      onKeydown,
      onClick(event: MouseEvent) {
        if (props.readOnly || isDisabled.value) {
          return;
        }

        event.preventDefault();

        const input = inputElement.value;
        if (!input) {
          return;
        }

        dispatchClickWithModifiers(input, event);
      },
    },
    attrs,
    getButtonProps,
    getDescriptionProps,
    (merged) => validation.getValidationProps(isDisabled.value, merged),
  ],
});

// The style is the constant itself, in an object that no `mergeProps` call makes.
// `handleHiddenInputInvalid` then keeps the size that it writes.
function inputProps() {
  return {
    ...validation.getValidationProps(isDisabled.value, getDescriptionProps({})),
    ref: setInputElement,
    checked: isChecked.value,
    disabled: isDisabled.value,
    form: props.form,
    id: hiddenInputId.value,
    name: inputName.value,
    required: props.required,
    style: inputName.value ? visuallyHiddenInput : visuallyHiddenInputPinned,
    tabindex: -1,
    type: 'checkbox',
    'aria-hidden': true,
    onInvalid: handleHiddenInputInvalid,
    onClick: onInputClick,
    onFocusin() {
      element.value?.focus();
    },
    ...(props.value !== undefined ? { value: props.value } : undefined),
  };
}

defineExpose({ element, inputElement });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
  <input
    v-if="!isChecked && inputName && uncheckedValue !== undefined"
    type="hidden"
    :form="form"
    :name="inputName"
    :value="uncheckedValue"
    :disabled="isDisabled"
  />
  <input v-bind="inputProps()" />
</template>
