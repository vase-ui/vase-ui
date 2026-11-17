<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { CalendarState } from '../root/CalendarRoot.vue';

export interface CalendarMonthGridState extends CalendarState {}

export interface CalendarMonthGridProps
  extends
    VaseUIComponentProps<CalendarMonthGridState>,
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

const props = withDefaults(defineProps<CalendarMonthGridProps>(), { as: 'div', columns: 3 });

defineSlots<{
  /**
   * Renders one row of the month cells. The `#render` slot does not render it.
   */
  row(props: { months: Temporal.PlainYearMonth[]; index: number }): unknown;
  render: ComponentRenderFn<HTMLProps, CalendarMonthGridState>;
}>();

const { state, view, monthCells, locale, multiselectable, selectsMonths } =
  useCalendarRootContext();

const columnCount = computed(() => Math.max(1, Math.floor(props.columns)));
provide(CalendarViewGridContext, { columns: columnCount });

const rows = computed(() => getRows(monthCells.value, columnCount.value));
const label = computed(() => formatFieldName('month', locale.value));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  props: (attrs) => [
    {
      role: 'grid',
      'aria-label': label.value,
      'aria-multiselectable': multiselectable.value && selectsMonths.value ? true : undefined,
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="view === 'month' && usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else-if="view === 'month'" v-bind="elementProps()" :ref="setRef">
    <template v-for="(months, index) in rows" :key="months[0]?.toString()"><slot name="row" :months="months" :index="index" /></template>
  </component>
</template>
