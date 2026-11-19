<script lang="ts">
import type { ComputedRef, HTMLAttributes, InjectionKey } from 'vue';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import * as SwitchRootDataAttributes from './SwitchRootDataAttributes';
import type { VaseUIChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import type { FieldRootState } from '../../internals/field-root-context/FieldRootContext';
import { REASONS } from '../../internals/reasons';
import type {
  NonNativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';

export interface SwitchRootState extends FieldRootState {
  /**
   * Whether the switch is currently active.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to activate or deactivate the switch.
   */
  readOnly: boolean;
  /**
   * Whether the user must activate the switch before submitting a form.
   */
  required: boolean;
}

export interface SwitchRootProps
  extends
    NonNativeButtonProps,
    VaseUIComponentProps<SwitchRootState>,
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
   * Whether the switch is currently active.
   *
   * To render an uncontrolled switch, use the `defaultChecked` prop instead.
   */
  modelValue?: boolean | undefined;
  /**
   * Whether the switch is initially active.
   *
   * To render a controlled switch, use the `modelValue` prop instead.
   * @default false
   */
  defaultChecked?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the hidden input.
   * Useful when the switch is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * Whether the user should be unable to activate or deactivate the switch.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must activate the switch before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * The value submitted with the form when the switch is on.
   * By default, switch submits the "on" value, matching native checkbox behavior.
   */
  value?: string | undefined;
  /**
   * The value submitted with the form when the switch is off.
   * By default, unchecked switches do not submit any value, matching native checkbox behavior.
   */
  uncheckedValue?: string | undefined;
  /**
   * The accessible name of the switch. With a name here, no label names the switch.
   */
  ariaLabel?: string | undefined;
  /**
   * The ids of the elements that name the switch. They replace the label of the switch.
   */
  ariaLabelledby?: string | undefined;
}

export type SwitchRootChangeEventReason = typeof REASONS.none;
export type SwitchRootChangeEventDetails = VaseUIChangeEventDetails<SwitchRootChangeEventReason>;
export const SwitchRootContext: InjectionKey<ComputedRef<SwitchRootState>> = Symbol();

export const stateAttributesMapping: StateAttributesMapping<SwitchRootState> = {
  ...fieldValidityMapping,
  checked(value) {
    return { [value ? SwitchRootDataAttributes.checked : SwitchRootDataAttributes.unchecked]: '' };
  },
};
</script>

<script setup lang="ts">
import { computed, provide, shallowRef, watch } from 'vue';
import { useAriaAfterHydration } from '../../common/hydration';
import { useControlled } from '../../common/useControlled';
import { useFieldsetDisabled } from '../../fieldset/root/useFieldsetDisabled';
import { useCheckedInput } from '../../internals/useCheckedInput';
import { visuallyHiddenInput, visuallyHiddenInputPinned } from '../../common/visuallyHidden';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { useFieldControl } from '../../internals/field-register-control';
import { useClearFieldError, useFieldRootContext } from '../../internals/field-root-context';
import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
import { useFormContext } from '../../internals/form-context';
import { given } from '../../internals/givenAttributes';
import {
  useAriaLabelledBy,
  useControlLabelId,
  useLabelableId,
} from '../../internals/labelable-provider';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button/useButton';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useFormReset } from '../../internals/useFormReset';
import { useRenderElement } from '../../internals/useRenderElement';
import { useValueChanged } from '../../internals/useValueChanged';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SwitchRootProps>(), {
  as: 'span',
  modelValue: undefined,
  defaultChecked: false,
  disabled: false,
  nativeButton: false,
  readOnly: false,
  required: false,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Switch.Root');
}

const emit = defineEmits<{
  /**
   * Event handler called when the switch is activated or deactivated.
   */
  checkedChange: [checked: boolean, eventDetails: SwitchRootChangeEventDetails];
  /**
   * Event handler called after `checkedChange` with the new value, unless a listener cancels the
   * change. `v-model` uses it.
   */
  'update:modelValue': [checked: boolean];
}>();

defineSlots<{
  default(props: { state: SwitchRootState }): unknown;
  render: ComponentRenderFn<HTMLProps, SwitchRootState>;
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
  validation,
} = useFieldRootContext();

const fieldsetDisabled = useFieldsetDisabled(() => element.value);
const isDisabled = computed(() => fieldDisabled.value || fieldsetDisabled.value || props.disabled);

const inputElement = shallowRef<HTMLInputElement | null>(null);
// The field must receive this input before the next control registers during the same patch.
function setInputElement(node: unknown) {
  inputElement.value = node as HTMLInputElement | null;
}
const setFocused = useSetFieldFocused(isDisabled, () => element.value);

const rootId = useVaseUiId();
const controlId = useLabelableId({
  id: () => props.id,
  element: () => (props.nativeButton ? element.value : null),
});
const hiddenInputId = computed(() => (props.nativeButton ? undefined : controlId.value));

const isChecked = useControlled({
  controlled: () => props.modelValue,
  default: () => props.defaultChecked,
  name: 'Switch',
  state: 'checked',
});

const { name: inputName } = useFieldControl(() => element.value, {
  input: inputElement,
  id: rootId,
  name: () => props.name,
  value: isChecked,
  enabled: () => !isDisabled.value,
});
const clearFieldError = useClearFieldError(inputName);

watch(isChecked, setFilled, { immediate: true });

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

const ariaLabelledBy = useAriaLabelledBy(
  () => props.ariaLabelledby,
  useControlLabelId(),
  inputElement,
  () => !props.nativeButton,
  hiddenInputId,
  () => props.ariaLabel,
);

function requestChange(nextChecked: boolean, event?: Event) {
  const details = createChangeEventDetails(REASONS.none, event);

  emit('checkedChange', nextChecked, details);

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
    acceptClick: (checked, event) => !props.readOnly && requestChange(checked, event),
    takeRestored(checked, event) {
      if (!props.readOnly && !isDisabled.value) requestChange(checked, event);
    },
  },
);

