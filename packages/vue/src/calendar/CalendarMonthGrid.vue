<script setup lang="ts">
import { computed, mergeProps, provide, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { useEnterAfterLeave } from '../common/useEnterAfterLeave';
import { gridKey } from './cell';
import { formatFieldName, getRows } from './pages';
import { injectCalendar, stateAttributes } from './root';
import type { CalendarMonthGridProps, CalendarMonthGridState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarMonthGridProps>(), { columns: 3 });
defineSlots<{
  /** One row of cells. */
  row?(scope: { months: Temporal.PlainYearMonth[]; index: number }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: CalendarMonthGridState;
    rows: readonly Temporal.PlainYearMonth[][];
  }): unknown;
}>();

const calendar = injectCalendar();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const { waiting } = useEnterAfterLeave(() => calendar.view === 'month', element);
const shown = computed(() => calendar.view === 'month' && !waiting.value);
const columnCount = computed(() => Math.max(1, Math.floor(props.columns)));
const rows = computed(() => getRows(calendar.monthCells, columnCount.value));

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
      'aria-label': formatFieldName('month', calendar.locale),
      'aria-multiselectable':
        calendar.multiselectable && calendar.selectsMonths ? 'true' : undefined,
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
    <template v-for="(months, index) in rows" :key="months[0]?.toString()"><slot name="row" :months="months" :index="index" /></template>
  </component>
  <div v-else-if="shown" v-bind="elementProps()" :ref="setElement">
    <template v-for="(months, index) in rows" :key="months[0]?.toString()"><slot name="row" :months="months" :index="index" /></template>
  </div>
</template>
