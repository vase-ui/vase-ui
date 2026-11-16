<script lang="ts">
import type { TableHTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { CalendarState } from '../root/CalendarRoot.vue';

export interface CalendarGridState extends CalendarState {}

export interface CalendarGridProps
  extends
    VaseUIComponentProps<CalendarGridState>,
    /* @vue-ignore */ WithVaseUIEvent<TableHTMLAttributes> {}
</script>

<script setup lang="ts">
import { useAriaAfterHydration } from '../../common/hydration';
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
const ariaAfterHydration = useAriaAfterHydration();

const { element, elementProps } = useRenderElement('table', props, {
  state,
  props: (attrs) => [
    {
      role: 'grid',
      // The caption of the month names the grid, and the name of the month is the name without it.
      // An `aria-labelledby` of the consumer replaces both, and its `aria-label` replaces the name
      // of the month. An `aria-labelledby` of `null` removes only the caption, so the grid keeps a
      // name (VUE-103).
      'aria-labelledby': getAriaLabelledBy(attrs),
      'aria-label': ariaAfterHydration(attrs['aria-labelledby'] == null ? text.value : undefined),
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
