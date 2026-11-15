<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { DayOfWeek } from '../../internals/date-time/temporal';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { CalendarRootState } from '../root/CalendarRoot.vue';

export interface CalendarGridHeaderRowState extends CalendarRootState {}

export interface CalendarGridHeaderRowProps
  extends
    VaseUIComponentProps<CalendarGridHeaderRowState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCalendarRootContext } from '../root/CalendarRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarGridHeaderRowProps>(), { as: 'tr' });

defineSlots<{
  /**
   * Renders one day of the week, from the first day of the week. The `#render` slot does not
   * render it.
   */
  weekday(props: { weekday: DayOfWeek; index: number }): unknown;
  render: ComponentRenderFn<HTMLProps, CalendarGridHeaderRowState>;
}>();

const { state, weekdays } = useCalendarRootContext();

const { element, elementProps } = useRenderElement('tr', props, { state });

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><template v-for="(weekday, index) in weekdays" :key="weekday"><slot name="weekday" :weekday="weekday" :index="index" /></template></component>
</template>
