<script setup lang="ts">
import { computed, mergeProps, onMounted, useAttrs, useSlots } from 'vue';
import { useElement } from '../common/element';
import { writeAttributes } from '../common/writeAttributes';
import { clockAttributes, injectClock } from './clock';
import type { TimeClockHandProps, TimeClockHandState } from './types';
import { angleOfFaceNumber, radiusOfFaceNumber } from './views';

defineOptions({ inheritAttrs: false });

defineProps<TimeClockHandProps>();
defineSlots<{
  default?(scope: { state: TimeClockHandState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: TimeClockHandState;
  }): unknown;
}>();

const attrs = useAttrs();
const slots = useSlots();
const clock = injectClock();
const { element, setElement } = useElement<HTMLElement>();
// A minute or a second has a number for each 5.
const state = computed<TimeClockHandState>(() => ({
  ...clock.state,
  inner: clock.selectedNumber.inner,
  betweenNumbers: clock.view !== 'hour' && clock.selectedNumber.value % 5 !== 0,
}));

// The element of the `element` slot can have attributes of the developer that win over those of
// the part, so the part writes only to its own element.
onMounted(() => {
  if (element.value && !slots.element) writeAttributes(element.value, elementProps());
});

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
  <div v-else-if="!state.empty" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
