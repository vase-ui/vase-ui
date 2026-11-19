<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { CalendarPage } from '../../internals/date-time/calendar/monthGrid';
import type { NavigationDirection } from '../../internals/date-time/calendar/useCalendarRoot';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { CalendarState } from '../root/CalendarRoot.vue';

export interface CalendarMonthsState extends CalendarState {
  /**
   * The side of the last change of the page: `previous` or `next`, and `none` until the page
   * changes.
   */
  navigationDirection: NavigationDirection;
}

export interface CalendarMonthsProps
  extends
    VaseUIComponentProps<CalendarMonthsState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { getPageKey } from '../../internals/date-time/calendar/monthGrid';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCalendarRootContext } from '../root/CalendarRootContext';
import * as CalendarMonthsDataAttributes from './CalendarMonthsDataAttributes';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarMonthsProps>(), { as: 'div' });

defineSlots<{
  /**
   * Renders one month of the calendar. The `#render` slot does not render it. `index` is `-1` for a
   * month that leaves.
   */
  month(props: { month: CalendarPage; index: number }): unknown;
  render: ComponentRenderFn<HTMLProps, CalendarMonthsState>;
}>();

const {
  state: rootState,
  view,
  pages,
  renderedPages,
  navigationDirection,
} = useCalendarRootContext();

const state = computed<CalendarMonthsState>(() => ({
  ...rootState.value,
  navigationDirection: navigationDirection.value,
}));

function indexOf(page: CalendarPage) {
  return pages.value.findIndex((other) => getPageKey(other) === getPageKey(page));
}

const stateAttributesMapping: StateAttributesMapping<CalendarMonthsState> = {
  navigationDirection: (value) => ({
    [CalendarMonthsDataAttributes.navigationDirection]: value,
  }),
};

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  stateAttributesMapping,
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="view === 'day' && usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else-if="view === 'day'" v-bind="elementProps()" :ref="setRef">
    <template v-for="month in renderedPages" :key="getPageKey(month)"><slot name="month" :month="month" :index="indexOf(month)" /></template>
  </component>
</template>
