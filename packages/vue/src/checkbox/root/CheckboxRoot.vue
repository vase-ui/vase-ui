<script lang="ts">
import type { HTMLAttributes, ShallowRef } from 'vue';
import type { VaseUIChangeEventDetails } from '../../internals/createVaseUIEventDetails';
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
      WithVaseUIEvent<HTMLAttributes, 'aria-label' | 'aria-labelledby'>,
      'id' | 'onChange'
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
  modelValue?: boolean | undefined;
  /**
   * Whether the checkbox is initially ticked.
   *
   * To render a controlled checkbox, use the `modelValue` prop instead.
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
   * Whether the checkbox controls a group of child checkboxes.
   *
   * Must be used in a Checkbox Group.
   * @default false
   */
  parent?: boolean | undefined;
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

function getDefaultFormSubmitter(form: HTMLFormElement | null) {
  // The first submit button remains the default even when it is disabled.
  for (const candidate of form?.elements ?? []) {
    if (candidate.tagName === 'BUTTON' || candidate.tagName === 'INPUT') {
      const button = candidate as HTMLButtonElement | HTMLInputElement;
      if (button.type === 'submit') return button;
    }
  }
  return null;
}
</script>

<script setup lang="ts">
import { computed, inject, provide, useTemplateRef, watch } from 'vue';
import { useAriaAfterHydration, useIsHydrated } from '../../common/hydration';
import { useControlled } from '../../common/useControlled';
import { useTimeout } from '../../common/useTimeout';
import { useFieldItemContext } from '../../field/item/FieldItemContext';
import { useFieldsetDisabled } from '../../fieldset/root/useFieldsetDisabled';
import { useCheckedInput } from '../../internals/useCheckedInput';
import { visuallyHiddenInput, visuallyHiddenInputPinned } from '../../common/visuallyHidden';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { useFieldControl, useInputRegistration } from '../../internals/field-register-control';
import { useClearFieldError, useFieldRootContext } from '../../internals/field-root-context';
import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
import { useFormContext } from '../../internals/form-context';
import { given } from '../../internals/givenAttributes';
import {
  useAriaLabelledBy,
  useControlLabelId,
  useLabelableContext,
  useLabelableId,
} from '../../internals/labelable-provider';
import type { ComponentRenderFn, HTMLProps, VaseUIEvent } from '../../internals/types';
import { useButton } from '../../internals/use-button/useButton';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useFormReset } from '../../internals/useFormReset';
import { useRenderElement } from '../../internals/useRenderElement';
import { useValueChanged } from '../../internals/useValueChanged';
import { useElementId } from '../../utils/popups/useElementId';
import {
  CheckboxGroupContext,
  CheckboxRootContext,
  getCheckboxStateAttributesMapping,
} from '../../checkbox-group/checkboxContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CheckboxRootProps>(), {
  as: 'span',
  modelValue: undefined,
  defaultChecked: false,
  disabled: false,
  indeterminate: false,
  name: undefined,
  nativeButton: false,
  parent: false,
  readOnly: false,
  required: false,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Checkbox.Root');
}

const emit = defineEmits<{
  /**
   * Event handler called when the checkbox is ticked or unticked.
   */
  checkedChange: [checked: boolean, eventDetails: CheckboxRootChangeEventDetails];
  /**
   * Event handler called after `checkedChange` with the new value, unless a listener cancels the
   * change. `v-model` uses it.
   */
  'update:modelValue': [checked: boolean];
}>();

defineSlots<{
  default(props: { state: CheckboxRootState }): unknown;
  render: ComponentRenderFn<HTMLProps, CheckboxRootState>;
}>();

const group = inject(CheckboxGroupContext, undefined);
const { clearErrors } = useFormContext();
const {
  state: fieldState,
  setTouched,
  setDirty,
  validityData,
  setFilled,
  validationMode,
  disabled: fieldDisabled,
  validation: fieldValidation,
} = useFieldRootContext();
const fieldItemContext = useFieldItemContext();
const { getDescriptionProps, registerControlId } = useLabelableContext();

// The field of the group owns the inputs of the checkboxes of the group.
const validation = group?.validation ?? fieldValidation;

