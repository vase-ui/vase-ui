<script lang="ts">
import type {
  PopoverTriggerProps,
  PopoverTriggerState,
} from '../../popover/trigger/PopoverTrigger.vue';

export interface TimePickerTriggerState extends PopoverTriggerState {}

/**
 * The props of `Popover.Trigger` that a time picker needs. The trigger belongs to the root of the
 * picker, so it has no handle, no payload and no hover open.
 */
export interface TimePickerTriggerProps extends Omit<
  PopoverTriggerProps,
  'handle' | 'payload' | 'openOnHover' | 'delay' | 'closeDelay'
> {}
</script>

<script setup lang="ts">
import { computed, useAttrs, useTemplateRef } from 'vue';
import { given } from '../../internals/givenAttributes';
import { formatText } from '../../internals/date-time/calendar/formatText';
import { usePickerPartElement } from '../../internals/date-time/picker/useDateTimePickerRoot';
import { isKind } from '../../internals/date-time/temporal';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import PopoverTrigger from '../../popover/trigger/PopoverTrigger.vue';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { useTimePickerRootContext } from '../root/TimePickerRootContext';
import type { TimePickerRootValue } from '../root/TimePickerRoot.vue';
import { hourCycleOption } from '../utils/useTimePickerFormat';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimePickerTriggerProps>(), {
  as: 'button',
  nativeButton: true,
  disabled: false,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('TimePicker.Trigger');
}

defineSlots<{
  default(props: { state: TimePickerTriggerState }): unknown;
  render: ComponentRenderFn<HTMLProps, TimePickerTriggerState>;
}>();

const attrs = useAttrs();
const picker = useTimePickerRootContext();
const locale = useFormatLocale(() => picker.props.locale);

// A picker that the user cannot change has nothing to choose.
const isDisabled = computed(() => props.disabled || picker.disabled.value || picker.readOnly.value);

// The name has the time and not the date, because the picker sets the time. It has the seconds for
// a granularity of seconds, and the name of the time zone for a value in a time zone.
function describe(value: TimePickerRootValue): string {
  return formatText(
    value,
    {
      hour: 'numeric',
      minute: '2-digit',
      second: picker.props.granularity === 'second' ? '2-digit' : undefined,
      timeZoneName: isKind(value, 'zonedDateTime') ? 'short' : undefined,
      hourCycle: hourCycleOption(picker.props.hourCycle),
    },
    locale.value,
  );
}

// The name of the trigger says what it does and what the value is now. A name that the consumer
// gives replaces it, and `null` removes it.
const label = computed(() => {
  const ariaLabelValue = attrs['aria-label'];
  if (
    ariaLabelValue === null ||
    (typeof ariaLabelValue === 'string' && given('aria-label', ariaLabelValue) !== undefined)
  ) {
    return ariaLabelValue;
  }
  const value = picker.value.value;
  // A server and a browser can have another `Intl` text, and Vue writes no attribute of a `v-bind`
  // object while it hydrates.
  return value === null ? 'Choose time' : `Change time, ${describe(value)}`;
});

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
    :aria-label="label"
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
    :aria-label="label"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </PopoverTrigger>
</template>
