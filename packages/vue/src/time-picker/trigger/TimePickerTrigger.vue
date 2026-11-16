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
import { givenName } from '../../internals/blankName';
import { formatText } from '../../internals/date-time/calendar/formatText';
import { isKind } from '../../internals/date-time/temporal';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
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

defineSlots<{
  default(props: { state: TimePickerTriggerState }): unknown;
  render: ComponentRenderFn<HTMLProps, TimePickerTriggerState>;
}>();

const attrs = useAttrs();
const picker = useTimePickerRootContext();
const locale = useFormatLocale(() => picker.props.locale);

// A picker that the user cannot change has nothing to choose.
const disabled = computed(() => props.disabled || picker.disabled.value || picker.readOnly.value);

// The name has the time and not the date, because the picker sets the time. A value in a time zone
// also has the name of the zone, and a field that shows seconds also has the seconds.
function describe(value: TimePickerRootValue): string {
  const timeStyle = isKind(value, 'zonedDateTime')
    ? 'long'
    : picker.props.granularity === 'second'
      ? 'medium'
      : 'short';
  return formatText(
    value,
    { timeStyle, hourCycle: hourCycleOption(picker.props.hourCycle) },
    locale.value,
  );
}

// The name of the trigger says what it does and what the value is now. A name that the consumer
// gives replaces it, and `null` removes it.
const label = computed(() => {
  const given = attrs['aria-label'];
  if (given === null || (typeof given === 'string' && givenName(given) !== undefined)) {
    return given;
  }
  const value = picker.value.value;
  return value === null ? 'Choose time' : `Change time, ${describe(value)}`;
});

// This part renders `Popover.Trigger` and makes no element of its own. The template has one form
// for `#render` and one for the content. A `v-if` on a slot template makes the slots of
// `Popover.Trigger` dynamic. Vue then renders `Popover.Trigger` again each time this part renders.
const trigger = useTemplateRef<{ element: HTMLElement | null }>('trigger');
const element = computed(() => trigger.value?.element ?? null);

function triggerProps() {
  return { ...attrs, ...props, disabled: disabled.value, 'aria-label': label.value };
}

defineExpose({ element });
</script>

<template>
  <PopoverTrigger v-if="$slots.render" ref="trigger" v-bind="triggerProps()">
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </PopoverTrigger>
  <PopoverTrigger v-else ref="trigger" v-bind="triggerProps()">
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </PopoverTrigger>
</template>
