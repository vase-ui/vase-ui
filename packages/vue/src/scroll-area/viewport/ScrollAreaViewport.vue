<script lang="ts">
import type { CSSProperties, HTMLAttributes } from 'vue';
import { clamp } from '../../common/clamp';
import { platform } from '../../common/platform';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import { MIN_THUMB_SIZE } from '../root/ScrollAreaRootContext';
import type { ScrollAreaRootState } from '../root/ScrollAreaRoot.vue';
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

// Overflow distances change on each scroll. A child can opt in with `inherit`.
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

// Safari shrinks the thumb against the edge during rubber-band overscroll.
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

  // At the end edge, add the lost thumb length to keep the tip in place.
  const offset = maxScroll ? (clamped / maxScroll) * maxThumbOffset : 0;
  return offset + (overscroll > 0 ? size - nextSize : 0);
}
</script>

<script setup lang="ts">
import { computed, provide, watch } from 'vue';
import { NOOP } from '../../common/empty';
import { useResizeObserver } from '../../common/useResizeObserver';
import { useTimeout } from '../../common/useTimeout';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { getFiniteAnimations } from '../../utils/getFiniteAnimations';
import { normalizeScrollOffset } from '../../utils/scrollEdges';
import { styleDisableScrollbar } from '../../utils/styles';
import {
  ScrollAreaViewportContext,
  scrollAreaStateAttributesMapping,
  useScrollAreaRootContext,
} from '../root/ScrollAreaRootContext';
import * as ScrollAreaScrollbarCssVars from '../scrollbar/ScrollAreaScrollbarCssVars';
import { getOffset } from '../utils/getOffset';

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
  setThumbSize,
  rootId,
  setHiddenAxes,
  setOverflowEdges,
  overflowEdgeThreshold,
  markMeasured,
  markHovered,
  registerElement,
  touchModality,
  handleScroll,
  press,
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
    markMeasured();
  }

  if (scrollableContentHeight === 0 || scrollableContentWidth === 0) {
    return;
  }

  const scrollbarYHidden = viewportHeight >= scrollableContentHeight;
  const scrollbarXHidden = viewportWidth >= scrollableContentWidth;
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

  let nextCornerWidth = 0;
  let nextCornerHeight = 0;
  if (!scrollbarXHidden && !scrollbarYHidden) {
    nextCornerWidth = scrollbarYEl?.offsetWidth || 0;
    nextCornerHeight = scrollbarXEl?.offsetHeight || 0;
  }

  if (scrollbarXEl || scrollbarYEl) {
    const ratioX = viewportWidth / scrollableContentWidth;
    const ratioY = viewportHeight / scrollableContentHeight;
    const nextWidth = scrollbarXHidden ? 0 : viewportWidth;
    const nextHeight = scrollbarYHidden ? 0 : viewportHeight;
    // Subtract the corner size from the size of a scrollbar only while the corner has no size.
    // After that, the layout includes the corner.
    const cornerNotYetSized = cornerSize.width === 0 && cornerSize.height === 0;
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

    setThumbSize({ width: clampedNextWidth, height: clampedNextHeight });

    // Bound thumb styles added more than 10% to frame work on both axes.
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
  }

  const overflowMetricsPx = [
    scrollLeftFromStart,
    scrollLeftFromEnd,
    scrollTopFromStart,
    scrollTopFromEnd,
  ];

  // Bound overflow distances added more than 10% to frame work.
  const style = viewportEl.style;
  OVERFLOW_EDGE_VARS.forEach((cssVar, index) => {
    const value = `${overflowMetricsPx[index]}px`;
    if (style.getPropertyValue(cssVar) !== value || style.getPropertyPriority(cssVar)) {
      style.setProperty(cssVar, value);
    }
  });

  if (cornerEl) {
    // The corner size stays 0 while one scrollbar is hidden.
    setCornerSize({ width: nextCornerWidth, height: nextCornerHeight });
  }

  setHiddenAxes(scrollbarXHidden, scrollbarYHidden);
  const threshold = overflowEdgeThreshold.value;
  setOverflowEdges({
    xStart: !scrollbarXHidden && scrollLeftFromStart > threshold.xStart,
    xEnd: !scrollbarXHidden && scrollLeftFromEnd > threshold.xEnd,
    yStart: !scrollbarYHidden && scrollTopFromStart > threshold.yStart,
    yEnd: !scrollbarYHidden && scrollTopFromEnd > threshold.yEnd,
  });
}

provide(ScrollAreaViewportContext, computeThumbPosition);

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

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement<
  ScrollAreaViewportState,
  HTMLElement
