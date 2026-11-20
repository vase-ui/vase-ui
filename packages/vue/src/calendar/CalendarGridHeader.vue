<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { injectCalendar, stateAttributes } from './root';
import type { CalendarGridHeaderProps, CalendarGridHeaderState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<CalendarGridHeaderProps>();
defineSlots<{
  default?(scope: { state: CalendarGridHeaderState }): unknown;
  element?(scope: ElementSlotProps<CalendarGridHeaderState>): unknown;
}>();

const calendar = injectCalendar();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

defineExpose({ element });

function elementProps() {
  return mergeProps({ ...stateAttributes(calendar.state) }, attrs);
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
  <thead v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="calendar.state" />
  </thead>
</template>
