<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, type HTMLAttributes } from 'vue';
import { useElement } from '../common/element';
import { dragPosition } from './geometry';
import { injectScrollArea, injectScrollbar, readTrack } from './root';
import type { ScrollAreaThumbState } from './types';

defineOptions({ inheritAttrs: false });

defineProps</* @vue-ignore */ HTMLAttributes>();
defineSlots<{
  default?(scope: { state: ScrollAreaThumbState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ScrollAreaThumbState;
  }): unknown;
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

function onPointerEnd(event: PointerEvent) {
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
      onPointerup: onPointerEnd,
      onPointercancel: onPointerEnd,
      onLostpointercapture: onPointerEnd,
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
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
