<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { formatFieldName } from './pages';
import { injectCalendar, stateAttributes } from './root';
import type { CalendarWeekNumberHeaderProps, CalendarWeekNumberHeaderState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<CalendarWeekNumberHeaderProps>();
defineSlots<{
  default?(scope: { state: CalendarWeekNumberHeaderState }): unknown;
  element?(scope: ElementSlotProps<CalendarWeekNumberHeaderState>): unknown;
}>();

const calendar = injectCalendar();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      scope: 'col',
      'aria-label': formatFieldName('weekOfYear', calendar.locale),
      ...stateAttributes(calendar.state),
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
  <th v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="calendar.state" />
  </th>
</template>
