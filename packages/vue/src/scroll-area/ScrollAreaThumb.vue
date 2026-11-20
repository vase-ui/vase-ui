<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { dragPosition } from './geometry';
import { injectScrollArea, injectScrollbar, readTrack } from './root';
import type { ScrollAreaThumbProps, ScrollAreaThumbState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<ScrollAreaThumbProps>();
defineSlots<{
  default?(scope: { state: ScrollAreaThumbState }): unknown;
  element?(scope: ElementSlotProps<ScrollAreaThumbState>): unknown;
}>();

const scrollbar = injectScrollbar();
const root = injectScrollArea('Thumb');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const vertical = computed(() => scrollbar.orientation === 'vertical');

const remove = root.addThumb({
  get orientation() {
    return scrollbar.orientation;
  },
  get element() {
    return element.value;
  },
});
onUnmounted(remove);

const state = computed<ScrollAreaThumbState>(() => ({
  scrolling: vertical.value ? root.scrollingY : root.scrollingX,
  orientation: scrollbar.orientation,
}));

function onPointerDown(event: PointerEvent) {
  root.startPress(event, vertical.value);
}

function onPointerMove(event: PointerEvent) {
  const press = root.press;
  if (event.pointerId !== press?.pointerId) return;
  const viewport = root.viewport;
  const track = root.scrollbar(press.vertical);
  const thumb = root.thumb(press.vertical);
  if (!viewport || !track || !thumb) return;
  const max = press.vertical
    ? viewport.scrollHeight - viewport.clientHeight
    : viewport.scrollWidth - viewport.clientWidth;
  const distance = (press.vertical ? event.clientY : event.clientX) - press.start;
  const length = press.vertical ? thumb.offsetHeight : thumb.offsetWidth;
  const free = readTrack(track, thumb, press.vertical).length;
  root.scrollTo(press.vertical, dragPosition(press.startPosition, distance, free, length, max));
}

// The browser releases the capture after `pointerup` and `pointercancel`, and then sends
// `lostpointercapture`, also to a thumb with `display: none`.
function onLostPointerCapture(event: PointerEvent) {
  if (event.pointerId === root.press?.pointerId) root.endPress();
}

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      'data-orientation': scrollbar.orientation,
      'data-scrolling': state.value.scrolling ? '' : undefined,
      style: {
        // The root writes `translate`, so `transform` stays free for the developer.
        [vertical.value ? 'height' : 'width']: vertical.value
          ? 'var(--scroll-area-thumb-height)'
          : 'var(--scroll-area-thumb-width)',
        visibility: root.measured ? undefined : 'hidden',
      },
      onPointerdown: onPointerDown,
      onPointermove: onPointerMove,
      onLostpointercapture: onLostPointerCapture,
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
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
