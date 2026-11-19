<script lang="ts">
import type {
  PopoverTriggerProps,
  PopoverTriggerState,
} from '../../popover/trigger/PopoverTrigger.vue';

export interface DatePickerTriggerState extends PopoverTriggerState {}

/**
 * The props of `Popover.Trigger` that a date picker needs. The trigger belongs to the root of the
 * picker, so it has no handle, no payload and no hover open.
 */
export interface DatePickerTriggerProps extends Omit<
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
import type { DatePickerRootValue } from '../root/DatePickerRoot.vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import PopoverTrigger from '../../popover/trigger/PopoverTrigger.vue';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { useDatePickerRootContext } from '../root/DatePickerRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DatePickerTriggerProps>(), {
  as: 'button',
  nativeButton: true,
  disabled: false,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('DatePicker.Trigger');
}

defineSlots<{
  default(props: { state: DatePickerTriggerState }): unknown;
  render: ComponentRenderFn<HTMLProps, DatePickerTriggerState>;
}>();

const attrs = useAttrs();
const picker = useDatePickerRootContext();
const locale = useFormatLocale(() => picker.props.locale);

// A picker that the user cannot change has nothing to choose.
const isDisabled = computed(() => props.disabled || picker.disabled.value || picker.props.readOnly);

function describe(value: DatePickerRootValue): string {
  if (isKind(value, 'yearMonth')) {
    return formatText(value, { month: 'long', year: 'numeric' }, locale.value);
  }
  return formatText(
    value,
    isKind(value, 'date')
      ? { dateStyle: 'full' }
      : { dateStyle: 'full', timeStyle: isKind(value, 'zonedDateTime') ? 'long' : 'short' },
    locale.value,
  );
}

// The name of the trigger says what it does and what the value is now. A name that the consumer
// gives replaces it, and `null` removes it.
const label = computed(() => {
  const ariaLabel = attrs['aria-label'];
  if (
    ariaLabel === null ||
    (typeof ariaLabel === 'string' && given('aria-label', ariaLabel) !== undefined)
  ) {
    return ariaLabel;
  }
  const value = picker.value.value;
  return value === null ? 'Choose date' : `Change date, ${describe(value)}`;
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
