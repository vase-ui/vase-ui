<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { useAttributesAfterMount } from '../common/writeAttributes';
import { clockAttributes, injectClock } from './clock';
import type { TimeClockHandProps, TimeClockHandState } from './types';
import { angleOfFaceNumber, radiusOfFaceNumber } from './views';

defineOptions({ inheritAttrs: false });

const props = defineProps<TimeClockHandProps>();
defineSlots<{
  default?(scope: { state: TimeClockHandState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: TimeClockHandState;
  }): unknown;
}>();

const attrs = useAttrs();
const clock = injectClock();
const { element, setElement } = useElement<HTMLElement>();
// A minute or a second has a number for each 5.
const state = computed<TimeClockHandState>(() => ({
  ...clock.state,
  inner: clock.selectedNumber.inner,
  betweenNumbers: clock.view !== 'hour' && clock.selectedNumber.value % 5 !== 0,
}));

useAttributesAfterMount(element, elementProps, () => props.as);

defineExpose({ element });

function elementProps() {
  const { selectedNumber, view } = clock;
  return mergeProps(
    {
      'aria-hidden': 'true',
      ...clockAttributes(state.value),
      'data-inner': state.value.inner ? '' : undefined,
      'data-between-numbers': state.value.betweenNumbers ? '' : undefined,
      // A server with another hour cycle puts the hand on another ring.
      'data-allow-mismatch': 'style',
      style: {
        '--time-clock-hand-angle': `${angleOfFaceNumber(view, selectedNumber)}deg`,
        '--time-clock-hand-length': radiusOfFaceNumber(selectedNumber),
      },
    },
    attrs,
  );
}
</script>

<!-- A clock with no value has no hand. -->
<template>
  <slot
    v-if="!state.empty && $slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="!state.empty && as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <div v-else-if="!state.empty" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
