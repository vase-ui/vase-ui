<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { CalendarState } from '../root/CalendarRoot.vue';

export interface CalendarYearGridState extends CalendarState {}

export interface CalendarYearGridProps
  extends
    VaseUIComponentProps<CalendarYearGridState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The cells of a row. A key that moves up or down moves the focus by one row.
   * @default 3
   */
  columns?: number | undefined;
}
</script>

<script setup lang="ts">
import { computed, provide } from 'vue';
import { formatFieldName } from '../../internals/date-time/calendar/formatText';
import { getRows } from '../../internals/date-time/calendar/viewPages';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCalendarRootContext } from '../root/CalendarRootContext';
import { CalendarViewGridContext } from '../utils/CalendarViewGridContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarYearGridProps>(), { as: 'div', columns: 3 });

defineSlots<{
  /**
   * Renders one row of the year cells. The `#render` slot does not render it.
   */
  row(props: { years: Temporal.PlainYearMonth[]; index: number }): unknown;
  render: ComponentRenderFn<HTMLProps, CalendarYearGridState>;
}>();

const { state, view, yearCells, locale } = useCalendarRootContext();

const columnCount = computed(() => Math.max(1, Math.floor(props.columns)));
provide(CalendarViewGridContext, { columns: columnCount });

const rows = computed(() => getRows(yearCells.value, columnCount.value));
const label = computed(() => formatFieldName('year', locale.value));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [
    {
      role: 'grid',
      'aria-label': label.value,
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <template v-if="view === 'year'">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
    <component :is="as" v-else v-bind="elementProps()"><template v-for="(years, index) in rows" :key="years[0]?.toString()"><slot name="row" :years="years" :index="index" /></template></component>
  </template>
</template>
