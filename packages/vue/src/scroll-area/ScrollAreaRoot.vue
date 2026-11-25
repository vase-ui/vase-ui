<script setup lang="ts">
import {
  computed,
  mergeProps,
  onUnmounted,
  provide,
  reactive,
  shallowReactive,
  shallowRef,
  useAttrs,
  watch,
} from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import StyleDisableScrollbar from './StyleDisableScrollbar.vue';
import { useStyleDisableScrollbar } from '../common/styles';
import { edgeDistances, thumbLength, thumbPlace } from './geometry';
import {
  readTrack,
  scrollAreaKey,
  stateAttributes,
  type ScrollAreaAxisPart,
  type ScrollAreaPress,
  type ScrollAreaViewportPart,
} from './root';
import type { ScrollAreaRootProps, ScrollAreaRootState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ScrollAreaRootProps>(), { overflowEdgeThreshold: 0 });
defineSlots<{
  default?(scope: { state: ScrollAreaRootState }): unknown;
  element?(scope: ElementSlotProps<ScrollAreaRootState>): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
useStyleDisableScrollbar(element);

// The last part of a list serves, so a `v-if` that replaces a part gives the new part in each order
// of mount and unmount.
const viewports = shallowReactive<ScrollAreaViewportPart[]>([]);
const scrollbars = shallowReactive<ScrollAreaAxisPart[]>([]);
const thumbs = shallowReactive<ScrollAreaAxisPart[]>([]);
const corners = shallowReactive<object[]>([]);

function add<Part>(list: Part[], part: Part) {
  list.push(part);
  return () => list.splice(list.indexOf(part), 1);
}
function serving(list: readonly ScrollAreaAxisPart[], vertical: boolean) {
  return list.findLast((part) => (part.orientation === 'vertical') === vertical)?.element ?? null;
}

const viewport = computed(() => viewports.at(-1)?.element ?? null);
const scrollbarX = computed(() => serving(scrollbars, false));
const scrollbarY = computed(() => serving(scrollbars, true));
const thumbX = computed(() => serving(thumbs, false));
const thumbY = computed(() => serving(thumbs, true));

const overflow = reactive({
  x: false,
  y: false,
  xStart: false,
  xEnd: false,
  yStart: false,
  yEnd: false,
});
const scrolling = reactive({ x: false, y: false });
const cornerSize = reactive({ width: 0, height: 0 });
const thumbLengths = reactive({ x: 0, y: 0 });
const measured = shallowRef(false);
const press = shallowRef<ScrollAreaPress | null>(null);
let touch = false;

const thresholds = computed(() => {
  const given = props.overflowEdgeThreshold;
  const read = (value: number | undefined) => Math.max(0, value ?? 0);
  return typeof given === 'number'
    ? { xStart: read(given), xEnd: read(given), yStart: read(given), yEnd: read(given) }
    : {
        xStart: read(given.xStart),
        xEnd: read(given.xEnd),
        yStart: read(given.yStart),
        yEnd: read(given.yEnd),
      };
});

const state = computed<ScrollAreaRootState>(() => ({
  scrolling: scrolling.x || scrolling.y,
  hasOverflowX: overflow.x,
  hasOverflowY: overflow.y,
  overflowXStart: overflow.xStart,
  overflowXEnd: overflow.xEnd,
  overflowYStart: overflow.yStart,
  overflowYEnd: overflow.yEnd,
  cornerHidden: !overflow.x || !overflow.y,
}));

function readAxis(target: HTMLElement, vertical: boolean, rtl: boolean) {
  const scroll = vertical ? target.scrollHeight : target.scrollWidth;
  const client = vertical ? target.clientHeight : target.clientWidth;
  // In right-to-left, `scrollLeft` is `0` at the start and negative to the end.
  const position = vertical ? target.scrollTop : rtl ? -target.scrollLeft : target.scrollLeft;
  const max = scroll - client;
  const scrollbar = vertical ? scrollbarY.value : scrollbarX.value;
  const thumb = vertical ? thumbY.value : thumbX.value;
  return {
    scroll,
    client,
    position,
    max,
    distances: edgeDistances(position, max),
    thumb,
    track: scrollbar && thumb ? readTrack(scrollbar, thumb, vertical).length : undefined,
    // The thickness of the scrollbar gives the corner its size.
    thickness: (vertical ? scrollbar?.offsetWidth : scrollbar?.offsetHeight) ?? 0,
  };
}

let measureFrame = 0;
let measuredAt: CSSNumberish | null = null;

function frameTime() {
  const target = viewport.value;
  return target ? target.ownerDocument.timeline.currentTime : null;
}

function cancelMeasureFrame() {
  if (!measureFrame) return;
  cancelAnimationFrame(measureFrame);
  measureFrame = 0;
}

function scheduleMeasure() {
  if (measureFrame) return;
  measureFrame = requestAnimationFrame(() => {
    measureFrame = 0;
    measure();
  });
}

function measure() {
  cancelMeasureFrame();
  const target = viewport.value;
  // An element with `display: none` has no box, so it has no sizes to read.
  if (!target || target.getClientRects().length === 0) return;
  measuredAt = frameTime();
  const rtl = getComputedStyle(target).direction === 'rtl';
  const x = readAxis(target, false, rtl);
  const y = readAxis(target, true, rtl);

  const [xStart, xEnd] = x.distances;
  const [yStart, yEnd] = y.distances;
  for (const [edge, distance] of [
    ['x-start', xStart],
    ['x-end', xEnd],
    ['y-start', yStart],
    ['y-end', yEnd],
  ] as const) {
    target.style.setProperty(`--scroll-area-overflow-${edge}`, `${distance}px`);
  }
  for (const [axis, read] of [
    ['x', x],
    ['y', y],
  ] as const) {
    if (read.track === undefined || !read.thumb) continue;
    const length = thumbLength(read.track, read.client, read.scroll);
    const place = thumbPlace(read.position, read.max, read.track, length, read.scroll);
    // Out of the range the thumb is shorter than the length of the state.
    read.thumb.style.setProperty(
      axis === 'y' ? '--scroll-area-thumb-height' : '--scroll-area-thumb-width',
      `${place.length}px`,
    );
    read.thumb.style.translate =
      axis === 'y' ? `0 ${place.offset}px` : `${rtl ? -place.offset : place.offset}px 0`;
    thumbLengths[axis] = length;
  }

  const threshold = thresholds.value;
  measured.value = true;
  overflow.x = x.max > 0;
  overflow.y = y.max > 0;
  overflow.xStart = xStart > threshold.xStart;
  overflow.xEnd = xEnd > threshold.xEnd;
  overflow.yStart = yStart > threshold.yStart;
  overflow.yEnd = yEnd > threshold.yEnd;
  const cornered = corners.length > 0 && overflow.x && overflow.y;
  cornerSize.width = cornered ? y.thickness : 0;
  cornerSize.height = cornered ? x.thickness : 0;
  viewports.at(-1)?.measured();
}

// A part that mounts or leaves, a new overflow and a new corner size change the tracks. The
// measurement runs before the next paint.
watch(thresholds, measure, { flush: 'post' });
watch(
  [
    scrollbarX,
    scrollbarY,
    thumbX,
    thumbY,
    () => corners.length > 0,
    () => overflow.x,
    () => overflow.y,
    () => cornerSize.width,
    () => cornerSize.height,
  ],
  () => {
    if (
      scrollbarX.value ||
      scrollbarY.value ||
      corners.length > 0 ||
      cornerSize.width > 0 ||
      cornerSize.height > 0
    ) {
      measure();
    }
  },
  { flush: 'post' },
);

let observer: ResizeObserver | undefined;
const timers: { x?: ReturnType<typeof setTimeout>; y?: ReturnType<typeof setTimeout> } = {};

function stopScroll(axis: 'x' | 'y') {
  clearTimeout(timers[axis]);
  scrolling[axis] = false;
}

function scroll(vertical: boolean) {
  const axis = vertical ? 'y' : 'x';
  stopScroll(axis);
  scrolling[axis] = true;
  timers[axis] = setTimeout(() => (scrolling[axis] = false), 500);
}

function endPress() {
  const ended = press.value;
  if (ended) stopScroll(ended.vertical ? 'y' : 'x');
  press.value = null;
  return ended;
}

provide(scrollAreaKey, {
  get state() {
    return state.value;
  },
  get scrollingX() {
    return scrolling.x;
  },
  get scrollingY() {
    return scrolling.y;
  },
  get measured() {
    return measured.value;
  },
  thumbLengths,
  get touch() {
    return touch;
  },
  get press() {
    return press.value;
  },
  get viewport() {
    return viewport.value;
  },
  scrollbar: (vertical) => (vertical ? scrollbarY.value : scrollbarX.value),
  thumb: (vertical) => (vertical ? thumbY.value : thumbX.value),
  measure,
  scheduleMeasure,
  observe(target) {
    // One animation frame shares one `timeline.currentTime` across `requestAnimationFrame` and
    // `ResizeObserver` (test/measurements/scroll-area.test.ts).
    observer ??= new ResizeObserver(() => {
      const now = frameTime();
      if (now !== null && now === measuredAt) {
        scheduleMeasure();
        return;
      }
      measure();
    });
    observer.observe(target);
    return () => observer?.unobserve(target);
  },
  scroll,
  scrollTo(vertical, position) {
    const target = viewport.value;
    if (!target) return;
    const key = vertical ? 'scrollTop' : 'scrollLeft';
    const before = target[key];
    target[key] = position;
    if (target[key] !== before) scroll(vertical);
  },
  startPress(event, vertical) {
    const target = viewport.value;
    const thumb = vertical ? thumbY.value : thumbX.value;
    if (event.button !== 0 || press.value || !target || !thumb) return null;
    press.value = {
      pointerId: event.pointerId,
      vertical,
      start: vertical ? event.clientY : event.clientX,
      startPosition: vertical ? target.scrollTop : target.scrollLeft,
    };
    thumb.setPointerCapture(event.pointerId);
    return press.value;
  },
  endPress,
  addViewport(part) {
    const remove = add(viewports, part);
    return () => {
      remove();
      // The thumb keeps the capture of a press whose viewport leaves.
      const ended = endPress();
      if (ended) {
        (ended.vertical ? thumbY.value : thumbX.value)?.releasePointerCapture(ended.pointerId);
      }
    };
  },
  addScrollbar: (part) => add(scrollbars, part),
  addThumb(part) {
    const remove = add(thumbs, part);
    return () => {
      remove();
      if (press.value?.vertical === (part.orientation === 'vertical')) endPress();
    };
  },
  addCorner: () => add(corners, {}),
});

onUnmounted(() => {
  cancelMeasureFrame();
  observer?.disconnect();
  clearTimeout(timers.x);
  clearTimeout(timers.y);
});

defineExpose({ element });

function readPointer(event: PointerEvent) {
  touch = event.pointerType === 'touch';
}

function elementProps() {
  return mergeProps(
    {
      style: {
        position: 'relative',
        '--scroll-area-corner-width': `${cornerSize.width}px`,
        '--scroll-area-corner-height': `${cornerSize.height}px`,
      },
      ...stateAttributes(state.value),
      // A pointer that enters the root also moves over it.
      onPointermove: readPointer,
      onPointerdown: readPointer,
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
    <StyleDisableScrollbar />
    <slot :state="state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <StyleDisableScrollbar />
    <slot :state="state" />
  </div>
</template>
