<script lang="ts">
import type { HTMLAttributes } from 'vue';
import { clamp } from '../../common/clamp';
import { platform } from '../../common/platform';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import { MIN_THUMB_SIZE } from '../constants';
import type { HiddenState, ScrollAreaRootState } from '../root/ScrollAreaRoot.vue';
import * as ScrollAreaViewportCssVars from './ScrollAreaViewportCssVars';

export interface ScrollAreaViewportState extends ScrollAreaRootState {}

export interface ScrollAreaViewportProps
  extends
    VaseUIComponentProps<ScrollAreaViewportState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}

const OVERFLOW_EDGE_VARS = [
  ScrollAreaViewportCssVars.scrollAreaOverflowXStart,
  ScrollAreaViewportCssVars.scrollAreaOverflowXEnd,
  ScrollAreaViewportCssVars.scrollAreaOverflowYStart,
  ScrollAreaViewportCssVars.scrollAreaOverflowYEnd,
];

// One flag for the module, so that the CSS properties register one time for all scroll areas.
let scrollAreaOverflowVarsRegistered = false;

/**
 * Stops the inheritance of the overflow CSS variables of the scroll area.
 * This makes a scroll area with a deep subtree faster.
 * A child that needs a variable must set it to `inherit`.
 * See the section "Improving CSS variable performance" of
 * https://motion.dev/blog/web-animation-performance-tier-list
 */
function removeCSSVariableInheritance() {
  if (
    scrollAreaOverflowVarsRegistered ||
    // In Safari, a child with the value `inherit` does not get the variable when `inherits` is
    // `false`. Skip the registration there, so that the CSS features work.
    platform.engine.webkit
  ) {
    return;
  }

  if (typeof CSS !== 'undefined' && 'registerProperty' in CSS) {
    OVERFLOW_EDGE_VARS.forEach((name) => {
      try {
        CSS.registerProperty({
          name,
          syntax: '<length>',
          inherits: false,
          initialValue: '0px',
        });
      } catch {
        // A property that is registered already throws an error.
      }
    });
  }

  scrollAreaOverflowVarsRegistered = true;
}

function getHiddenState(viewport: HTMLElement): HiddenState {
  const y = viewport.clientHeight >= viewport.scrollHeight;
  const x = viewport.clientWidth >= viewport.scrollWidth;

  return {
    y,
    x,
    corner: y || x,
  };
}

/**
 * Returns `prev` when `next` has the same values.
 * A ref does not trigger for the same object, so a scroll frame with no change updates no part.
 */
function pickState<T extends object>(prev: T, next: T): T {
  for (const key in next) {
    if (prev[key as keyof T] !== next[key as keyof T]) {
      return next;
    }
  }

  return prev;
}

/**
 * Sizes the thumb and returns its offset on the axis.
 * On overscroll, the thumb gets smaller and stays against the edge.
 * Only the rubber band of Safari makes an overscroll.
 * The factor `content / (content + overscroll)` gives the feedback of a native scrollbar.
 * The size goes through the thumb size variable. The `var(...)` size of a thumb at rest then still
 * applies.
 */
function applyOverscrollThumb(
  thumbEl: HTMLElement,
  sizeVar: string,
  scrollFromStart: number,
  maxScroll: number,
  content: number,
  size: number,
  maxThumbOffset: number,
): number {
  const clamped = clamp(scrollFromStart, 0, maxScroll);
  const overscroll = scrollFromStart - clamped;
  const nextSize = Math.max(MIN_THUMB_SIZE, (size * content) / (content + Math.abs(overscroll)));

  // An empty string removes the override. The `var(...)` size of a thumb at rest then applies again.
  thumbEl.style.setProperty(sizeVar, overscroll ? `${nextSize}px` : '');

  // The offset is proportional to the scroll position.
  // At the end edge, add the shrink to the offset, so that the thumb stays at the edge.
  // At the start edge, the offset stays 0.
  const offset = maxScroll ? (clamped / maxScroll) * maxThumbOffset : 0;
  return offset + (overscroll > 0 ? size - nextSize : 0);
}
</script>

