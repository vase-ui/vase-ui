<script setup lang="ts">
import { computed, mergeProps, provide, shallowRef, useAttrs } from 'vue';
import { createError } from '../common/createError';
import type { DateTimeFieldChangeEventDetails } from '../common/date-time-field/field';
import type { FieldRootExposed } from '../common/picker/field';
import { fieldKey } from '../field/control';
import TimeFieldRoot from '../time-field/TimeFieldRoot.vue';
import { injectDatePicker } from './root';
import { hasTime } from './template';
import type { DatePickerTimeFieldProps, DatePickerTimeFieldState } from './types';

type TimeValue = Temporal.PlainDateTime | Temporal.ZonedDateTime;

defineOptions({ inheritAttrs: false });

defineProps<DatePickerTimeFieldProps>();
defineSlots<{ default?(scope: { state: DatePickerTimeFieldState }): unknown }>();

const picker = injectDatePicker('TimeField');
const attrs = useAttrs();
const field = shallowRef<FieldRootExposed | null>(null);
function setField(value: unknown) {
  field.value = value as FieldRootExposed | null;
}

if (process.env.NODE_ENV !== 'production' && !hasTime(picker.template)) {
  throw createError(21);
}

// A portal moves the popup out of a `Field` of the picker, and the field of the picker is its
// control. This field is no control of it.
provide(fieldKey, null);

const timeOf = (value: unknown) =>
  value && hasTime(value as TimeValue) ? (value as TimeValue) : null;

function fieldProps() {
  const root = picker.props;
  const { granularity } = root;
  return mergeProps(attrs, {
    modelValue: timeOf(picker.value),
    defaultValue: timeOf(picker.template),
    referenceDate: timeOf(root.referenceDate) ?? undefined,
    granularity:
      granularity === 'hour' || granularity === 'minute' || granularity === 'second'
        ? granularity
        : undefined,
    hourCycle: root.hourCycle,
    forceLeadingZeros: root.forceLeadingZeros,
    hideTimeZone: root.hideTimeZone,
    locale: root.locale,
    disabled: picker.disabled,
    readonly: root.readonly,
    required: undefined,
    name: undefined,
    form: undefined,
    autocomplete: undefined,
    onValueChange: (value: TimeValue | null, details: DateTimeFieldChangeEventDetails) =>
      picker.commit(value, details),
  });
}

defineExpose({
  element: computed(() => field.value?.element ?? null),
  /** Empties each segment. `update:modelValue` follows when the picker had a value. */
  clear() {
    field.value?.clear();
    picker.set(null);
  },
});
</script>

<template>
  <TimeFieldRoot :ref="setField" v-bind="fieldProps()">
    <template #default="{ state }">
      <slot :state="state" />
    </template>
  </TimeFieldRoot>
</template>
