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
import { computed, nextTick, provide, shallowReactive, shallowRef, toValue, watch } from 'vue';
import type { Component } from 'vue';
import { contains, getTarget } from '../../common/shadowDom';
import { useListenerSession } from '../../common/useListenerSession';
import { useTimeout } from '../../common/useTimeout';
import type { HTMLProps, Orientation } from '../../internals/types';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { useRenderElement } from '../../internals/useRenderElement';
import { useStyleDisableScrollbar } from '../../utils/styles';
import {
  SCROLL_TIMEOUT,
  ScrollAreaRootContext,
  scrollAreaStateAttributesMapping,
} from './ScrollAreaRootContext';
import { getOffset } from '../utils/getOffset';
import ScrollAreaRootChildren from './ScrollAreaRootChildren.vue';
import * as ScrollAreaRootCssVars from './ScrollAreaRootCssVars';

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
const cornerSize = shallowReactive({ ...DEFAULT_SIZE });
const thumbSize = shallowReactive({ ...DEFAULT_SIZE });
const overflowEdges = shallowReactive({ ...DEFAULT_OVERFLOW_EDGES });
const hiddenX = shallowRef(DEFAULT_HIDDEN_STATE.x);
const hiddenY = shallowRef(DEFAULT_HIDDEN_STATE.y);

const elements = {
  viewportElement: shallowRef<HTMLElement | null>(null),
  scrollbarYElement: shallowRef<HTMLElement | null>(null),
  scrollbarXElement: shallowRef<HTMLElement | null>(null),
  thumbYElement: shallowRef<HTMLElement | null>(null),
  thumbXElement: shallowRef<HTMLElement | null>(null),
  cornerElement: shallowRef<HTMLElement | null>(null),
};

interface ScrollAreaPress {
  id: number;
  orientation: Orientation;
  viewport: HTMLElement;
  thumb: HTMLElement;
  start: number;
  startScroll: number;
  pendingOffset: number | null;
}

const press = shallowRef<ScrollAreaPress | null>(null);
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
  if (scrollPosition.y !== lastScrollPosition.y) startScrolling(true);
  if (scrollPosition.x !== lastScrollPosition.x) startScrolling(false);
  lastScrollPosition = scrollPosition;
}

const { isHeld } = useKeepAliveState();
watch(
  isHeld,
  (held) => {
    if (held) {
      scrollYTimeout.clear();
      scrollXTimeout.clear();
      scrollingY.value = false;
      scrollingX.value = false;
      hovering.value = false;
    }
  },
  { flush: 'sync' },
);

const session = useListenerSession(isHeld);

function handlePointerDown(event: PointerEvent, orientation: Orientation, trackPosition?: number) {
  if (event.button !== 0 || press.value?.thumb.hasPointerCapture(press.value.id)) {
    return;
  }
  const vertical = orientation === 'vertical';
  const thumb = vertical ? elements.thumbYElement.value : elements.thumbXElement.value;
  const viewport = elements.viewportElement.value;
  if (!viewport || !thumb) {
    return;
  }

  const axis = vertical ? 'scrollTop' : 'scrollLeft';
  const active: ScrollAreaPress = {
    id: event.pointerId,
    orientation,
    viewport,
    thumb,
    start: vertical ? event.clientY : event.clientX,
    startScroll: viewport[axis],
    pendingOffset: 0,
  };
  session.start((onCleanup, end) => {
    const stop = watch(
      [elements.viewportElement, vertical ? elements.thumbYElement : elements.thumbXElement],
      end,
      { flush: 'sync' },
    );
    onCleanup(() => {
      stop();
      press.value = null;
      (vertical ? scrollingY : scrollingX).value = false;
      if (thumb.hasPointerCapture(active.id)) thumb.releasePointerCapture(active.id);
    });
    press.value = active;
    thumb.setPointerCapture(active.id);
  });

  // A track jump or an early move must wait for the snap style of this press.
  nextTick(() => {
    if (press.value !== active) {
      return;
    }
    if (trackPosition !== undefined) {
      viewport[axis] = trackPosition;
      active.startScroll = viewport[axis];
      handleScroll({ x: viewport.scrollLeft, y: viewport.scrollTop });
    }
    if (active.pendingOffset) {
      viewport[axis] = active.startScroll + active.pendingOffset;
    }
    active.pendingOffset = null;
  });
}

function handlePointerUp(event: PointerEvent) {
  if (press.value?.id === event.pointerId) session.stop();
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

  const { thumb, viewport } = active;
  const vertical = active.orientation === 'vertical';
  const scrollbar = vertical ? elements.scrollbarYElement.value : elements.scrollbarXElement.value;
  if (!scrollbar) {
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
  const offset = scrollRatio * (scrollableSize - viewportSize);
  if (active.pendingOffset === null) {
    viewport[vertical ? 'scrollTop' : 'scrollLeft'] = active.startScroll + offset;
  } else {
    active.pendingOffset = offset;
  }
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
  hasOverflowX: !hiddenX.value,
  hasOverflowY: !hiddenY.value,
  overflowXStart: overflowEdges.xStart,
  overflowXEnd: overflowEdges.xEnd,
  overflowYStart: overflowEdges.yStart,
  overflowYEnd: overflowEdges.yEnd,
  cornerHidden: hiddenX.value || hiddenY.value,
}));

provide(ScrollAreaRootContext, {
  cornerSize,
  setCornerSize(size) {
    Object.assign(cornerSize, size);
  },
  thumbSize,
  setThumbSize(size) {
    Object.assign(thumbSize, size);
  },
  hasMeasuredScrollbar,
  markMeasured() {
    hasMeasuredScrollbar.value = true;
  },
  touchModality,
  hovering,
  markHovered() {
    hovering.value = true;
  },
  scrollingX,
  scrollingY,
  ...elements,
  registerElement(name, element) {
    const { isHeld: partHeld } = useKeepAliveState();
    watch(
      [() => toValue(name), () => toValue(element), partHeld],
      ([key, node, held], _, onCleanup) => {
        if (!node || held) return;
        const holder = elements[key];
        holder.value = node;
        onCleanup(() => {
          if (holder.value === node) holder.value = null;
        });
      },
      { flush: 'post' },
    );
  },
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handleScroll,
  press,
  rootId,
  setHiddenAxes(x, y) {
    hiddenX.value = x;
    hiddenY.value = y;
  },
  setOverflowEdges(edges) {
    Object.assign(overflowEdges, edges);
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
        [ScrollAreaRootCssVars.scrollAreaCornerHeight]: `${cornerSize.height}px`,
        [ScrollAreaRootCssVars.scrollAreaCornerWidth]: `${cornerSize.width}px`,
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
