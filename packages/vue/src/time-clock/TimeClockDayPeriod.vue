<script setup lang="ts">
import { computed, useAttrs, useSlots } from 'vue';
import { useButton } from '../common/button';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { useElement } from '../common/element';
import { dayPeriodText } from '../internals/date-time/format';
import { clockAttributes, injectClock } from './clock';
import type { TimeClockDayPeriodProps, TimeClockDayPeriodState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<TimeClockDayPeriodProps>();
defineSlots<{
  default?(scope: { state: TimeClockDayPeriodState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: TimeClockDayPeriodState;
  }): unknown;
}>();

const attrs = useAttrs();
const clock = injectClock();
const { element, setElement } = useElement<HTMLElement>();
const slots = useSlots();
const { disabled, mergeAttributes } = useButton({
  element,
  disabled: () => clock.state.disabled || clock.isDayPeriodDisabled(props.value),
  // A tag in `as` is known at the render. The element of a component or of the `element` slot,
  // which wins over `as`, is known after the mount.
  tag: () => (typeof props.as === 'string' && !slots.element ? props.as : undefined),
  type: 'button',
});
const state = computed<TimeClockDayPeriodState>(() => ({
  ...clock.state,
  disabled: disabled.value,
  selected: !clock.state.empty && clock.dayPeriod === props.value,
}));
const text = computed(() => dayPeriodText(props.value, clock.locale));

defineExpose({ element });

function elementProps() {
  return mergeAttributes(
    {
      'aria-pressed': state.value.selected ? 'true' : 'false',
      ...clockAttributes(clock.state),
      // CSS has `:disabled`.
      'data-disabled': undefined,
      onClick: (event: MouseEvent) =>
        clock.selectDayPeriod(props.value, createChangeEventDetails('item-press', event)),
    },
    attrs,
  );
}
</script>

<!-- A 24-hour face has no day period. Vue allows a text mismatch only for an element whose one
child is the text, so the text has a branch with no slot. -->
<template>
  <slot
    v-if="clock.hourCycle === 12 && $slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component
    :is="as"
    v-else-if="clock.hourCycle === 12 && as"
    v-bind="elementProps()"
    :ref="setElement"
  >
    <slot :state="state">{{ text }}</slot>
  </component>
  <button
    v-else-if="clock.hourCycle === 12 && $slots.default"
    v-bind="elementProps()"
    :ref="setElement"
  >
    <slot :state="state" />
  </button>
  <button v-else-if="clock.hourCycle === 12" v-bind="elementProps()" :ref="setElement">
    {{ text }}
  </button>
</template>
