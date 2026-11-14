<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { FieldRootState } from '../internals/field-root-context/FieldRootContext';
import { REASONS } from '../internals/reasons';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../internals/types';

export interface CheckboxGroupState extends FieldRootState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface CheckboxGroupProps
  extends
    VaseUIComponentProps<CheckboxGroupState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id'> {
  /**
   * The id of the element of the group.
   */
  id?: string | undefined;
  /**
   * Names of the checkboxes in the group that should be ticked.
   *
   * To render an uncontrolled checkbox group, use the `defaultValue` prop instead.
   */
  value?: string[] | undefined;
  /**
   * Names of the checkboxes in the group that should be initially ticked.
   *
   * To render a controlled checkbox group, use the `value` prop instead.
   */
  defaultValue?: string[] | undefined;
  /**
   * Names of all checkboxes in the group. Use this when creating a parent checkbox.
   */
  allValues?: string[] | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type CheckboxGroupChangeEventReason = typeof REASONS.none;

export type CheckboxGroupChangeEventDetails =
  VaseUIChangeEventDetails<CheckboxGroupChangeEventReason>;
</script>

<script setup lang="ts">
import { computed, provide, watch } from 'vue';
import { areArraysEqual } from '../common/areArraysEqual';
import { EMPTY_ARRAY } from '../common/empty';
import { useControlled } from '../common/useControlled';
import { isEligibleInput } from '../field/root/useFieldValidation';
import { fieldValidityMapping } from '../internals/field-constants/constants';
import { createChangeEventDetails } from '../internals/createBaseUIEventDetails';
import { useRegisterFieldControl } from '../internals/field-register-control';
import { useClearFieldError, useFieldRootContext } from '../internals/field-root-context';
import { useFormContext } from '../internals/form-context';
import {
  useControlLabelId,
  useLabelableContext,
  useLabelableId,
} from '../internals/labelable-provider';
import type { ComponentRenderFn, HTMLProps } from '../internals/types';
import { useVaseUiId } from '../internals/useBaseUiId';
import { useRenderElement } from '../internals/useRenderElement';
import { useValueChanged } from '../internals/useValueChanged';
import { CheckboxGroupContext } from './CheckboxGroupContext';
import { useCheckboxGroupParent } from './useCheckboxGroupParent';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CheckboxGroupProps>(), {
  as: 'div',
  value: undefined,
  defaultValue: undefined,
  allValues: undefined,
  disabled: false,
});

const emit = defineEmits<{
  /**
   * Event handler called when a checkbox in the group is ticked or unticked.
   * Provides the new value as an argument.
   */
  valueChange: [value: string[], eventDetails: CheckboxGroupChangeEventDetails];
  'update:value': [value: string[]];
}>();

defineSlots<{
  default(props: { state: CheckboxGroupState }): unknown;
  render: ComponentRenderFn<HTMLProps, CheckboxGroupState>;
}>();

const {
  disabled: fieldDisabled,
  name: fieldName,
  state: fieldState,
  validation,
  setFilled,
  setDirty,
  validityData,
} = useFieldRootContext();
const { getDescriptionProps, registerControlId } = useLabelableContext();
// The group binds the id of a label that can come after it.
const labelId = useControlLabelId();
const { clearErrors, elementRef: formElement } = useFormContext();
const clearFieldError = useClearFieldError(fieldName);

const isDisabled = computed(() => fieldDisabled.value || props.disabled);

const [groupValue, setGroupValueState] = useControlled<string[]>({
  // A consumer can change a reactive array in place. The copy reads each item, so such a change
  // gives the group a new value, and the checkboxes, the field state and the validation follow it.
  controlled: () => props.value?.slice(),
  default: () => props.defaultValue ?? EMPTY_ARRAY,
  name: 'CheckboxGroup',
  state: 'value',
});

function setValue(nextValue: string[], eventDetails: CheckboxGroupChangeEventDetails) {
  emit('valueChange', nextValue, eventDetails);

  if (eventDetails.isCanceled) {
    return;
  }

  emit('update:value', nextValue);
  setGroupValueState(nextValue);
}

const parent = useCheckboxGroupParent({
  allValues: () => props.allValues,
  value: groupValue,
  onValueChange: setValue,
});

// The group is the control of the field and takes its name from `aria-labelledby`, so `Field.Label`
// must not point `for` at one checkbox of the group.
useLabelableId({ id: null });

const fieldControlId = useVaseUiId(() => props.id);

// The form gets the checked inputs that it can submit. A selected value that no mounted checkbox
// has stays in the state of the group, and it stays out of the form.
function getFormValue() {
  const form = formElement.value;
  if (!form) {
    return groupValue.value;
  }

  const successfulValues = new Set<string>();
  for (const [input, registration] of validation.registeredInputs) {
    if (registration.value !== undefined && input.checked && isEligibleInput(input, form)) {
      successfulValues.add(registration.value);
    }
  }

  return groupValue.value.filter((inputValue) => successfulValues.has(inputValue));
}

// The registration has no `name`. The field takes a registered name as its own name when its `name`
// prop is absent. The name that the group reads from the field would then keep itself.
useRegisterFieldControl(
  () => validation.getInputControl(),
  fieldControlId,
  () => groupValue.value,
  getFormValue,
  () => !!fieldName.value && !isDisabled.value,
);

// A server runs the `setup` of a checkbox after it wrote the parts that come after the group, so
// the group sets the first `filled` state itself.
setFilled(groupValue.value.length > 0);
watch(groupValue, (value) => setFilled(value.length > 0));

// The change of a reset reaches `useValueChanged` after the reset timeout. A clear in the timeout
// would come before `validation.change`, and the validation could show a new error. The timeout
// sets this flag, and the callback clears the field and starts no validation.
let isResetChangePending = false;

useValueChanged(groupValue, () => {
  clearErrors(fieldName.value);

  const initialValue = Array.isArray(validityData.value.initialValue)
    ? (validityData.value.initialValue as readonly string[])
    : EMPTY_ARRAY;
  setDirty(!areArraysEqual(groupValue.value, initialValue));

  if (isResetChangePending) {
    isResetChangePending = false;
    clearFieldError(groupValue.value);
    return;
  }

  validation.change(groupValue.value);
});

let handledReset: Event | undefined;

function reset(event: Event) {
  if (event === handledReset) {
    return;
  }
  handledReset = event;

  const defaultValue = props.defaultValue ?? EMPTY_ARRAY;

  if (props.value === undefined) {
    if (areArraysEqual(groupValue.value, defaultValue)) {
      parent.reset(defaultValue.slice());
    } else {
      const details = createChangeEventDetails(REASONS.none, event);
      setValue(defaultValue.slice(), details);

      if (!details.isCanceled) {
        parent.reset(defaultValue.slice());
        isResetChangePending = true;
        return;
      }
    }
  }

  clearFieldError(groupValue.value);
}

const state = computed<CheckboxGroupState>(() => ({
  ...fieldState.value,
  disabled: isDisabled.value,
}));

provide(CheckboxGroupContext, {
  value: groupValue,
  setValue,
  allValues: computed(() => props.allValues),
  parent,
  disabled: isDisabled,
  validation,
  registerControlId,
  reset,
});

const { element, elementProps } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: fieldValidityMapping,
  props: (attrs) => [
    { id: props.id, role: 'group', 'aria-labelledby': labelId.value },
    attrs,
    getDescriptionProps,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