<script setup lang="ts">
import {
  normalizeStyle,
  onActivated,
  onDeactivated,
  onMounted,
  provide,
  shallowRef,
  watch,
} from 'vue';
import { NOOP } from '../../common/empty';
import { useTimeout } from '../../common/useTimeout';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { getFiniteAnimations } from '../../utils/getFiniteAnimations';
import { normalizeScrollOffset } from '../../utils/scrollEdges';
import { styleDisableScrollbar } from '../../utils/styles';
import { useScrollAreaRootContext } from '../root/ScrollAreaRootContext';
import { scrollAreaStateAttributesMapping } from '../root/stateAttributes';
import * as ScrollAreaScrollbarCssVars from '../scrollbar/ScrollAreaScrollbarCssVars';
import { getOffset } from '../utils/getOffset';
import { ScrollAreaViewportContext } from './ScrollAreaViewportContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ScrollAreaViewportProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ScrollAreaViewportState }): unknown;
  render: ComponentRenderFn<HTMLProps, ScrollAreaViewportState>;
}>();

const {
  viewportElement,
  scrollbarYElement,
  scrollbarXElement,
  thumbYElement,
  thumbXElement,
  cornerElement,
  cornerSize,
  setCornerSize,
  thumbSize,
  setThumbSize,
  rootId,
  hiddenState,
  setHiddenState,
  overflowEdges,
  setOverflowEdges,
  overflowEdgeThreshold,
  setHasMeasuredScrollbar,
  setHovering,
  touchModality,
  handleScroll,
  viewportSnapDisabled,
  viewportState: state,
} = useScrollAreaRootContext();

const direction = useDirection();

const scrollEndTimeout = useTimeout();
const waitForAnimationsTimeout = useTimeout();

let programmaticScroll = true;
const lastMeasuredViewportMetrics: [number, number, number, number] = [NaN, NaN, NaN, NaN];

