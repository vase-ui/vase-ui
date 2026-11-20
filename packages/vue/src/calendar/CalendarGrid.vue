<script setup lang="ts">
import { mergeProps, onBeforeUnmount, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { injectRequiredMonth } from './month';
import { injectCalendar, stateAttributes } from './root';
import type { CalendarGridProps, CalendarGridState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<CalendarGridProps>();
defineSlots<{
  default?(scope: { state: CalendarGridState }): unknown;
  element?(scope: ElementSlotProps<CalendarGridState>): unknown;
}>();

const calendar = injectCalendar();
const month = injectRequiredMonth();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

// A month that leaves in a `<Transition>` takes a click and the focus until its leave ends
// (test/measurements/calendar.test.ts). The calendar keeps one tab stop.
onBeforeUnmount(() => element.value?.setAttribute('inert', ''));

defineExpose({ element });

function elementProps() {
  const { state } = calendar;
  const on = (value: boolean) => (value ? 'true' : undefined);
  // A caption names the grid, and the name of the month is the name without one. A name of the
  // developer replaces both. A caption after the grid names it from the mount.
  const named = attrs['aria-label'] != null || attrs['aria-labelledby'] != null;
  return mergeProps(
    {
      role: 'grid',
      'aria-labelledby': named ? undefined : month.captionId,
      'aria-label': attrs['aria-labelledby'] == null ? month.text : undefined,
      'aria-multiselectable': on(calendar.multiselectable),
      'aria-readonly': on(state.readonly),
      'aria-disabled': on(state.disabled),
      ...stateAttributes(state, ['disabled', 'readonly']),
    },
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
    :state="calendar.state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="calendar.state" />
  </component>
  <table v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="calendar.state" />
  </table>
</template>
