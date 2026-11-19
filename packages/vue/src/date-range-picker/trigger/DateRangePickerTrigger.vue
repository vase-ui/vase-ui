<script lang="ts">
import type {
  PopoverTriggerProps,
  PopoverTriggerState,
} from '../../popover/trigger/PopoverTrigger.vue';

export interface DateRangePickerTriggerState extends PopoverTriggerState {}

/**
 * The props of `Popover.Trigger` that a date range picker needs. The trigger belongs to the root of
 * the picker, so it has no handle, no payload and no hover open.
 */
export interface DateRangePickerTriggerProps extends Omit<
  PopoverTriggerProps,
  'handle' | 'payload' | 'openOnHover' | 'delay' | 'closeDelay'
> {}
</script>

<script setup lang="ts">
import { computed, useAttrs, useTemplateRef } from 'vue';
import { usePickerPartElement } from '../../internals/date-time/picker/useDateTimePickerRoot';
import { given } from '../../internals/givenAttributes';
import { formatRangeText } from '../../internals/date-time/calendar/formatText';
import { isKind } from '../../internals/date-time/temporal';
import type { DateValue } from '../../internals/date-time/temporal';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import PopoverTrigger from '../../popover/trigger/PopoverTrigger.vue';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { useDateRangePickerRootContext } from '../root/DateRangePickerRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DateRangePickerTriggerProps>(), {
  as: 'button',
  nativeButton: true,
  disabled: false,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('DateRangePicker.Trigger');
}

defineSlots<{
  default(props: { state: DateRangePickerTriggerState }): unknown;
  render: ComponentRenderFn<HTMLProps, DateRangePickerTriggerState>;
}>();

const attrs = useAttrs();
const picker = useDateRangePickerRootContext();
const locale = useFormatLocale(() => picker.props.locale);

// A picker that the user cannot change has nothing to choose.
const isDisabled = computed(() => props.disabled || picker.disabled.value || picker.props.readOnly);

function describe(start: DateValue, end: DateValue): string {
  return formatRangeText(
    start,
    end,
    isKind(start, 'date')
      ? { dateStyle: 'full' }
      : { dateStyle: 'full', timeStyle: isKind(start, 'zonedDateTime') ? 'long' : 'short' },
    locale.value,
  );
}

// The name of the trigger says what it does and what the range is now. A range that has only one
// end is not chosen yet. A name that the consumer gives replaces it, and `null` removes it. Node
// and a browser can space the two days of a range in another way, so Vue writes the name after the
// hydration.
function label() {
  const ariaLabelValue = attrs['aria-label'];
  if (
    ariaLabelValue === null ||
    (typeof ariaLabelValue === 'string' && given('aria-label', ariaLabelValue) !== undefined)
  ) {
    return ariaLabelValue;
  }
  const [start, end] = picker.value.value;
  return start === null || end === null ? 'Choose dates' : `Change dates, ${describe(start, end)}`;
}

const trigger = useTemplateRef<{ element: HTMLElement | null }>('trigger');
const element = computed(() => trigger.value?.element ?? null);

usePickerPartElement(picker.triggers, element);

defineExpose({ element });
</script>

<template>
  <PopoverTrigger
    v-if="$slots.render"
    ref="trigger"
    v-bind="{ ...withoutPropsOf($attrs, PopoverTrigger), ...props }"
    :disabled="isDisabled"
    :aria-label="label()"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </PopoverTrigger>
  <PopoverTrigger
    v-else
    ref="trigger"
    v-bind="{ ...withoutPropsOf($attrs, PopoverTrigger), ...props }"
    :disabled="isDisabled"
    :aria-label="label()"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </PopoverTrigger>
</template>
