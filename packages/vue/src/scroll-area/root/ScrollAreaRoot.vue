<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

const DEFAULT_COORDS = { x: 0, y: 0 };
const DEFAULT_SIZE = { width: 0, height: 0 };
const DEFAULT_OVERFLOW_EDGES = { xStart: false, xEnd: false, yStart: false, yEnd: false };
const DEFAULT_HIDDEN_STATE = { x: true, y: true, corner: true };

export type HiddenState = typeof DEFAULT_HIDDEN_STATE;
export type OverflowEdges = typeof DEFAULT_OVERFLOW_EDGES;
export type Size = typeof DEFAULT_SIZE;
export type Coords = typeof DEFAULT_COORDS;

export interface ScrollAreaRootState {
  /**
   * Whether the scroll area is being scrolled.
   */
  scrolling: boolean;
  /**
   * Whether horizontal overflow is present.
   */
  hasOverflowX: boolean;
  /**
   * Whether vertical overflow is present.
   */
  hasOverflowY: boolean;
  /**
   * Whether there is overflow on the inline start side for the horizontal axis.
   */
  overflowXStart: boolean;
  /**
   * Whether there is overflow on the inline end side for the horizontal axis.
   */
  overflowXEnd: boolean;
  /**
   * Whether there is overflow on the block start side.
   */
  overflowYStart: boolean;
  /**
   * Whether there is overflow on the block end side.
   */
  overflowYEnd: boolean;
  /**
   * Whether the scrollbar corner is hidden.
   */
  cornerHidden: boolean;
}

export interface ScrollAreaRootProps
  extends
    VaseUIComponentProps<ScrollAreaRootState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The threshold in pixels that must be passed before the overflow edge attributes are applied.
   * Accepts a single number for all edges or an object to configure them individually.
   * @default 0
   */
  overflowEdgeThreshold?:
    | number
    | Partial<{
        xStart: number;
        xEnd: number;
        yStart: number;
        yEnd: number;
      }>
    | undefined;
}

function normalizeOverflowEdgeThreshold(threshold: ScrollAreaRootProps['overflowEdgeThreshold']) {
  const thresholds =
    typeof threshold === 'number'
      ? { xStart: threshold, xEnd: threshold, yStart: threshold, yEnd: threshold }
      : threshold;

  return {
    xStart: Math.max(0, thresholds?.xStart || 0),
    xEnd: Math.max(0, thresholds?.xEnd || 0),
    yStart: Math.max(0, thresholds?.yStart || 0),
    yEnd: Math.max(0, thresholds?.yEnd || 0),
  };
}
</script>

<script setup lang="ts">
import { computed, nextTick, provide, shallowRef, watch } from 'vue';
import type { Component } from 'vue';
import { contains, getTarget } from '../../common/shadowDom';
import { useTimeout } from '../../common/useTimeout';
import type { HTMLProps, Orientation } from '../../internals/types';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { useRenderElement } from '../../internals/useRenderElement';
import { useStyleDisableScrollbar } from '../../utils/styles';
import { SCROLL_TIMEOUT } from '../constants';
import { getOffset } from '../utils/getOffset';
import ScrollAreaRootChildren from './ScrollAreaRootChildren.vue';
import { ScrollAreaRootContext } from './ScrollAreaRootContext';
import * as ScrollAreaRootCssVars from './ScrollAreaRootCssVars';
import { scrollAreaStateAttributesMapping } from './stateAttributes';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ScrollAreaRootProps>(), {
  as: 'div',
  overflowEdgeThreshold: 0,
});

defineSlots<{
  default(props: { state: ScrollAreaRootState }): unknown;
  render(props: { props: HTMLProps; state: ScrollAreaRootState; children: Component }): unknown;
}>();

const edgeThresholds = computed(() => normalizeOverflowEdgeThreshold(props.overflowEdgeThreshold));

const rootId = useVaseUiId();

const scrollYTimeout = useTimeout();
const scrollXTimeout = useTimeout();

const hovering = shallowRef(false);
const scrollingX = shallowRef(false);
const scrollingY = shallowRef(false);
const touchModality = shallowRef(false);
const hasMeasuredScrollbar = shallowRef(false);
const cornerSize = shallowRef<Size>(DEFAULT_SIZE);
const thumbSize = shallowRef<Size>(DEFAULT_SIZE);
const overflowEdges = shallowRef<OverflowEdges>(DEFAULT_OVERFLOW_EDGES);
const hiddenState = shallowRef<HiddenState>(DEFAULT_HIDDEN_STATE);

