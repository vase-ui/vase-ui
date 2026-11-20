<script setup lang="ts">
import { computed, mergeProps, onBeforeUnmount, provide, shallowReactive, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { monthKey } from './month';
import { formatPage } from './pages';
import { injectCalendar, stateAttributes } from './root';
import type { CalendarMonthProps, CalendarMonthState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<CalendarMonthProps>();
defineSlots<{
  default?(scope: { state: CalendarMonthState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: CalendarMonthState;
  }): unknown;
}>();

const calendar = injectCalendar();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const captions = shallowReactive<{ readonly id: string }[]>([]);
const text = computed(() => formatPage(props.month, calendar.locale));
const state = computed<CalendarMonthState>(() => ({
  ...calendar.state,
  index: calendar.pages.findIndex((page) => page.first.equals(props.month.first)),
}));

provide(monthKey, {
  get page() {
    return props.month;
  },
  get text() {
    return text.value;
  },
  get captionId() {
    return captions[0]?.id;
  },
  addCaption(caption) {
    captions.push(caption);
    return () => captions.splice(captions.indexOf(caption), 1);
  },
});

// A month that leaves in a `<Transition>` takes a click and the focus until its leave ends
// (test/measurements/calendar.test.ts). The calendar keeps one tab stop.
onBeforeUnmount(() => element.value?.setAttribute('inert', ''));

defineExpose({ element });

function elementProps() {
  return mergeProps(stateAttributes(state.value), attrs);
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