const fieldsetDisabled = useFieldsetDisabled(() => element.value);
const isDisabled = computed(
  () =>
    fieldDisabled.value ||
    fieldItemContext.disabled.value ||
    (group?.disabled.value ?? false) ||
    fieldsetDisabled.value ||
    props.disabled,
);
const { name: inputName } = useFieldControl(() => element.value, {
  id: () => rootId.value,
  name: () => props.name,
  value: () => isChecked.value,
  enabled: () => !group && !isDisabled.value,
});
// In a group, the value of the checkbox is the name that the group lists when the checkbox is on.
const itemValue = computed(() => props.value ?? inputName.value);
const clearFieldError = useClearFieldError(inputName);

const parentState = computed(() => (props.parent ? group?.parent.value : undefined));
const isIndeterminate = computed(() => props.indeterminate || !!parentState.value?.indeterminate);

const inputElement: ShallowRef<HTMLInputElement | null> = useTemplateRef('input');
// A field can have more than one input, so the input goes to the registry of the field and not to
// `validation.inputRef`. The group reads the value when the form needs it, so a change of the value
// needs no new registration. The parent checkbox is not an input of its field, because it has no
// value to give to the form.
const { isHeld, updateInputRegistration } = useInputRegistration(inputElement, (input) =>
  props.parent
    ? undefined
    : validation.registerInput(input, {
        controlRef: () => element.value,
        get value() {
          return group ? itemValue.value : undefined;
        },
      }),
);

watch(() => props.parent, updateInputRegistration);

const setFocused = useSetFieldFocused(isDisabled, () => element.value);

const rootId = useVaseUiId();
// A group that shares the labelable scope of the checkbox is the control of the field and takes its
// name from `aria-labelledby`. The checkboxes must not claim the control id of that scope, or each
// of them would render the same id. A `Field.Item` opens a scope that the checkbox does own. The
// provider chain does not change, so `setup` makes this choice one time.
const ownsControlId = group?.registerControlId !== registerControlId;
const controlId = useLabelableId({
  id: () => props.id,
  enabled: ownsControlId,
  element: () => (props.nativeButton ? element.value : null),
});
const hiddenInputId = computed(() => (props.nativeButton ? undefined : controlId.value));

// The group holds the state of a checkbox that has a value, and of the parent checkbox of a group
// that has `allValues`. Another checkbox keeps its own state.
const groupChecked = computed(() =>
  group && !props.parent && itemValue.value !== undefined
    ? group.value.value.includes(itemValue.value)
    : parentState.value?.checked,
);

const isChecked = useControlled({
  controlled: () => groupChecked.value ?? props.modelValue,
  default: () => props.defaultChecked,
  name: 'Checkbox',
  state: 'checked',
});

// A group derives the filled state of the field from its value.
if (!group) {
  watch(isChecked, setFilled, { immediate: true });
}

// The change of a reset reaches `useValueChanged` after the reset timeout. A clear in the timeout
// would come before `validation.change`, and the validation could show a new error. The timeout sets
// this flag, and the callback clears the field and starts no validation.
let isResetChangePending = false;

useValueChanged(isChecked, () => {
  // The group clears the error, sets the dirty state and validates its own value.
  if (group) {
    return;
  }

  clearErrors(inputName.value);
  setDirty(isChecked.value !== validityData.value.initialValue);

  if (isResetChangePending) {
    isResetChangePending = false;
    clearFieldError(isChecked.value);
    return;
  }

  validation.change(isChecked.value);
});

const ariaLabelledBy = useAriaLabelledBy(
  () => props.ariaLabelledby,
  useControlLabelId(),
  inputElement,
  () => !props.nativeButton,
  controlId,
  () => props.ariaLabel,
);

function requestChange(nextChecked: boolean, event?: Event) {
  const details = createChangeEventDetails(REASONS.none, event);

  emit('checkedChange', nextChecked, details);

  if (details.isCanceled) {
    return false;
  }

  // The group gets the same `details` object, so a `cancel()` in `valueChange` of the group also
  // stops `update:modelValue`.
  const value = itemValue.value;
  if (parentState.value) {
    group?.toggleParent(details);
  } else if (group && !props.parent && value !== undefined) {
    group.setChildChecked(value, nextChecked, details);
  }

  if (details.isCanceled) {
    return false;
  }

  emit('update:modelValue', nextChecked);
  isChecked.value = nextChecked;
  return true;
}

