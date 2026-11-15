<script lang="ts">
import type { ThHTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { CalendarState } from '../root/CalendarRoot.vue';

export interface CalendarWeekNumberHeaderState extends CalendarState {}

export interface CalendarWeekNumberHeaderProps
  extends
    VaseUIComponentProps<CalendarWeekNumberHeaderState>,
    /* @vue-ignore */ WithVaseUIEvent<ThHTMLAttributes> {}
</script>

<script setup lang="ts">
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCalendarRootContext } from '../root/CalendarRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarWeekNumberHeaderProps>(), { as: 'th' });

defineSlots<{
  default(props: { state: CalendarWeekNumberHeaderState }): unknown;
  render: ComponentRenderFn<HTMLProps, CalendarWeekNumberHeaderState>;
}>();

const { state } = useCalendarRootContext();

const { element, elementProps } = useRenderElement('th', props, {
  state,
  props: (attrs) => [{ scope: 'col', 'aria-label': 'Week number' }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
