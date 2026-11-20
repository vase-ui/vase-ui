<script setup lang="ts">
import { computed, onMounted, useAttrs, useSlots } from 'vue';
import { useButton } from '../button/button';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { useElement } from '../common/element';
import { formatNumber } from '../common/formatNumber';
import { writeAttributes } from '../common/writeAttributes';
import { clockAttributes, injectClock } from './clock';
import type { TimeClockViewTriggerProps, TimeClockViewTriggerState } from './types';
import { faceNumberOf } from './views';

defineOptions({ inheritAttrs: false });

const props = defineProps<TimeClockViewTriggerProps>();
defineSlots<{
  default?(scope: { state: TimeClockViewTriggerState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: TimeClockViewTriggerState;
  }): unknown;
}>();

const attrs = useAttrs();
const slots = useSlots();
const clock = injectClock();
const { element, setElement } = useElement<HTMLElement>();
// A trigger works in a read-only clock: it only shows another view.
const { disabled, mergeAttributes } = useButton({
  element,
  disabled: () => clock.state.disabled,
  type: 'button',
});
const state = computed<TimeClockViewTriggerState>(() => ({
  ...clock.state,
  disabled: disabled.value,
  active: clock.view === props.view,
}));
// A clock with no value shows a placeholder, as an empty field does.
const text = computed(() =>
  clock.state.empty
    ? '--'
    : formatNumber(faceNumberOf(props.view, clock.hourCycle, clock.time).value, clock.locale, {
        minimumIntegerDigits: 2,
        useGrouping: false,
      }),
);

// A server with other `Intl` data has another name.
onMounted(() => {
  if (element.value) writeAttributes(element.value, elementProps());
});

defineExpose({ element });

function elementProps() {
  // The text is a number, so the name says its unit.
  const unit = new Intl.DisplayNames(clock.locale, { type: 'dateTimeField' }).of(props.view);
  return mergeAttributes(
    {
      'aria-label': slots.default ? undefined : clock.state.empty ? unit : `${unit} ${text.value}`,
      'aria-pressed': state.value.active ? 'true' : 'false',
      ...clockAttributes(clock.state),
      // CSS has `:disabled`.
      'data-disabled': undefined,
      onClick: (event: MouseEvent) =>
        clock.setView(props.view, createChangeEventDetails('trigger-press', event)),
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
  <button v-else-if="$slots.default" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </button>
  <button v-else v-bind="elementProps()" :ref="setElement">{{ text }}</button>
</template>
