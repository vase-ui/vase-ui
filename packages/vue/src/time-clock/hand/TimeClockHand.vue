<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TimeClockRootState } from '../root/TimeClockRoot.vue';

export interface TimeClockHandState extends TimeClockRootState {
  /**
   * Whether the hand points at the inner ring of a 24-hour face.
   */
  inner: boolean;
  /**
   * Whether the hand points between two numbers of the face.
   */
  betweenNumbers: boolean;
}

export interface TimeClockHandProps
  extends
    VaseUIComponentProps<TimeClockHandState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useTimeClockRootContext } from '../root/TimeClockRootContext';
import { angleOfFaceNumber, radiusOfFaceNumber } from '../utils/clockViews';
import * as TimeClockHandCssVars from './TimeClockHandCssVars';
import * as TimeClockHandDataAttributes from './TimeClockHandDataAttributes';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimeClockHandProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: TimeClockHandState }): unknown;
  render: ComponentRenderFn<HTMLProps, TimeClockHandState>;
}>();

const stateAttributesMapping: StateAttributesMapping<TimeClockHandState> = {
  betweenNumbers: (betweenNumbers) =>
    betweenNumbers ? { [TimeClockHandDataAttributes.betweenNumbers]: '' } : null,
};

const { selectedNumber, state: rootState, view } = useTimeClockRootContext();

// A mark of the face is a multiple of 5, and a face has a number for each hour.
const state = computed<TimeClockHandState>(() => ({
  ...rootState.value,
  inner: selectedNumber.value.inner,
  betweenNumbers: view.value !== 'hour' && selectedNumber.value.value % 5 !== 0,
}));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  stateAttributesMapping,
  props: (attrs) => [
    {
      'aria-hidden': 'true',
      style: {
        [TimeClockHandCssVars.timeClockHandAngle]: `${angleOfFaceNumber(view.value, selectedNumber.value)}deg`,
        [TimeClockHandCssVars.timeClockHandLength]: radiusOfFaceNumber(selectedNumber.value),
      },
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot
    v-if="!state.empty && usesRenderSlot()"
    name="render"
    :props="elementProps()"
    :state="state"
  />
  <component :is="as" v-else-if="!state.empty" v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
