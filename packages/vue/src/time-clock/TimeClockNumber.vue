<script setup lang="ts">
import { computed, mergeProps, useAttrs, watch } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { formatNumber } from '../common/formatNumber';
import { useAttributesAfterMount } from '../common/writeAttributes';
import { clockAttributes, injectClock } from './clock';
import type { TimeClockNumberProps, TimeClockNumberState } from './types';
import { angleOfFaceNumber, radiusOfFaceNumber } from './views';

defineOptions({ inheritAttrs: false });

const props = defineProps<TimeClockNumberProps>();
defineSlots<{
  default?(scope: { state: TimeClockNumberState }): unknown;
  element?(scope: ElementSlotProps<TimeClockNumberState>): unknown;
}>();

const attrs = useAttrs();
const clock = injectClock();
const { element, setElement } = useElement<HTMLElement>();
const state = computed<TimeClockNumberState>(() => {
  const { number } = props;
  const { selectedNumber, state: root } = clock;
  return {
    ...root,
    disabled: root.disabled || clock.isNumberDisabled(number),
    selected:
      !root.empty && number.value === selectedNumber.value && number.inner === selectedNumber.inner,
    inner: number.inner,
  };
});
// A minute, a second and the hour 0 have two digits, as a time shows them.
const text = computed(() =>
  formatNumber(props.number.value, clock.locale, {
    minimumIntegerDigits: clock.view !== 'hour' || props.number.value === 0 ? 2 : 1,
    useGrouping: false,
  }),
);

watch(
  element,
  (el, _, onCleanup) => {
    if (el) onCleanup(clock.addNumber(el, () => props.number));
  },
  { flush: 'sync' },
);

useAttributesAfterMount(element, elementProps, () => props.as);

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      'aria-hidden': 'true',
      ...clockAttributes(state.value),
      'data-selected': state.value.selected ? '' : undefined,
      'data-inner': state.value.inner ? '' : undefined,
      style: {
        '--time-clock-number-angle': `${angleOfFaceNumber(clock.view, props.number)}deg`,
        '--time-clock-number-radius': radiusOfFaceNumber(props.number),
      },
    },
    attrs,
  );
}
</script>

<!-- Vue allows a text mismatch only for an element whose one child is the text, so the text has a
branch with no slot. -->
<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state">{{ text }}</slot>
  </component>
  <span v-else-if="$slots.default" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </span>
  <span v-else v-bind="elementProps()" :ref="setElement">{{ text }}</span>
</template>