function computeThumbPosition() {
  const viewportEl = viewportElement.value;
  const scrollbarYEl = scrollbarYElement.value;
  const scrollbarXEl = scrollbarXElement.value;
  const thumbYEl = thumbYElement.value;
  const thumbXEl = thumbXElement.value;
  const cornerEl = cornerElement.value;

  if (!viewportEl) {
    return;
  }

  const scrollableContentHeight = viewportEl.scrollHeight;
  const scrollableContentWidth = viewportEl.scrollWidth;
  const viewportHeight = viewportEl.clientHeight;
  const viewportWidth = viewportEl.clientWidth;
  const scrollTop = viewportEl.scrollTop;
  const scrollLeft = viewportEl.scrollLeft;
  const isFirstMeasurement = Number.isNaN(lastMeasuredViewportMetrics[0]);

  lastMeasuredViewportMetrics[0] = viewportHeight;
  lastMeasuredViewportMetrics[1] = scrollableContentHeight;
  lastMeasuredViewportMetrics[2] = viewportWidth;
  lastMeasuredViewportMetrics[3] = scrollableContentWidth;

  if (isFirstMeasurement) {
    setHasMeasuredScrollbar(true);
  }

  if (scrollableContentHeight === 0 || scrollableContentWidth === 0) {
    return;
  }

  const nextHiddenState = getHiddenState(viewportEl);
  const scrollbarYHidden = nextHiddenState.y;
  const scrollbarXHidden = nextHiddenState.x;
  const ratioX = viewportWidth / scrollableContentWidth;
  const ratioY = viewportHeight / scrollableContentHeight;
  const maxScrollLeft = Math.max(0, scrollableContentWidth - viewportWidth);
  const maxScrollTop = Math.max(0, scrollableContentHeight - viewportHeight);

  let scrollLeftFromStart = 0;
  let scrollLeftFromEnd = 0;
  if (!scrollbarXHidden) {
    // `normalizeScrollOffset` clamps the value.
    scrollLeftFromStart = normalizeScrollOffset(
      direction.value === 'rtl' ? -scrollLeft : scrollLeft,
      maxScrollLeft,
    );
    scrollLeftFromEnd = maxScrollLeft - scrollLeftFromStart;
  }

  const scrollTopFromStart = scrollbarYHidden ? 0 : normalizeScrollOffset(scrollTop, maxScrollTop);
  const scrollTopFromEnd = scrollbarYHidden ? 0 : maxScrollTop - scrollTopFromStart;
  const nextWidth = scrollbarXHidden ? 0 : viewportWidth;
  const nextHeight = scrollbarYHidden ? 0 : viewportHeight;

  let nextCornerWidth = 0;
  let nextCornerHeight = 0;
  if (!scrollbarXHidden && !scrollbarYHidden) {
    nextCornerWidth = scrollbarYEl?.offsetWidth || 0;
    nextCornerHeight = scrollbarXEl?.offsetHeight || 0;
  }

  // Subtract the corner size from the size of a scrollbar only while the corner has no size.
  // After that, the layout includes the corner.
  const cornerNotYetSized = cornerSize.value.width === 0 && cornerSize.value.height === 0;
  const cornerWidthOffset = cornerNotYetSized ? nextCornerWidth : 0;
  const cornerHeightOffset = cornerNotYetSized ? nextCornerHeight : 0;

  const scrollbarXOffset = getOffset(scrollbarXEl, 'padding', 'x');
  const scrollbarYOffset = getOffset(scrollbarYEl, 'padding', 'y');
  const thumbXOffset = getOffset(thumbXEl, 'margin', 'x');
  const thumbYOffset = getOffset(thumbYEl, 'margin', 'y');

  const idealNextWidth = nextWidth - scrollbarXOffset - thumbXOffset;
  const idealNextHeight = nextHeight - scrollbarYOffset - thumbYOffset;

  const maxNextWidth = scrollbarXEl
    ? Math.min(scrollbarXEl.offsetWidth - cornerWidthOffset, idealNextWidth)
    : idealNextWidth;
  const maxNextHeight = scrollbarYEl
    ? Math.min(scrollbarYEl.offsetHeight - cornerHeightOffset, idealNextHeight)
    : idealNextHeight;

  const clampedNextWidth = Math.max(MIN_THUMB_SIZE, maxNextWidth * ratioX);
  const clampedNextHeight = Math.max(MIN_THUMB_SIZE, maxNextHeight * ratioY);

  setThumbSize(pickState(thumbSize.value, { width: clampedNextWidth, height: clampedNextHeight }));

  if (scrollbarYEl && thumbYEl) {
    const maxThumbOffsetY =
      scrollbarYEl.offsetHeight - clampedNextHeight - scrollbarYOffset - thumbYOffset;

    const thumbOffsetY = applyOverscrollThumb(
      thumbYEl,
      ScrollAreaScrollbarCssVars.scrollAreaThumbHeight,
      scrollTop,
      maxScrollTop,
      scrollableContentHeight,
      clampedNextHeight,
      maxThumbOffsetY,
    );
    thumbYEl.style.transform = `translate3d(0,${thumbOffsetY}px,0)`;
  }

  if (scrollbarXEl && thumbXEl) {
    const maxThumbOffsetX =
      scrollbarXEl.offsetWidth - clampedNextWidth - scrollbarXOffset - thumbXOffset;
    // In RTL, `scrollLeft` goes from 0 down to `-maxScrollLeft`.
    // Measure from the inline start edge, so that the overscroll math is the same for each
    // direction. Then flip the offset below.
    const scrollFromStart = direction.value === 'rtl' ? -scrollLeft : scrollLeft;

    const offsetX = applyOverscrollThumb(
      thumbXEl,
      ScrollAreaScrollbarCssVars.scrollAreaThumbWidth,
      scrollFromStart,
      maxScrollLeft,
      scrollableContentWidth,
      clampedNextWidth,
      maxThumbOffsetX,
    );
    thumbXEl.style.transform = `translate3d(${direction.value === 'rtl' ? -offsetX : offsetX}px,0,0)`;
  }

  const overflowMetricsPx = [
    scrollLeftFromStart,
    scrollLeftFromEnd,
    scrollTopFromStart,
    scrollTopFromEnd,
  ];

  OVERFLOW_EDGE_VARS.forEach((cssVar, index) => {
    viewportEl.style.setProperty(cssVar, `${overflowMetricsPx[index]}px`);
  });

  if (cornerEl) {
    // The corner size stays 0 while one scrollbar is hidden.
    setCornerSize(
      pickState(cornerSize.value, { width: nextCornerWidth, height: nextCornerHeight }),
    );
  }

  setHiddenState(pickState(hiddenState.value, nextHiddenState));

  const nextOverflowEdges = {
    xStart: !scrollbarXHidden && scrollLeftFromStart > overflowEdgeThreshold.value.xStart,
    xEnd: !scrollbarXHidden && scrollLeftFromEnd > overflowEdgeThreshold.value.xEnd,
    yStart: !scrollbarYHidden && scrollTopFromStart > overflowEdgeThreshold.value.yStart,
    yEnd: !scrollbarYHidden && scrollTopFromEnd > overflowEdgeThreshold.value.yEnd,
  };

  setOverflowEdges(pickState(overflowEdges.value, nextOverflowEdges));
}

