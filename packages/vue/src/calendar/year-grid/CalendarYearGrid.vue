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

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
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
  <slot v-if="view === 'year' && usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else-if="view === 'year'" v-bind="elementProps()" :ref="setRef">
    <template v-for="(years, index) in rows" :key="years[0]?.toString()"><slot name="row" :years="years" :index="index" /></template>
  </component>
</template>
