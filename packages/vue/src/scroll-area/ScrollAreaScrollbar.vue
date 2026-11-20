<script setup lang="ts">
import { computed, mergeProps, nextTick, onUnmounted, provide, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { useEnterAfterLeave } from '../common/useEnterAfterLeave';
import { trackPressPosition, wheelPosition } from './geometry';
import { injectScrollArea, readTrack, scrollbarKey, stateAttributes } from './root';
import type { ScrollAreaScrollbarProps, ScrollAreaScrollbarState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ScrollAreaScrollbarProps>(), {
  orientation: 'vertical',
  keepMounted: false,
});
defineSlots<{
  default?(scope: { state: ScrollAreaScrollbarState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ScrollAreaScrollbarState;
  }): unknown;
}>();

const root = injectScrollArea('Scrollbar');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const vertical = computed(() => props.orientation === 'vertical');

const remove = root.addScrollbar({
  get orientation() {
    return props.orientation;
  },
  get element() {
    return element.value;
  },
});
onUnmounted(remove);
provide(scrollbarKey, {
  get orientation() {
    return props.orientation;
  },
});

const state = computed<ScrollAreaScrollbarState>(() => ({
  ...root.state,
  scrolling: vertical.value ? root.scrollingY : root.scrollingX,
  orientation: props.orientation,
}));
const overflows = computed(() =>
  vertical.value ? state.value.hasOverflowY : state.value.hasOverflowX,
);
const { waiting } = useEnterAfterLeave(() => overflows.value, element);
const rendered = computed(() => (overflows.value && !waiting.value) || props.keepMounted);

/** The range of the scroll position on the axis. In right-to-left it is `-max` to `0`. */
function range(viewport: HTMLElement) {
  const max = vertical.value
    ? viewport.scrollHeight - viewport.clientHeight
    : viewport.scrollWidth - viewport.clientWidth;
  const rtl = !vertical.value && getComputedStyle(viewport).direction === 'rtl';
  return { rtl, min: rtl ? -max : 0, max: rtl ? 0 : max };
}

// The thumb gets the `pointerdown` first. A press on the thumb is then in progress, and
// `startPress` starts no other.
async function onPointerDown(event: PointerEvent) {
  const viewport = root.viewport;
  const thumb = root.thumb(vertical.value);
  const track = element.value;
  if (!viewport || !thumb || !track) return;
  const { rtl, min, max } = range(viewport);
  const { start, length } = readTrack(track, thumb, vertical.value);
  const rect = track.getBoundingClientRect();
  const point = vertical.value
    ? event.clientY - rect.top - start
    : rtl
      ? rect.right - event.clientX - start
      : event.clientX - rect.left - start;
  const thumbLength = vertical.value ? thumb.offsetHeight : thumb.offsetWidth;
  const distance = trackPressPosition(point, length, thumbLength, max - min);
  if (distance === undefined) return;
  const press = root.startPress(event, vertical.value);
  if (!press) return;
  // The jump comes after the render that turns scroll snap off.
  await nextTick();
  root.scrollTo(vertical.value, rtl ? -distance : distance);
  press.startPosition = vertical.value ? viewport.scrollTop : viewport.scrollLeft;
}

function onWheel(event: WheelEvent) {
  const viewport = root.viewport;
  // Ctrl with the wheel is the zoom of the browser.
  if (!viewport || event.ctrlKey) return;
  const { min, max } = range(viewport);
  const position = wheelPosition(
    vertical.value ? viewport.scrollTop : viewport.scrollLeft,
    vertical.value ? event.deltaY : event.deltaX,
    min,
    max,
  );
  if (position === undefined) return;
  event.preventDefault();
  root.scrollTo(vertical.value, position);
}

defineExpose({ element });

function elementProps() {
  const corner = vertical.value
    ? {
        top: 0,
        bottom: 'var(--scroll-area-corner-height)',
        insetInlineEnd: 0,
        '--scroll-area-thumb-height': `${root.thumbLengths.y}px`,
      }
    : {
        bottom: 0,
        insetInlineStart: 0,
        insetInlineEnd: 'var(--scroll-area-corner-width)',
        '--scroll-area-thumb-width': `${root.thumbLengths.x}px`,
      };
  return mergeProps(
    {
      'aria-hidden': 'true',
      'data-orientation': props.orientation,
      ...stateAttributes(state.value),
      style: { position: 'absolute', touchAction: 'none', ...corner },
      onPointerdown: onPointerDown,
      // A native scrollbar keeps the focus where it is for each button, and a drag selects no text.
      onMousedown: (event: MouseEvent) => event.preventDefault(),
      onWheel,
    },
    attrs,
  );
}
</script>

<template>
  <slot
    v-if="rendered && $slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="rendered && as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <div v-else-if="rendered" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
