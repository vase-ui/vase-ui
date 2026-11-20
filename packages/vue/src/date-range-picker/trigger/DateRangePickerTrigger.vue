<script lang="ts">
import type { PopoverTriggerProps, PopoverTriggerState } from '../../popover/types';

export interface DateRangePickerTriggerState extends PopoverTriggerState {}

/**
 * The props of `Popover.Trigger` that a date range picker needs. The trigger belongs to the root of
 * the picker, so it has no handle, no payload and no hover open.
 */
export interface DateRangePickerTriggerProps
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
import { usePickerPartElement } from '../../internals/date-time/picker/usePickerPartElement';
import { given } from '../../internals/givenAttributes';
import { formatRangeText } from '../../internals/date-time/calendar/formatText';
import { isKind } from '../../internals/date-time/temporal';
import type { DateValue } from '../../internals/date-time/temporal';
import { useAriaAfterHydration } from '../../common/hydration';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import PopoverTrigger from '../../popover/PopoverTrigger.vue';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { useDateRangePickerRootContext } from '../root/DateRangePickerRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DateRangePickerTriggerProps>(), {
  disabled: false,
});

defineSlots<{
  default?(scope: { state: DateRangePickerTriggerState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: DateRangePickerTriggerState;
  }): unknown;
}>();

const attrs = useAttrs();
// Node and a browser can give another `Intl` text, and Vue keeps the text of the server while it
// hydrates.
const afterHydration = useAriaAfterHydration();
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
  const [start, end] = picker.range.value;
  return start === null || end === null ? 'Choose dates' : `Change dates, ${describe(start, end)}`;
}

// This part renders `Popover.Trigger` and makes no element of its own.
const trigger = useTemplateRef<{ element: HTMLElement | null }>('trigger');
const element = computed(() => trigger.value?.element ?? null);

usePickerPartElement(picker.triggers, element);

function triggerProps() {
  return {
    ...props,
    disabled: isDisabled.value,
    'aria-label': afterHydration(label()) ?? undefined,
  };
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
