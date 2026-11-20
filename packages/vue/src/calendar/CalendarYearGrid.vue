<script setup lang="ts">
import { computed, mergeProps, provide, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { useEnterAfterLeave } from '../common/useEnterAfterLeave';
import { gridKey } from './cell';
import { formatFieldName, getRows } from './pages';
import { injectCalendar, stateAttributes } from './root';
import type { CalendarYearGridProps, CalendarYearGridState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarYearGridProps>(), { columns: 3 });
defineSlots<{
  /** One row of cells. */
  row?(scope: { years: Temporal.PlainYearMonth[]; index: number }): unknown;
  element?(
    scope: ElementSlotProps<CalendarYearGridState> & {
      rows: readonly Temporal.PlainYearMonth[][];
    },
  ): unknown;
}>();

const calendar = injectCalendar();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const { waiting } = useEnterAfterLeave(() => calendar.view === 'year', element);
const shown = computed(() => calendar.view === 'year' && !waiting.value);
const columnCount = computed(() => Math.max(1, Math.floor(props.columns)));
const rows = computed(() => getRows(calendar.yearCells, columnCount.value));

provide(gridKey, {
  get columns() {
    return columnCount.value;
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
    v-if="shown && $slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="calendar.state"
    :rows="rows"
  />
  <component :is="as" v-else-if="shown && as" v-bind="elementProps()" :ref="setElement">
    <template v-for="(years, index) in rows" :key="years[0]?.toString()"><slot name="row" :years="years" :index="index" /></template>
  </component>
  <div v-else-if="shown" v-bind="elementProps()" :ref="setElement">
    <template v-for="(years, index) in rows" :key="years[0]?.toString()"><slot name="row" :years="years" :index="index" /></template>
  </div>
</template>