const { checkedProps, activate, onInputClick, onInputFocus, onInputInvalid } = useCheckedInput(
  inputElement,
  () => element.value,
  {
    checked: isChecked,
    indeterminate: isIndeterminate,
    acceptClick: (checked, event) => !props.readOnly && requestChange(checked, event),
    takeRestored(checked, event) {
      if (!props.parent && !props.readOnly && !isDisabled.value) requestChange(checked, event);
    },
  },
);

// An uncontrolled checkbox goes back to its default value through its change event. The result is
// `true` when the state changed.
function resetChecked(event: Event) {
  return (
    props.modelValue === undefined &&
    isChecked.value !== props.defaultChecked &&
    requestChange(props.defaultChecked, event)
  );
}

useFormReset(inputElement, (event) => {
  if (group) {
    // The group puts back each checkbox that has an `itemValue`, and it clears the error of the
    // field one time for each reset.
    group.reset(event);

    // The group does not hold the state of a checkbox that keeps its own state, so that checkbox puts
    // its own state back. The callback of `useValueChanged` returns early in a group, so the
    // checkbox sets no flag and clears no error.
    if (groupChecked.value === undefined) {
      resetChecked(event);
    }

    return;
  }

  if (resetChecked(event)) {
    isResetChangePending = true;
  } else {
    clearFieldError(isChecked.value);
  }
});

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
  indeterminate: isIndeterminate.value,
}));

provide(CheckboxRootContext, state);

const stateAttributesMapping = getCheckboxStateAttributesMapping(state);

const ariaAfterHydration = useAriaAfterHydration();
const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('span', props, {
  button: (element) =>
    useButton(element, {
      disabled: isDisabled,
      native: () => props.nativeButton,
    }),
  state,
  stateAttributesMapping,
  props: (attrs) => [
    {
      id: props.nativeButton ? controlId.value : rootId.value,
      role: 'checkbox',
      'aria-checked': isIndeterminate.value ? 'mixed' : isChecked.value,
      'aria-readonly': props.readOnly || undefined,
      'aria-required': props.required || undefined,
      'aria-label': given('aria-label', props.ariaLabel),
      'aria-labelledby': ariaLabelledBy.value,
      'data-parent': props.parent ? '' : undefined,
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
          void validation.commit(group ? group.value.value : input.checked);
        }
      },
      onKeydown,
      onClick(event: MouseEvent) {
        if (props.readOnly || isDisabled.value) {
          return;
        }

        activate(event);
      },
    },
    attrs,
    parentState.value && { 'aria-controls': parentState.value.controls },
    getDescriptionProps,
    (merged) => validation.getValidationProps(isDisabled.value, merged),
  ],
});

// The `id` can come from the `#render` slot, also from a component in it that renders on its own.
const elementId = useElementId(element);

const isHydrated = useIsHydrated();
if (group) {
  const childValue = computed(() =>
    !isHeld.value && !props.parent && group.hasParent.value ? itemValue.value : undefined,
  );
  watch([childValue, isHydrated, isDisabled], ([value, hydrated, disabled], _, onCleanup) => {
    if (hydrated && value !== undefined) onCleanup(group.registerDisabled(value, disabled));
  });
  watch([childValue, elementId], ([value, id], _, onCleanup) => {
    if (id && value !== undefined) onCleanup(group.registerChildId(value, id));
  });
}

const inputValidation = computed(() =>
  validation.getValidationProps(isDisabled.value, getDescriptionProps({})),
);

defineExpose({ element, inputElement });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
  <input
    v-if="!isChecked && !group && inputName && !parent && uncheckedValue !== undefined"
    type="hidden"
    :form="form"
    :name="inputName"
    :value="uncheckedValue"
    :disabled="isDisabled"
  />
  <input
    ref="input"
    type="checkbox"
    v-bind="{ ...inputValidation, ...checkedProps }"
    :aria-describedby="ariaAfterHydration(inputValidation['aria-describedby'])"
    :name="parent ? undefined : inputName"
    :form="form"
    :required="required"
    :indeterminate="(isHydrated && isIndeterminate) || undefined"
    :style="inputName ? visuallyHiddenInput : visuallyHiddenInputPinned"
    :value="value === undefined ? undefined : group && !isChecked ? '' : value"
    :id="hiddenInputId"
    :disabled="isDisabled"
    tabindex="-1"
    aria-hidden="true"
    @click="onInputClick"
    @focusin="onInputFocus"
    @invalid="onInputInvalid"
  />
</template>
