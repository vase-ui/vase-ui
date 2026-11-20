<script lang="ts">
import type { PopoverTriggerProps, PopoverTriggerState } from '../../popover/types';

export interface DatePickerTriggerState extends PopoverTriggerState {}

/**
 * The props of `Popover.Trigger` that a date picker needs. The trigger belongs to the root of the
 * picker, so it has no handle, no payload and no hover open.
 */
export interface DatePickerTriggerProps
  extends
    Omit<
      PopoverTriggerProps,
      'as' | 'aria-label' | 'handle' | 'payload' | 'openOnHover' | 'delay' | 'closeDelay'
    >,
    /* @vue-ignore */ NamedTrigger {}

interface NamedTrigger {
  /** The name of the trigger. With no name the trigger names its action and the value; `null` removes the name. */
  'aria-label'?: string | null;
}
</script>

<script setup lang="ts">
import { computed, useAttrs, useTemplateRef } from 'vue';
import { given } from '../../internals/givenAttributes';
import { formatText } from '../../internals/date-time/calendar/formatText';
import { usePickerPartElement } from '../../internals/date-time/picker/usePickerPartElement';
import { isKind } from '../../internals/date-time/temporal';
import type { DatePickerRootValue } from '../root/DatePickerRoot.vue';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import PopoverTrigger from '../../popover/PopoverTrigger.vue';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { useDatePickerRootContext } from '../root/DatePickerRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DatePickerTriggerProps>(), {
  disabled: false,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('DatePicker.Trigger');
}

defineSlots<{
  default?(scope: { state: DatePickerTriggerState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: DatePickerTriggerState;
  }): unknown;
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

// This part renders `Popover.Trigger` and makes no element of its own.
const trigger = useTemplateRef<{ element: HTMLElement | null }>('trigger');
const element = computed(() => trigger.value?.element ?? null);

usePickerPartElement(picker.triggers, element);

function triggerProps() {
  return { ...props, disabled: isDisabled.value, 'aria-label': label.value ?? undefined };
}

defineExpose({ element });
</script>

<template>
  <PopoverTrigger
    ref="trigger"
    v-bind="{ ...withoutPropsOf($attrs, PopoverTrigger), ...triggerProps() }"
  >
    <template v-if="$slots.element" #element="slotProps">
      <slot name="element" v-bind="slotProps" />
    </template>
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </PopoverTrigger>
</template>
