<script setup lang="ts" generic="Value extends DateValue = Temporal.PlainDate">
import { computed, mergeProps, provide, useAttrs } from 'vue';
import { calendarKey, useCalendar } from '../calendar/root';
import { useElement, type ElementSlotProps } from '../common/element';
import { assertTemporal } from '../common/date-time/temporal';
import type { DateValue } from '../common/date-time/temporal';
import { useRange } from './range';
import type {
  RangeCalendarRootEmits,
  RangeCalendarRootProps,
  RangeCalendarRootState,
} from './types';

defineOptions({ inheritAttrs: false });

assertTemporal('RangeCalendar.Root');

const props = withDefaults(defineProps<RangeCalendarRootProps<Value>>(), {
  modelValue: undefined,
  defaultValue: undefined,
  month: undefined,
  focusedDate: undefined,
  showOutsideDays: undefined,
});
const emit = defineEmits<RangeCalendarRootEmits<Value>>();
defineSlots<{
  default?(scope: { state: RangeCalendarRootState }): unknown;
  element?(scope: ElementSlotProps<RangeCalendarRootState>): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const range = useRange(
  props,
  emit as (event: 'valueChange' | 'update:modelValue', ...args: unknown[]) => void,
);
const {
  calendar: forParts,
  rootState,
  focus,
  rootProps,
  dayAt,
} = useCalendar(props, {
  part: 'RangeCalendar.Root',
  emit,
  element,
  views: false,
  selection: range.selection,
  dayButtonProps: (day) => range.dayButtonProps(day, dayAt),
  onTargetRemoved: (target) => range.dropDragOf(target.element),
});
provide(calendarKey, forParts);

const state = computed<RangeCalendarRootState>(() => ({
  ...rootState.value,
  selecting: range.selecting.value,
}));

defineExpose({
  element,
  /** Focuses the day that has the tab stop. With `date`, shows its page and focuses it, when it can take the focus. */
  focus,
});

// The root handles Escape for each element in it, such as a navigation button.
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') range.cancel(event);
}

function elementProps() {
  return mergeProps(
    rootProps(),
    { 'data-selecting': state.value.selecting ? '' : undefined, onKeydown },
    attrs,
  );
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
