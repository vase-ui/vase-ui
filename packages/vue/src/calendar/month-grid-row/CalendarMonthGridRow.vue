<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { CalendarState } from '../root/CalendarRoot.vue';

export interface CalendarMonthGridRowState extends CalendarState {}

export interface CalendarMonthGridRowProps
  extends
    VaseUIComponentProps<CalendarMonthGridRowState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCalendarRootContext } from '../root/CalendarRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarMonthGridRowProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: CalendarMonthGridRowState }): unknown;
  render: ComponentRenderFn<HTMLProps, CalendarMonthGridRowState>;
}>();

const { state } = useCalendarRootContext();

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [{ role: 'row' }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
