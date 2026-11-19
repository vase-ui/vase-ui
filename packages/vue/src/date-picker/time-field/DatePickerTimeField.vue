<script lang="ts">
import type {
  TimeFieldRootProps,
  TimeFieldRootState,
} from '../../time-field/root/TimeFieldRoot.vue';

export interface DatePickerTimeFieldState extends TimeFieldRootState {}

/**
 * The props of `TimeField.Root` that the picker does not own. The root of the picker owns the
 * value, the locale, the hour cycle and the states `disabled` and `readOnly`. The time field gives
 * no value to a form, because the field of the picker does.
 */
export interface DatePickerTimeFieldProps extends Omit<
  TimeFieldRootProps,
  | 'modelValue'
  | 'defaultValue'
  | 'referenceDate'
  | 'granularity'
  | 'hourCycle'
  | 'forceLeadingZeros'
  | 'hideTimeZone'
  | 'locale'
  | 'disabled'
  | 'readOnly'
  | 'required'
  | 'name'
  | 'form'
  | 'autoComplete'
> {}
</script>

<script setup lang="ts">
import { computed, provide, useTemplateRef } from 'vue';
import { FieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { provideLabelableContext } from '../../internals/labelable-provider';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import { useDatePickerRootContext, hasTime } from '../root/DatePickerRootContext';
import type { DatePickerRootValue } from '../root/DatePickerRoot.vue';

import TimeFieldRoot from '../../time-field/root/TimeFieldRoot.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DatePickerTimeFieldProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: DatePickerTimeFieldState }): unknown;
  render: ComponentRenderFn<HTMLProps, DatePickerTimeFieldState>;
}>();

const picker = useDatePickerRootContext();

if (process.env.NODE_ENV !== 'production' && !hasTime(picker.template.value)) {
  throw new Error(
    'Vase UI: <DatePicker.TimeField> needs a picker whose value has a time. Without a time the field has no segments to show. Set `granularity` to `hour`, `minute` or `second`, or give the picker a `Temporal.PlainDateTime` or a `Temporal.ZonedDateTime`.',
  );
}

// The popup is below the field of the picker in the component tree, although a portal moves it in
// the document. This time field is not a control of that field: it takes no id from it, and it
// does not register its input. It also has no label of the field.
provide(FieldRootContext, null);
provideLabelableContext();

function toTimeValue(value: DatePickerRootValue | null) {
  return hasTime(value) ? value : null;
}

const value = computed(() => toTimeValue(picker.value.value));
const template = computed(() => toTimeValue(picker.template.value));
const referenceDate = computed(() => toTimeValue(picker.props.referenceDate ?? null) ?? undefined);

const field = useTemplateRef<{
  element: HTMLElement | null;
  inputElement: HTMLInputElement | null;
  clear: () => void;
}>('field');
const element = computed(() => field.value?.element ?? null);

function timeFieldProps() {
  const root = picker.props;
  const granularity = root.granularity;
  return {
    ...props,
    modelValue: value.value,
    defaultValue: template.value,
    referenceDate: referenceDate.value,
    granularity:
      granularity === 'hour' || granularity === 'minute' || granularity === 'second'
        ? granularity
        : undefined,
    hourCycle: root.hourCycle,
    forceLeadingZeros: root.forceLeadingZeros,
    hideTimeZone: root.hideTimeZone,
    locale: root.locale,
    disabled: picker.disabled.value,
    readOnly: root.readOnly,
  };
}

defineExpose({
  element,
  /** Sets the value to `null` and empties each segment. The reason of the change is `none`. */
  clear: () => field.value?.clear(),
});
</script>

<template>
  <TimeFieldRoot
    v-if="$slots.render"
    ref="field"
    v-bind="{ ...withoutPropsOf($attrs, TimeFieldRoot), ...timeFieldProps() }"
    @value-change="picker.commit"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </TimeFieldRoot>
  <TimeFieldRoot
    v-else
    ref="field"
    v-bind="{ ...withoutPropsOf($attrs, TimeFieldRoot), ...timeFieldProps() }"
    @value-change="picker.commit"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </TimeFieldRoot>
</template>
