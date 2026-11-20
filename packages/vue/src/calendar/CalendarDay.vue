<script setup lang="ts">
import { computed, mergeProps, provide, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { dayAttributes } from './days';
import { dayKey, injectRequiredMonth } from './month';
import { injectCalendar } from './root';
import type { CalendarDayProps, CalendarDayState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<CalendarDayProps>();
defineSlots<{
  default?(scope: { state: CalendarDayState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: CalendarDayState;
  }): unknown;
}>();

const calendar = injectCalendar();
const month = injectRequiredMonth();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const state = computed(() => calendar.dayState(props.day, month.page));

provide(dayKey, {
  get day() {
    return props.day;
  },
  get state() {
    return state.value;
  },
});

defineExpose({ element });

function elementProps() {
  const { value } = state;
  const on = (is: boolean) => (is ? '' : undefined);
  return mergeProps(
    {
      role: 'gridcell',
      'aria-selected': value.hidden ? undefined : String(value.selected),
      // `aria-disabled` is also on an unavailable day, so a disabled day keeps `data-disabled`.
      'aria-disabled': value.disabled || value.unavailable ? 'true' : undefined,
      'data-disabled': on(value.disabled),
      'data-hidden': on(value.hidden),
      'data-today': on(value.today),
      ...dayAttributes(value),
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
    :state="state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <td v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </td>
</template>