>('div', props, {
  state,
  props: (attrs) => [
    {
      'data-id': `${rootId.value}-viewport`,
      // A viewport that does not scroll is out of the tab order.
      // https://accessibilityinsights.io/info-examples/web/scrollable-region-focusable/
      tabindex: state.value.hasOverflowX || state.value.hasOverflowY ? 0 : -1,
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

const pressed = computed(() => press.value?.viewport === element.value);
let declaredSnap: string | undefined;
let savedSnap:
  | {
      viewport: HTMLElement;
      declared: string | undefined;
      suppressed: boolean;
      inline: { value: string; priority: string } | null;
    }
  | undefined;

function readInlineSnap(viewport: HTMLElement) {
  return {
    value: viewport.style.scrollSnapType,
    priority: viewport.style.getPropertyPriority('scroll-snap-type'),
  };
}

watch(
  pressed,
  (active) => {
    const viewport = element.value;
    if (!active || !viewport) {
      return;
    }
    const inline = readInlineSnap(viewport);
    // A second press can start while the first press still owns the inline declaration.
    if (
      savedSnap?.viewport === viewport &&
      savedSnap.suppressed &&
      inline.value === 'none' &&
      inline.priority === 'important'
    ) {
      return;
    }
    savedSnap = { viewport, declared: declaredSnap, suppressed: false, inline };
  },
  { flush: 'sync' },
);

function viewportProps() {
  const base = elementProps();
  const active = pressed.value;
  const style = base.style as CSSProperties;
  declaredSnap = style.scrollSnapType ?? style['scroll-snap-type'];
  if (!savedSnap || savedSnap.viewport !== element.value) {
    return base;
  }

  savedSnap.suppressed = active;
  let value = 'none !important';
  if (!active) {
    if (!savedSnap.inline && declaredSnap !== savedSnap.declared) {
      savedSnap = undefined;
      return base;
    }
    const inline = savedSnap.inline ?? readInlineSnap(savedSnap.viewport);
    value = inline.priority ? `${inline.value} !important` : inline.value;
  }

  const { 'scroll-snap-type': _snap, ...otherStyles } = style;
  return { ...base, style: { ...otherStyles, scrollSnapType: value } };
}

// The shallow ref reports a press that starts and ends before the same patch.
watch(
  press,
  (active) => {
    if (active?.viewport === element.value || !savedSnap?.inline) {
      return;
    }
    const { value, priority } = savedSnap.inline;
    if ((priority ? `${value} !important` : value) === (declaredSnap ?? '')) {
      savedSnap = undefined;
    } else {
      // After the release patch, a script can change its inline declaration again.
      savedSnap.inline = null;
    }
  },
  { flush: 'post' },
);

watch(
  element,
  (viewport, _, onCleanup) => {
    onCleanup(() => {
      if (savedSnap && savedSnap.viewport === viewport) {
        // Vue has no release patch for a viewport whose element leaves during the press.
        if (savedSnap.inline) {
          const { value, priority } = savedSnap.inline;
          viewport.style.setProperty('scroll-snap-type', value, priority);
        }
        savedSnap = undefined;
      }
    });
  },
  { flush: 'sync' },
);

registerElement('viewportElement', element);

const { isHeld, shown } = useKeepAliveState();
watch(
  [
    viewportElement,
    scrollbarXElement,
    scrollbarYElement,
    thumbXElement,
    thumbYElement,
    cornerElement,
    direction,
    overflowEdgeThreshold,
    shown,
  ],
  () => {
    if (element.value && viewportElement.value === element.value && !isHeld.value) {
      computeThumbPosition();
    }
  },
  { flush: 'post' },
);

useResizeObserver(element, (_entries, _observer, firstDelivery) => {
  const viewport = element.value;
  if (!viewport || viewport !== viewportElement.value) return;
  // The first delivery can follow a size change since the mount.
  if (
    firstDelivery &&
    lastMeasuredViewportMetrics[0] === viewport.clientHeight &&
    lastMeasuredViewportMetrics[1] === viewport.scrollHeight &&
    lastMeasuredViewportMetrics[2] === viewport.clientWidth &&
    lastMeasuredViewportMetrics[3] === viewport.scrollWidth
  ) {
    return;
  }
  computeThumbPosition();
});

watch(
  [element, isHeld, shown],
  ([viewport, held], _, onCleanup) => {
    if (!viewport || held) return;
    removeCSSVariableInheritance();
    // The browser sends no enter event when a viewport appears under the pointer.
    if (viewport.matches(':hover')) markHovered();

    let active = true;
    waitForAnimationsTimeout.start(0, () => {
      if (!viewport.ownerDocument.defaultView?.ResizeObserver) return;
      const animations = getFiniteAnimations(viewport, { subtree: true });
      if (!animations.length) return;
      // A paused animation must not retain the targets of finished animations.
      Promise.allSettled(animations.map((animation) => animation.finished.then(NOOP)))
        .then(() => {
          if (active) computeThumbPosition();
        })
        .catch(NOOP);
    });
    onCleanup(() => {
      active = false;
      waitForAnimationsTimeout.clear();
      scrollEndTimeout.clear();
      programmaticScroll = true;
    });
  },
  { flush: 'post' },
);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="viewportProps()" :state="state" />
  <component :is="as" v-else v-bind="viewportProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
