<script lang="ts">
import type { TimeFieldRootProps, TimeFieldRootState } from '../../time-field/types';

export interface TimePickerFieldState extends TimeFieldRootState {}

/**
 * The props of `TimeField.Root` that the picker does not own. The root of the picker owns the
 * value, the granularity, the hour cycle, the limits, the locale and the props of the form.
 */
export interface TimePickerFieldProps extends Omit<
  TimeFieldRootProps,
  | 'modelValue'
  | 'defaultValue'
  | 'referenceDate'
  | 'granularity'
  | 'hourCycle'
  | 'forceLeadingZeros'
  | 'hideTimeZone'
  | 'min'
  | 'max'
  | 'locale'
  | 'disabled'
  | 'readonly'
  | 'required'
  | 'name'
  | 'form'
> {}
</script>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { usePickerPartElement } from '../../internals/date-time/picker/usePickerPartElement';
import { usePickerPopup } from '../../internals/date-time/picker/usePickerPopup';
import { givenAttributes } from '../../internals/givenAttributes';
import { REASONS } from '../../internals/reasons';
import { useFormReset } from '../../internals/useFormReset';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import { mergeProps } from '../../merge-props';
import TimeFieldRoot from '../../time-field/TimeFieldRoot.vue';
import { useTimePickerRootContext } from '../root/TimePickerRootContext';
import type {
  TimePickerRootChangeEventDetails,
  TimePickerRootValue,
} from '../root/TimePickerRoot.vue';

defineOptions({ inheritAttrs: false });

const props = defineProps<TimePickerFieldProps>();

defineSlots<{
  default(props: { state: TimePickerFieldState }): unknown;
}>();

const picker = useTimePickerRootContext();
const popup = usePickerPopup();

interface TimeFieldActions {
  element: HTMLElement | null;
  inputElement: HTMLInputElement | null;
  clear: () => void;
}

// This part renders `TimeField.Root` and makes no element of its own.
const field = useTemplateRef<TimeFieldActions>('field');
const element = computed(() => field.value?.element ?? null);
const inputElement = computed(() => field.value?.inputElement ?? null);

usePickerPartElement(picker.fields, element);

// The field holds the input of the form, so it hears about the reset.
useFormReset(inputElement, (event) => {
  picker.reset(createChangeEventDetails(REASONS.none, event));
});

function handleKeydown(event: KeyboardEvent) {
  if (
    event.altKey &&
    event.key === 'ArrowDown' &&
    !event.defaultPrevented &&
    !picker.disabled.value &&
    !picker.readOnly.value
  ) {
    event.preventDefault();
    popup.openByKey(event);
  }
}

function handleValueChange(
  value: TimePickerRootValue | null,
  details: TimePickerRootChangeEventDetails,
) {
  picker.commit(value, details);
}

const fieldHandlers = { onKeydown: handleKeydown };

function fieldProps(attributes: Record<string, unknown>) {
  const root = picker.props;
  return {
    ...mergeProps(fieldHandlers, givenAttributes(attributes)),
    ...props,
    modelValue: picker.value.value,
    // The default value gives the kind of a new value, the same kind as for each other part.
    defaultValue: picker.template.value,
    referenceDate: root.referenceDate,
    granularity: root.granularity,
    hourCycle: root.hourCycle,
    forceLeadingZeros: root.forceLeadingZeros,
    hideTimeZone: root.hideTimeZone,
    min: root.minTime,
    max: root.maxTime,
    locale: root.locale,
    disabled: root.disabled,
    readonly: root.readOnly,
    required: root.required,
    name: root.name,
    form: root.form,
  };
}

// `clear()` of the field root gives only `update:modelValue`, so the part commits the change.
function clear() {
  field.value?.clear();
  if (picker.value.value !== null) handleValueChange(null, createChangeEventDetails(REASONS.none));
}

defineExpose({
  element,
  inputElement,
  /** Sets the value to `null` and empties each segment. The reason of the change is `none`. */
  clear,
});
</script>

<template>
  <TimeFieldRoot
    ref="field"
    v-bind="fieldProps(withoutPropsOf($attrs, TimeFieldRoot))"
    @value-change="handleValueChange"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </TimeFieldRoot>
</template>
