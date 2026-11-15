<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { CalendarState } from '../root/CalendarRoot.vue';

export interface CalendarGridHeaderState extends CalendarState {}

export interface CalendarGridHeaderProps
  extends
    VaseUIComponentProps<CalendarGridHeaderState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCalendarRootContext } from '../root/CalendarRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarGridHeaderProps>(), { as: 'thead' });

defineSlots<{
  default(props: { state: CalendarGridHeaderState }): unknown;
  render: ComponentRenderFn<HTMLProps, CalendarGridHeaderState>;
}>();

const { state } = useCalendarRootContext();

const { element, elementProps } = useRenderElement('thead', props, { state });

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
