<script lang="ts">
import type { TableHTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { CalendarRootState } from '../root/CalendarRoot.vue';

export interface CalendarGridState extends CalendarRootState {}

export interface CalendarGridProps
  extends
    VaseUIComponentProps<CalendarGridState>,
    /* @vue-ignore */ WithVaseUIEvent<TableHTMLAttributes> {}
</script>

<script setup lang="ts">
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCalendarMonthContext } from '../month/CalendarMonthContext';
import { useCalendarRootContext } from '../root/CalendarRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarGridProps>(), { as: 'table' });

defineSlots<{
  default(props: { state: CalendarGridState }): unknown;
  render: ComponentRenderFn<HTMLProps, CalendarGridState>;
}>();

const { state, multiselectable } = useCalendarRootContext();
const { text, getAriaLabelledBy } = useCalendarMonthContext();

const { element, elementProps } = useRenderElement('table', props, {
  state,
  props: (attrs) => [
    {
      role: 'grid',
      // A caption that names the grid wins over the name of the month, when the caption is there.
      'aria-labelledby': getAriaLabelledBy(attrs),
      'aria-label': text.value,
      'aria-multiselectable': multiselectable.value ? true : undefined,
      'aria-readonly': state.value.readOnly ? true : undefined,
      'aria-disabled': state.value.disabled ? true : undefined,
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