provide(ScrollAreaViewportContext, { computeThumbPosition });

function handleUserInteraction() {
  programmaticScroll = false;
}

function handleViewportScroll() {
  // A listener of the consumer runs before this listener. It can unmount the viewport.
  if (!viewportElement.value) {
    return;
  }

  computeThumbPosition();

  // WebKit sends no event for a touch that catches a momentum scroll or a rubber band bounce.
  // It does not send `touchstart` either. No event then shows that a user made the scroll.
  // So in touch modality, each scroll is a user scroll.
  if (touchModality.value || !programmaticScroll) {
    handleScroll({
      x: viewportElement.value.scrollLeft,
      y: viewportElement.value.scrollTop,
    });
  }

  // A momentum scroll sends no more user events, so the flag becomes `true` again only when the
  // scroll stops. No browser gives a reliable scroll end event. 100 ms with no scroll event is
  // the end of a scroll.
  // https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollend_event
  scrollEndTimeout.start(100, () => {
    programmaticScroll = true;
  });
}

const { element, elementProps: renderElementProps } = useRenderElement('div', props, {
  ref: (viewport) => {
    viewportElement.value = viewport;
  },
  state,
  props: (attrs) => [
    {
      'data-id': `${rootId.value}-viewport`,
      // A viewport that does not scroll is out of the tab order.
      // https://accessibilityinsights.io/info-examples/web/scrollable-region-focusable/
      tabindex: hiddenState.value.x && hiddenState.value.y ? -1 : 0,
      class: styleDisableScrollbar.className,
      style: { overflow: 'scroll' },
      onScroll: handleViewportScroll,
      onWheel: handleUserInteraction,
      onPointermove: handleUserInteraction,
      onPointerenter: handleUserInteraction,
      onKeydown: handleUserInteraction,
    },
    attrs,
  ],
  stateAttributesMapping: scrollAreaStateAttributesMapping,
});

// `useRenderElement` merges the `style` attribute and `stateStyle` of the consumer after the props
// of the part. The temporary `scroll-snap-type: none` of a thumb drag must win over them, so the
// part merges it last.
function elementProps() {
  const outProps = renderElementProps();

  if (viewportSnapDisabled.value) {
    outProps.style = normalizeStyle([outProps.style, { scrollSnapType: 'none' }]);
  }

  return outProps;
}

