<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { CalendarPage } from '../../internals/date-time/calendar/monthGrid';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { CalendarState } from '../root/CalendarRoot.vue';

export interface CalendarMonthState extends CalendarState {
  /**
   * The position of the month in the months of the calendar, from `0`. It is `-1` while the month
   * leaves the calendar.
   */
  index: number;
  /**
   * The status of the month while it enters or leaves the calendar. A month that leaves stays until
   * its animations end.
   */
  transitionStatus: TransitionStatus;
}

export interface CalendarMonthProps
  extends
    VaseUIComponentProps<CalendarMonthState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The month that the part shows. It is the value of the slot `month` of `Calendar.Months`.
   */
  month: CalendarPage;
}
</script>

<script setup lang="ts">
import { computed, provide } from 'vue';
import { formatPage } from '../../internals/date-time/calendar/formatText';
import { getPageKey } from '../../internals/date-time/calendar/monthGrid';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import { useLabelId } from '../../utils/useRegisteredLabelId';
import { useCalendarRootContext } from '../root/CalendarRootContext';
import { CalendarMonthContext } from './CalendarMonthContext';
import * as CalendarMonthDataAttributes from './CalendarMonthDataAttributes';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarMonthProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: CalendarMonthState }): unknown;
  render: ComponentRenderFn<HTMLProps, CalendarMonthState>;
}>();

const {
  state: rootState,
  pages,
  locale,
  navigationDirection,
  isLeaving: isPageLeaving,
  finishLeaving,
} = useCalendarRootContext();
const { labelRoot, getAriaLabelledBy } = useLabelId();

const month = computed(() => props.month);
const isLeaving = computed(() => isPageLeaving(props.month));

// A month that mounts after the page changed starts its enter transition. The first render of a
// calendar has none.
const { transitionStatus } = useTransitionStatus(
  () => !isLeaving.value,
  false,
  false,
  navigationDirection.value !== 'none',
  () => element.value,
);

const state = computed<CalendarMonthState>(() => ({
  ...rootState.value,
  index: pages.value.findIndex((page) => getPageKey(page) === getPageKey(props.month)),
  transitionStatus: transitionStatus.value,
}));

provide(CalendarMonthContext, {
  month,
  text: computed(() => formatPage(props.month, locale.value)),
  isLeaving,
  labelRoot,
  getAriaLabelledBy,
});

// The default mapping leaves out the index `0`.
const stateAttributesMapping: StateAttributesMapping<CalendarMonthState> = {
  index: (value) => ({ [CalendarMonthDataAttributes.index]: String(value) }),
  ...transitionStatusMapping,
};

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [{ inert: isLeaving.value ? true : undefined }, attrs],
  stateAttributesMapping,
});

useOpenChangeComplete({
  open: () => !isLeaving.value,
  ref: element,
  onComplete() {
    if (isLeaving.value) {
      finishLeaving(props.month);
    }
  },
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
