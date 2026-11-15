<script lang="ts">
import type { ThHTMLAttributes } from 'vue';
import type { DayOfWeek } from '../../internals/date-time/temporal';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { CalendarState } from '../root/CalendarRoot.vue';

export interface CalendarWeekdayState extends CalendarState {
  /**
   * Whether the day of the week is in the weekend of the locale.
   */
  weekend: boolean;
}

export interface CalendarWeekdayProps
  extends
    VaseUIComponentProps<CalendarWeekdayState>,
    /* @vue-ignore */ WithVaseUIEvent<ThHTMLAttributes> {
  /**
   * The day of the week, from `1` for Monday to `7` for Sunday.
   * It is the value of the slot `weekday` of `Calendar.GridHeaderRow`.
   */
  weekday: DayOfWeek;
  /**
   * The length of the name of the day. The attribute `abbr` always has the long name.
   * @default 'short'
   */
  format?: 'narrow' | 'short' | 'long' | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import { formatWeekday } from '../../internals/date-time/calendar/formatText';
import type { HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCalendarRootContext } from '../root/CalendarRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarWeekdayProps>(), { as: 'th', format: 'short' });

defineSlots<{
  default(props: { state: CalendarWeekdayState; text: string }): unknown;
  render(props: { props: HTMLProps; state: CalendarWeekdayState; text: string }): unknown;
}>();

const { state: rootState, weekend, locale } = useCalendarRootContext();
const isHydrating = useIsHydrating();

const state = computed<CalendarWeekdayState>(() => ({
  ...rootState.value,
  weekend: weekend.value.some((day) => day === props.weekday),
}));
const text = computed(() => formatWeekday(props.weekday, props.format, locale.value));
const name = computed(() => formatWeekday(props.weekday, 'long', locale.value));

const { element, elementProps } = useRenderElement('th', props, {
  state,
  props: (attrs) => [
    {
      scope: 'col',
      abbr: name.value,
      // The names come from the data of `Intl` in the engine, and a server and a browser can
      // differ.
      'data-allow-mismatch': isHydrating.value ? 'attribute,text' : undefined,
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :text="text" />
  <component :is="as" v-else v-bind="elementProps()"
    ><slot :state="state" :text="text">{{ text }}</slot></component
  >
</template>
