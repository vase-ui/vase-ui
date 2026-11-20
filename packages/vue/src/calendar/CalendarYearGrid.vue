<script setup lang="ts">
import { computed, mergeProps, provide, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { gridKey } from './cell';
import { formatFieldName, getRows } from './pages';
import { injectCalendar, stateAttributes } from './root';
import type { CalendarYearGridProps, CalendarYearGridState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarYearGridProps>(), { columns: 3 });
defineSlots<{
  /** One row of cells. */
  row?(scope: { years: Temporal.PlainYearMonth[]; index: number }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: CalendarYearGridState;
    rows: readonly Temporal.PlainYearMonth[][];
  }): unknown;
}>();

const calendar = injectCalendar();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const columns = computed(() => Math.max(1, Math.floor(props.columns)));
const rows = computed(() => getRows(calendar.yearCells, columns.value));

provide(gridKey, {
  get columns() {
    return columns.value;
  },
});

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      role: 'grid',
      'aria-label': formatFieldName('year', calendar.locale),
      ...stateAttributes(calendar.state),
    },
    attrs,
  );
}
</script>

<!-- prettier-ignore -->
<template>
  <slot
    v-if="calendar.view === 'year' && $slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="calendar.state"
    :rows="rows"
  />
  <component :is="as" v-else-if="calendar.view === 'year' && as" v-bind="elementProps()" :ref="setElement">
    <template v-for="(years, index) in rows" :key="years[0]?.toString()"><slot name="row" :years="years" :index="index" /></template>
  </component>
  <div v-else-if="calendar.view === 'year'" v-bind="elementProps()" :ref="setElement">
    <template v-for="(years, index) in rows" :key="years[0]?.toString()"><slot name="row" :years="years" :index="index" /></template>
  </div>
</template>
