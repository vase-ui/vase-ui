<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, useId } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { injectRequiredMonth } from './month';
import { formatPage } from './pages';
import { injectCalendar, stateAttributes } from './root';
import type { CalendarCaptionProps, CalendarCaptionState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<CalendarCaptionProps>();
defineSlots<{
  default?(scope: { state: CalendarCaptionState; text: string }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: CalendarCaptionState;
    text: string;
  }): unknown;
}>();

const calendar = injectCalendar();
const month = injectRequiredMonth();
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const elementId = computed(() => givenId(props.id) ?? generatedId);
const text = computed(() => formatPage(month.page, calendar.locale, props.format));

// Nuxt removes the call of `onUnmounted` from its server build, with its arguments, so the part
// registers before the call.
const unregister = month.addCaption({
  get id() {
    return elementId.value;
  },
});
onUnmounted(unregister);

defineExpose({ element });

function elementProps() {
  // The caption stays when the page moves, and the live region reads its new text. A server and a
  // browser write a range of days with other spaces (test/measurements/calendar.test.ts).
  return mergeProps(
    {
      id: elementId.value,
      'aria-live': 'polite',
      'data-allow-mismatch': 'text',
      ...stateAttributes(calendar.state),
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
    :state="calendar.state"
    :text="text"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="calendar.state" :text="text">{{ text }}</slot>
  </component>
  <div v-else-if="$slots.default" v-bind="elementProps()" :ref="setElement">
    <slot :state="calendar.state" :text="text" />
  </div>
  <!-- Vue allows a text mismatch only in an element whose one child is a text. -->
  <div v-else v-bind="elementProps()" :ref="setElement">{{ text }}</div>
</template>
