<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { formatWeekday } from './pages';
import { injectCalendar, stateAttributes } from './root';
import type { CalendarWeekdayProps, CalendarWeekdayState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarWeekdayProps>(), { format: 'short' });
defineSlots<{
  default?(scope: { state: CalendarWeekdayState; text: string }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: CalendarWeekdayState;
    text: string;
  }): unknown;
}>();

const calendar = injectCalendar();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const text = computed(() => formatWeekday(props.weekday, props.format, calendar.locale));

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      scope: 'col',
      abbr: formatWeekday(props.weekday, 'long', calendar.locale),
      // A server and a browser can have other names of the days (test/measurements/calendar.test.ts).
      'data-allow-mismatch': 'text,attribute',
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
    :text="text"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="calendar.state" :text="text">{{ text }}</slot>
  </component>
  <th v-else-if="$slots.default" v-bind="elementProps()" :ref="setElement">
    <slot :state="calendar.state" :text="text" />
  </th>
  <!-- Vue allows a text mismatch only in an element whose one child is a text. -->
  <th v-else v-bind="elementProps()" :ref="setElement">{{ text }}</th>
</template>
