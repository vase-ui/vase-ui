<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { useButton } from '../common/button';
import { useAsTag, useElement, type ElementSlotProps } from '../common/element';
import { injectCalendar, stateAttributes } from './root';
import type { CalendarViewTriggerProps, CalendarViewTriggerState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarViewTriggerProps>(), {
  view: 'year',
  disabled: false,
});
defineSlots<{
  default?(scope: { state: CalendarViewTriggerState; text: string }): unknown;
  element?(
    scope: ElementSlotProps<CalendarViewTriggerState> & {
      text: string;
    },
  ): unknown;
}>();

const calendar = injectCalendar();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
// A calendar of weeks or days, and a range calendar, show days only.
const button = useButton({
  element,
  disabled: () => props.disabled || calendar.state.disabled || !calendar.hasViews,
  type: 'button',
  tag: useAsTag(() => props.as, 'button'),
});
const state = computed<CalendarViewTriggerState>(() => ({
  ...calendar.state,
  disabled: button.disabled.value,
  view: props.view,
  active: calendar.view === props.view,
}));
const text = computed(() => calendar.label);

defineExpose({ element });

function elementProps() {
  return button.mergeAttributes(
    {
      // The text changes in place when the page moves, so a screen reader reads it.
      'aria-live': 'polite',
      // A server and a browser write a range of years with other spaces
      // (test/measurements/calendar.test.ts).
      'data-allow-mismatch': 'text',
      'data-active': state.value.active ? '' : undefined,
      ...stateAttributes(state.value, ['disabled']),
      onClick: (event: MouseEvent) => calendar.toggleView(props.view, event),
    },
    attrs,
  );
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
    :text="text"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" :text="text">{{ text }}</slot>
  </component>
  <button v-else-if="$slots.default" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" :text="text" />
  </button>
  <!-- Vue allows a text mismatch only in an element whose one child is a text. -->
  <button v-else v-bind="elementProps()" :ref="setElement">{{ text }}</button>
</template>