onMounted(removeCSSVariableInheritance);

// A change of the hidden state mounts or removes a scrollbar and a thumb.
// Wait one microtask, so that their elements exist.
// A change of the direction or of a threshold also needs a new measurement.
function measureAfterUpdate() {
  queueMicrotask(computeThumbPosition);
}
onMounted(measureAfterUpdate);
watch(
  [
    hiddenState,
    direction,
    () => overflowEdgeThreshold.value.xStart,
    () => overflowEdgeThreshold.value.xEnd,
    () => overflowEdgeThreshold.value.yStart,
    () => overflowEdgeThreshold.value.yEnd,
  ],
  measureAfterUpdate,
  { flush: 'post' },
);

// No enter event comes for a pointer that is already over the viewport, at load or when `KeepAlive`
// brings the viewport back.
function setHoveringIfHovered() {
  if (viewportElement.value?.matches(':hover')) {
    setHovering(true);
  }
}
onMounted(setHoveringIfHovered);

// `KeepAlive` takes the element of a deactivated viewport out of the document. The element then has
// no layout, so the observer and the timers stop until the viewport is active again.
const isDeactivated = shallowRef(false);

onDeactivated(() => {
  isDeactivated.value = true;
  scrollEndTimeout.clear();
  // The timer that was cleared would have set the flag.
  programmaticScroll = true;
});

onActivated(() => {
  // `onActivated` also runs at the first mount inside `KeepAlive`.
  if (!isDeactivated.value) {
    return;
  }

  isDeactivated.value = false;
  // The browser resets the scroll position of an element that left the document. It sends no
  // scroll event, so the viewport measures again.
  measureAfterUpdate();
  // The root cleared the hover state on deactivation.
  setHoveringIfHovered();
});

watch(
  [element, isDeactivated],
  ([viewport, deactivated], _previous, onCleanup) => {
    if (typeof ResizeObserver === 'undefined' || !viewport || deactivated) {
      return;
    }

    let hasInitialized = false;
    const resizeObserver = new ResizeObserver(() => {
      // The first delivery of the observer repeats the measurement of the mount.
      // Skip it when the four metrics are the same.
      // If a size changed before the delivery, measure again, so that the overflow state is right.
      if (!hasInitialized) {
        hasInitialized = true;
        if (
          lastMeasuredViewportMetrics[0] === viewport.clientHeight &&
          lastMeasuredViewportMetrics[1] === viewport.scrollHeight &&
          lastMeasuredViewportMetrics[2] === viewport.clientWidth &&
          lastMeasuredViewportMetrics[3] === viewport.scrollWidth
        ) {
          return;
        }
      }

      computeThumbPosition();
    });

    resizeObserver.observe(viewport);

    // Wait until the animations of the subtree end. Then measure again, because an animation with
    // a transform can change the geometry of the thumb.
    waitForAnimationsTimeout.start(0, () => {
      const animations = getFiniteAnimations(viewport, { subtree: true });
      if (animations.length === 0) {
        return;
      }

      // `allSettled` stays pending while one animation is not finished, and it keeps each
      // fulfilled value. A fulfilled `finished` promise holds its `Animation`, and the `Animation`
      // holds its target. Discard the values with `then(NOOP)`, so that a removed target can go.
      // `allSettled` never rejects. But `computeThumbPosition` can run after the unmount, so
      // `catch` stops an unhandled rejection.
      Promise.allSettled(animations.map((animation) => animation.finished.then(NOOP)))
        .then(computeThumbPosition)
        .catch(NOOP);
    });

    onCleanup(() => {
      resizeObserver.disconnect();
      waitForAnimationsTimeout.clear();
    });
  },
  { flush: 'post' },
);

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
