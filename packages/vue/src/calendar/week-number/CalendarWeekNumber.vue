<script lang="ts">
import type { ThHTMLAttributes } from 'vue';
import type { CalendarPageWeek } from '../../internals/date-time/calendar/monthGrid';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { CalendarState } from '../root/CalendarRoot.vue';

export interface CalendarWeekNumberState extends CalendarState {
  /**
   * The number of the week.
   */
  weekNumber: number;
}

export interface CalendarWeekNumberProps
  extends
    VaseUIComponentProps<CalendarWeekNumberState>,
    /* @vue-ignore */ WithVaseUIEvent<ThHTMLAttributes> {
  /**
   * The week that the part numbers. It is the value of the slot `week` of `Calendar.GridBody`.
   */
  week: CalendarPageWeek;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import { formatNumber } from '../../internals/date-time/calendar/formatText';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCalendarRootContext } from '../root/CalendarRootContext';
import * as CalendarWeekNumberDataAttributes from './CalendarWeekNumberDataAttributes';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarWeekNumberProps>(), { as: 'th' });

defineSlots<{
  default(props: { state: CalendarWeekNumberState; text: string }): unknown;
  render(props: { props: HTMLProps; state: CalendarWeekNumberState; text: string }): unknown;
}>();

const { state: rootState, locale, getWeekNumber } = useCalendarRootContext();
const isHydrating = useIsHydrating();

const state = computed<CalendarWeekNumberState>(() => ({
  ...rootState.value,
  weekNumber: getWeekNumber(props.week),
}));
const text = computed(() => formatNumber(state.value.weekNumber, locale.value));

// The default mapping writes `data-weeknumber`.
const stateAttributesMapping: StateAttributesMapping<CalendarWeekNumberState> = {
  weekNumber: (value) => ({ [CalendarWeekNumberDataAttributes.weekNumber]: String(value) }),
};

const { element, elementProps } = useRenderElement('th', props, {
  state,
  stateAttributesMapping,
  props: (attrs) => [
    {
      scope: 'row',
      'aria-label': `Week ${text.value}`,
      // The digits come from the data of `Intl` in the engine, and a server and a browser can
      // differ.
      'data-allow-mismatch': isHydrating.value ? 'text' : undefined,
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<!-- The text is the only child of the element in the last branch. Vue allows a text mismatch only there. -->
<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :text="text" />
  <component :is="as" v-else-if="$slots.default || as !== 'th'" v-bind="elementProps()"
    ><slot :state="state" :text="text">{{ text }}</slot></component
  >
  <th v-else v-bind="elementProps()">{{ text }}</th>
</template>
