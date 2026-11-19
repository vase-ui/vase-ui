<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIChangeEventDetails } from '../internals/createVaseUIEventDetails';
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
   * `null` is an empty value, and the group stays controlled.
   *
   * To render an uncontrolled checkbox group, use the `defaultValue` prop instead.
   */
  modelValue?: string[] | null | undefined;
  /**
   * Names of the checkboxes in the group that should be initially ticked.
   * `null` is an empty value.
   *
   * To render a controlled checkbox group, use the `modelValue` prop instead.
   */
  defaultValue?: string[] | null | undefined;
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
import { computed, provide, shallowReactive, watch } from 'vue';
import { areArraysEqual } from '../common/areArraysEqual';
import { EMPTY_ARRAY } from '../common/empty';
import { useControlled } from '../common/useControlled';
import { isEligibleInput } from '../field/root/useFieldValidation';
import { useFieldsetDisabled } from '../fieldset/root/useFieldsetDisabled';
import { fieldValidityMapping } from '../internals/field-constants/constants';
import { createChangeEventDetails } from '../internals/createVaseUIEventDetails';
import { useFieldControl } from '../internals/field-register-control';
import { useClearFieldError, useFieldRootContext } from '../internals/field-root-context';
import { useFormContext } from '../internals/form-context';
import { given } from '../internals/givenAttributes';
import {
  useControlLabelId,
  useLabelableContext,
  useLabelableId,
} from '../internals/labelable-provider';
import type { ComponentRenderFn, HTMLProps } from '../internals/types';
import { useVaseUiId } from '../internals/useVaseUiId';
import { useRenderElement } from '../internals/useRenderElement';
import { useValueChanged } from '../internals/useValueChanged';
import { CheckboxGroupContext } from './checkboxContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CheckboxGroupProps>(), {
  as: 'div',
  modelValue: undefined,
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
  /**
   * Event handler called after `valueChange` with the new value, unless a listener cancels the
   * change. `v-model` uses it.
   */
  'update:modelValue': [value: string[]];
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

const fieldsetDisabled = useFieldsetDisabled(() => element.value);
const isDisabled = computed(() => fieldDisabled.value || fieldsetDisabled.value || props.disabled);

const groupValue = useControlled<string[]>({
  // A consumer can change a reactive array in place. The copy reads each item, so such a change
  // gives the group a new value, and the checkboxes, the field state and the validation follow it.
  // `undefined` makes the part uncontrolled, so only `null` becomes an empty value.
  controlled: () => (props.modelValue === null ? EMPTY_ARRAY : props.modelValue?.slice()),
  default: () => props.defaultValue ?? EMPTY_ARRAY,
  name: 'CheckboxGroup',
  state: 'value',
});

function setValue(nextValue: string[], eventDetails: CheckboxGroupChangeEventDetails) {
  emit('valueChange', nextValue, eventDetails);

  if (eventDetails.isCanceled) {
    return;
  }

  emit('update:modelValue', nextValue);
  groupValue.value = nextValue;
}

// The third parent press restores the last selection from the children.
let childrenValue = groupValue.value;
let status: 'mixed' | 'on' | 'off' = 'mixed';
const disabledStates = new Map<string, boolean>();
const childIds = shallowReactive(new Map<string, readonly string[]>());

const hasParent = computed(() => props.allValues !== undefined);
const parent = computed(() => {
  const values = props.allValues;
  if (!values) return undefined;
  const count = groupValue.value.length;
  return {
    checked: count === values.length,
    indeterminate: count > 0 && count !== values.length,
    controls: values.flatMap((value) => childIds.get(value) ?? EMPTY_ARRAY).join(' ') || undefined,
  };
});

function registerChildId(value: string, id: string) {
  childIds.set(value, [...(childIds.get(value) ?? EMPTY_ARRAY), id]);
  return () => {
    const remaining = childIds.get(value)?.filter((childId) => childId !== id);
    if (remaining?.length) childIds.set(value, remaining);
    else childIds.delete(value);
  };
}

function registerDisabled(value: string, disabled: boolean) {
  disabledStates.set(value, disabled);
  return () => disabledStates.delete(value);
}

function toggleParent(details: CheckboxGroupChangeEventDetails) {
  const values = props.allValues;
  if (!values) return;
  const none = values.filter((value) => disabledStates.get(value) && childrenValue.includes(value));
  const all = values.filter((value) => !disabledStates.get(value) || childrenValue.includes(value));
  if (childrenValue.length === 0 || childrenValue.length === all.length) {
    setValue(groupValue.value.length === all.length ? none : all, details);
    return;
  }

  const next = status === 'mixed' ? 'on' : status === 'on' ? 'off' : 'mixed';
  setValue(next === 'on' ? all : next === 'off' ? none : childrenValue, details);
  if (!details.isCanceled) status = next;
}

function setChildChecked(
  value: string,
  checked: boolean,
  details: CheckboxGroupChangeEventDetails,
) {
  const withParent = hasParent.value;
  let next = groupValue.value.slice();
  if (checked) next.push(value);
  else if (withParent) next.splice(next.indexOf(value), 1);
  else next = next.filter((item) => item !== value);
  setValue(next, details);
  if (withParent && !details.isCanceled) {
    childrenValue = next;
    status = 'mixed';
  }
}

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
useFieldControl(() => validation.getInputControl(), {
  id: fieldControlId,
  value: groupValue,
  getValue: getFormValue,
  enabled: () => !!fieldName.value && !isDisabled.value,
});

watch(groupValue, (value) => setFilled(value.length > 0), { immediate: true });

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

  if (props.modelValue === undefined) {
    const changed = !areArraysEqual(groupValue.value, defaultValue);
    const details = createChangeEventDetails(REASONS.none, event);
    if (changed) setValue(defaultValue.slice(), details);
    if (!details.isCanceled) {
      childrenValue = defaultValue.slice();
      status = 'mixed';
      if (changed) {
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
  setChildChecked,
  toggleParent,
  hasParent,
  registerChildId,
  registerDisabled,
  parent,
  disabled: isDisabled,
  validation,
  registerControlId,
  reset,
});

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: fieldValidityMapping,
  props: (attrs) => [
    { id: given('id', props.id), role: 'group', 'aria-labelledby': labelId.value },
    attrs,
    getDescriptionProps,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