useFormReset(inputElement, (event) => {
  const hasChanged =
    props.modelValue === undefined &&
    isChecked.value !== props.defaultChecked &&
    requestChange(props.defaultChecked, event);

  if (hasChanged) {
    isResetChangePending = true;
  } else {
    clearFieldError(isChecked.value);
  }
});

const state = computed<SwitchRootState>(() => ({
  ...fieldState.value,
  checked: isChecked.value,
  disabled: isDisabled.value,
  readOnly: props.readOnly,
  required: props.required,
}));

provide(SwitchRootContext, state);

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
      role: 'switch',
      'aria-checked': isChecked.value,
      'aria-readonly': props.readOnly || undefined,
      'aria-required': props.required || undefined,
      'aria-label': given('aria-label', props.ariaLabel),
      'aria-labelledby': ariaLabelledBy.value,
      onFocusin() {
        setFocused(true);
      },
      onFocusout() {
        const input = inputElement.value;
        if (!input || isDisabled.value) {
          return;
        }

        setTouched(true);
        setFocused(false);

        if (validationMode.value === 'onBlur') {
          void validation.commit(input.checked);
        }
      },
      onClick(event: MouseEvent) {
        if (props.readOnly || isDisabled.value) {
          return;
        }

        activate(event);
      },
    },
    attrs,
    (merged) => validation.getValidationProps(isDisabled.value, merged),
  ],
});

const inputValidation = computed(() => validation.getValidationProps(isDisabled.value));

defineExpose({ element, inputElement });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
  <input
    v-if="!isChecked && inputName && uncheckedValue !== undefined"
    type="hidden"
    :form="form"
    :name="inputName"
    :value="uncheckedValue"
    :disabled="isDisabled"
  />
  <input
    :ref="setInputElement"
    type="checkbox"
    v-bind="{ ...inputValidation, ...checkedProps }"
    :aria-describedby="ariaAfterHydration(inputValidation['aria-describedby'])"
    :name="inputName"
    :form="form"
    :required="required"
    :style="inputName ? visuallyHiddenInput : visuallyHiddenInputPinned"
    :value="value"
    :id="hiddenInputId"
    :disabled="isDisabled"
    tabindex="-1"
    aria-hidden="true"
    @click="onInputClick"
    @focusin="onInputFocus"
    @invalid="onInputInvalid"
  />
</template>