const viewportElement = shallowRef<HTMLElement | null>(null);
const scrollbarYElement = shallowRef<HTMLElement | null>(null);
const scrollbarXElement = shallowRef<HTMLElement | null>(null);
const thumbYElement = shallowRef<HTMLElement | null>(null);
const thumbXElement = shallowRef<HTMLElement | null>(null);
const cornerElement = shallowRef<HTMLElement | null>(null);

const press = shallowRef<{
  id: number;
  orientation: Orientation;
  viewport: HTMLElement | null;
  thumb: HTMLElement | null;
  start: number;
  startScroll: number;
} | null>(null);
let lastScrollPosition = DEFAULT_COORDS;

function startScrolling(vertical: boolean) {
  const scrolling = vertical ? scrollingY : scrollingX;
  const timeout = vertical ? scrollYTimeout : scrollXTimeout;

  scrolling.value = true;
  timeout.start(SCROLL_TIMEOUT, () => {
    scrolling.value = false;
  });
}

function handleScroll(scrollPosition: Coords) {
  const offsetX = scrollPosition.x - lastScrollPosition.x;
  const offsetY = scrollPosition.y - lastScrollPosition.y;

  lastScrollPosition = scrollPosition;

  if (offsetY !== 0) {
    startScrolling(true);
  }

  if (offsetX !== 0) {
    startScrolling(false);
  }
}

const { isHeld } = useKeepAliveState();
watch(
  isHeld,
  (held) => {
    if (held) {
      scrollYTimeout.clear();
      scrollXTimeout.clear();
      // The timers that were cleared would have ended the scrolling state.
      scrollingY.value = false;
      scrollingX.value = false;
      // `KeepAlive` took the element out of the document, so the browser dropped the
      // pointer capture. No release event and no leave event comes.
      press.value = null;
      hovering.value = false;
    }
  },
  { flush: 'sync' },
);

watch(
  [viewportElement, thumbYElement, thumbXElement],
  () => {
    const active = press.value;
    if (
      active &&
      (active.viewport !== viewportElement.value ||
        active.thumb !==
          (active.orientation === 'vertical' ? thumbYElement.value : thumbXElement.value))
    ) {
      press.value = null;
    }
  },
  { flush: 'sync' },
);

function handlePointerDown(event: PointerEvent, orientation: Orientation, trackPosition?: number) {
  if (event.button !== 0 || press.value?.thumb?.hasPointerCapture(press.value.id)) {
    return;
  }
  const vertical = orientation === 'vertical';
  const thumb = vertical ? thumbYElement.value : thumbXElement.value;
  const viewport = viewportElement.value;
  const active = {
    id: event.pointerId,
    orientation,
    viewport,
    thumb,
    start: vertical ? event.clientY : event.clientX,
    startScroll: (vertical ? viewport?.scrollTop : viewport?.scrollLeft) ?? 0,
  };
  press.value = active;
  thumb?.setPointerCapture(event.pointerId);

  if (trackPosition !== undefined && viewport) {
    // The track jump needs the viewport's snap style before the browser sets the scroll position.
    nextTick(() => {
      if (press.value === active) {
        const axis = vertical ? 'scrollTop' : 'scrollLeft';
        viewport[axis] = trackPosition;
        active.startScroll = viewport[axis];
        handleScroll({ x: viewport.scrollLeft, y: viewport.scrollTop });
      }
    });
  }
}

function handlePointerUp(event: PointerEvent) {
  const active = press.value;
  if (!active || event.pointerId !== active.id) {
    return;
  }
  press.value = null;
  (active.orientation === 'vertical' ? scrollingY : scrollingX).value = false;
  if (active.thumb?.hasPointerCapture(event.pointerId)) {
    active.thumb.releasePointerCapture(event.pointerId);
  }
}

