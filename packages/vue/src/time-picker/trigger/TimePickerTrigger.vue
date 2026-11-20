<script lang="ts">
import type { PopoverTriggerProps, PopoverTriggerState } from '../../popover/types';

export interface TimePickerTriggerState extends PopoverTriggerState {}

/**
 * The props of `Popover.Trigger` that a time picker needs. The trigger belongs to the root of the
 * picker, so it has no handle, no payload and no hover open.
 */
export interface TimePickerTriggerProps
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
import { useAriaAfterHydration } from '../../common/hydration';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import PopoverTrigger from '../../popover/PopoverTrigger.vue';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { useTimePickerRootContext } from '../root/TimePickerRootContext';
import type { TimePickerRootValue } from '../root/TimePickerRoot.vue';
import { hourCycleOption } from '../utils/useTimePickerFormat';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimePickerTriggerProps>(), {
  disabled: false,
});

defineSlots<{
  default?(scope: { state: TimePickerTriggerState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: TimePickerTriggerState;
  }): unknown;
}>();

const attrs = useAttrs();
// Node and a browser can give another `Intl` text, and Vue keeps the text of the server while it
// hydrates.
const afterHydration = useAriaAfterHydration();
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

// This part renders `Popover.Trigger` and makes no element of its own.
const trigger = useTemplateRef<{ element: HTMLElement | null }>('trigger');
const element = computed(() => trigger.value?.element ?? null);

usePickerPartElement(picker.triggers, element);

function triggerProps() {
  return {
    ...props,
    disabled: isDisabled.value,
    'aria-label': afterHydration(label.value) ?? undefined,
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