function handlePointerMove(event: PointerEvent) {
  const active = press.value;
  if (!active || event.pointerId !== active.id) {
    return;
  }

  // The release can go missing. The browser can drop the pointer capture while the scrollbar is
  // hidden in a drag. A move over the thumb with no button would then scroll the viewport.
  // A move with the primary button up is the missed release.
  if (event.buttons % 2 === 0) {
    handlePointerUp(event);
    return;
  }

  const viewport = active.viewport;
  if (!viewport) {
    return;
  }

  const vertical = active.orientation === 'vertical';
  const thumb = active.thumb;
  const scrollbar = vertical ? scrollbarYElement.value : scrollbarXElement.value;
  if (!thumb || !scrollbar) {
    return;
  }

  const axis = vertical ? 'y' : 'x';
  const scrollbarOffset = getOffset(scrollbar, 'padding', axis);
  const thumbOffset = getOffset(thumb, 'margin', axis);
  const thumbSizePx = vertical ? thumb.offsetHeight : thumb.offsetWidth;
  const trackSize = vertical ? scrollbar.offsetHeight : scrollbar.offsetWidth;
  const maxThumbOffset = trackSize - thumbSizePx - scrollbarOffset - thumbOffset;
  // A short or padded track gives a `maxThumbOffset` of zero or less when the thumb has the
  // minimum size. A division by it gives a non-finite or an inverted scroll position.
  const delta = (vertical ? event.clientY : event.clientX) - active.start;
  const scrollRatio = maxThumbOffset <= 0 ? 0 : delta / maxThumbOffset;

  const scrollableSize = vertical ? viewport.scrollHeight : viewport.scrollWidth;
  const viewportSize = vertical ? viewport.clientHeight : viewport.clientWidth;
  nextTick(() => {
    if (press.value === active) {
      viewport[vertical ? 'scrollTop' : 'scrollLeft'] =
        active.startScroll + scrollRatio * (scrollableSize - viewportSize);
    }
  });
  event.preventDefault();

  startScrolling(vertical);
}

function handleTouchModalityChange(event: PointerEvent) {
  touchModality.value = event.pointerType === 'touch';
}

function handlePointerEnterOrMove(event: PointerEvent) {
  handleTouchModalityChange(event);

  if (event.pointerType !== 'touch') {
    hovering.value = contains(element.value, getTarget(event) as Element | null);
  }
}

const state = computed<ScrollAreaRootState>(() => ({
  scrolling: scrollingX.value || scrollingY.value,
  hasOverflowX: !hiddenState.value.x,
  hasOverflowY: !hiddenState.value.y,
  overflowXStart: overflowEdges.value.xStart,
  overflowXEnd: overflowEdges.value.xEnd,
  overflowYStart: overflowEdges.value.yStart,
  overflowYEnd: overflowEdges.value.yEnd,
  cornerHidden: hiddenState.value.corner,
}));

provide(ScrollAreaRootContext, {
  cornerSize,
  setCornerSize(size) {
    cornerSize.value = size;
  },
  thumbSize,
  setThumbSize(size) {
    thumbSize.value = size;
  },
  hasMeasuredScrollbar,
  setHasMeasuredScrollbar(hasMeasured) {
    hasMeasuredScrollbar.value = hasMeasured;
  },
  touchModality,
  hovering,
  setHovering(isHovering) {
    hovering.value = isHovering;
  },
  scrollingX,
  scrollingY,
  viewportElement,
  scrollbarYElement,
  thumbYElement,
  scrollbarXElement,
  thumbXElement,
  cornerElement,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handleScroll,
  press,
  rootId,
  hiddenState,
  setHiddenState(next) {
    hiddenState.value = next;
  },
  overflowEdges,
  setOverflowEdges(next) {
    overflowEdges.value = next;
  },
  viewportState: state,
  overflowEdgeThreshold: edgeThresholds,
});

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  props: (attrs) => [
    {
      role: 'presentation',
      onPointerenter: handlePointerEnterOrMove,
      onPointermove: handlePointerEnterOrMove,
      onPointerdown: handleTouchModalityChange,
      onPointerleave() {
        hovering.value = false;
      },
      style: {
        position: 'relative',
        [ScrollAreaRootCssVars.scrollAreaCornerHeight]: `${cornerSize.value.height}px`,
        [ScrollAreaRootCssVars.scrollAreaCornerWidth]: `${cornerSize.value.width}px`,
      },
    },
    attrs,
  ],
  stateAttributesMapping: scrollAreaStateAttributesMapping,
  children: true,
});

useStyleDisableScrollbar(element);

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" :children="ScrollAreaRootChildren" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <ScrollAreaRootChildren><slot :state="state" /></ScrollAreaRootChildren>
  </component>
</template>
