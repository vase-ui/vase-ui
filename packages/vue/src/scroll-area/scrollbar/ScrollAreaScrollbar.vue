<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { ScrollAreaRootState } from '../root/ScrollAreaRoot.vue';

export interface ScrollAreaScrollbarState extends ScrollAreaRootState {
  /**
   * Whether the scroll area is being hovered.
   */
  hovering: boolean;
  /**
   * Whether the scroll area is being scrolled.
   */
  scrolling: boolean;
  /**
   * The orientation of the scrollbar.
   */
  orientation: 'vertical' | 'horizontal';
}

export interface ScrollAreaScrollbarProps
  extends
    VaseUIComponentProps<ScrollAreaScrollbarState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether the scrollbar controls vertical or horizontal scroll.
   * @default 'vertical'
   */
  orientation?: 'vertical' | 'horizontal' | undefined;
  /**
   * Whether to keep the HTML element in the DOM when the viewport isn't scrollable.
   * @default false
   */
  keepMounted?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed, provide, watch } from 'vue';
import { contains, getTarget } from '../../common/shadowDom';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useScrollAreaRootContext } from '../root/ScrollAreaRootContext';
import * as ScrollAreaRootCssVars from '../root/ScrollAreaRootCssVars';
import { scrollAreaStateAttributesMapping } from '../root/stateAttributes';
import { getOffset } from '../utils/getOffset';
import { ScrollAreaScrollbarContext } from './ScrollAreaScrollbarContext';
import * as ScrollAreaScrollbarCssVars from './ScrollAreaScrollbarCssVars';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ScrollAreaScrollbarProps>(), {
  as: 'div',
  orientation: 'vertical',
  keepMounted: false,
});

defineSlots<{
  default(props: { state: ScrollAreaScrollbarState }): unknown;
  render: ComponentRenderFn<HTMLProps, ScrollAreaScrollbarState>;
}>();

const {
  hovering,
  scrollingX,
  scrollingY,
  hiddenState,
  scrollbarYElement,
  scrollbarXElement,
  viewportElement,
  thumbYElement,
  thumbXElement,
  handlePointerDown,
  handlePointerUp,
  handleScroll,
  disableViewportSnap,
  rootId,
  thumbSize,
  hasMeasuredScrollbar,
  viewportState,
} = useScrollAreaRootContext();

const direction = useDirection();

const state = computed<ScrollAreaScrollbarState>(() => ({
  ...viewportState.value,
  hovering: hovering.value,
  scrolling: (props.orientation === 'vertical' ? scrollingY : scrollingX).value,
  orientation: props.orientation,
}));

const shouldRender = computed(
  () =>
    props.keepMounted ||
    !(props.orientation === 'vertical' ? hiddenState.value.y : hiddenState.value.x),
);

provide(
  ScrollAreaScrollbarContext,
  computed(() => props.orientation),
);

function getElementHolder(orientation: 'vertical' | 'horizontal') {
  return orientation === 'vertical' ? scrollbarYElement : scrollbarXElement;
}

function handleWheel(event: WheelEvent) {
  const viewport = viewportElement.value;
  // Ctrl with the wheel is the zoom gesture of the browser. Do not take it.
  if (!viewport || event.ctrlKey) {
    return;
  }

  const horizontal = props.orientation === 'horizontal';
  const scrollProperty = horizontal ? 'scrollLeft' : 'scrollTop';
  const delta = horizontal ? event.deltaX : event.deltaY;
  if (delta === 0) {
    return;
  }

  const maxScroll = horizontal
    ? viewport.scrollWidth - viewport.clientWidth
    : viewport.scrollHeight - viewport.clientHeight;
  // In RTL, the horizontal `scrollLeft` goes from 0 down to `-maxScroll`.
  const rtl = horizontal && direction.value === 'rtl';
  const minScroll = rtl ? -maxScroll : 0;
  const maxScrollValue = rtl ? 0 : maxScroll;
  const scrollValue = viewport[scrollProperty];

  // At an edge, or with no overflow, do not call `preventDefault`.
  // The wheel then scrolls the parent or the page.
  if ((scrollValue <= minScroll && delta < 0) || (scrollValue >= maxScrollValue && delta > 0)) {
    return;
  }

  event.preventDefault();

  viewport[scrollProperty] = Math.min(maxScrollValue, Math.max(minScroll, scrollValue + delta));

  handleScroll({ x: viewport.scrollLeft, y: viewport.scrollTop });
}

function handleTrackPointerDown(event: PointerEvent) {
  if (event.button !== 0) {
    return;
  }

  const vertical = props.orientation === 'vertical';
  const target = getTarget(event) as Element | null;
  const thumb = vertical ? thumbYElement.value : thumbXElement.value;

  // Ignore a press on the thumb. Across a shadow boundary, `event.target` is the host.
  // `getTarget` gives the real target.
  if (thumb && contains(thumb, target)) {
    return;
  }

  const viewport = viewportElement.value;
  if (!viewport) {
    return;
  }

  const scrollbar = getElementHolder(props.orientation).value;

  if (!thumb || !scrollbar) {
    return;
  }

  const axis = vertical ? 'y' : 'x';
  const thumbOffset = getOffset(thumb, 'margin', axis);
  const scrollbarOffset = getOffset(scrollbar, 'padding', axis);
  const thumbSizePx = vertical ? thumb.offsetHeight : thumb.offsetWidth;
  const trackRect = scrollbar.getBoundingClientRect();
  const clickPosition = vertical
    ? event.clientY - trackRect.top - thumbSizePx / 2 - scrollbarOffset + thumbOffset / 2
    : event.clientX - trackRect.left - thumbSizePx / 2 - scrollbarOffset + thumbOffset / 2;

  const scrollableSize = vertical ? viewport.scrollHeight : viewport.scrollWidth;
  const viewportSize = vertical ? viewport.clientHeight : viewport.clientWidth;
  const trackSize = vertical ? scrollbar.offsetHeight : scrollbar.offsetWidth;

  const maxThumbOffset = trackSize - thumbSizePx - scrollbarOffset - thumbOffset;
  // A short or padded track gives a `maxThumbOffset` of zero or less when the thumb has the
  // minimum size. A division by it gives a non-finite or an inverted scroll position.
  if (maxThumbOffset <= 0) {
    return;
  }

  const scrollRatio = clickPosition / maxThumbOffset;
  const maxScrollDistance = scrollableSize - viewportSize;

  // Stop the scroll snap before the jump to the press position. If the snap is on, the new
  // position goes to the nearest snap point, and the thumb stays away from the pointer for the
  // whole drag. `handlePointerDown` below calls this again, and the second call changes nothing.
  disableViewportSnap();

  if (vertical) {
    viewport.scrollTop = scrollRatio * maxScrollDistance;
  } else if (direction.value === 'rtl') {
    viewport.scrollLeft = -(1 - scrollRatio) * maxScrollDistance;
  } else {
    viewport.scrollLeft = scrollRatio * maxScrollDistance;
  }

  handleScroll({ x: viewport.scrollLeft, y: viewport.scrollTop });

  handlePointerDown(event);
}

const { element, elementProps } = useRenderElement('div', props, {
  // `useRenderElement` calls this callback only when the element changes. The callback reads the
  // orientation when it runs. While the scrollbar stays mounted, a change of `orientation` does not
  // change the element, so the `watch` below moves the element to the other holder. If the change
  // also mounts or removes the element, the callback runs after the `watch`, because the `watch`
  // runs before the render. The callback then reads the new orientation and writes the right holder.
  ref: (scrollbar) => {
    getElementHolder(props.orientation).value = scrollbar;
  },
  state,
  props: (attrs) => [
    {
      'data-id': `${rootId.value}-scrollbar`,
      'aria-hidden': true,
      onPointerdown: handleTrackPointerDown,
      // A native scrollbar does not move focus when the user presses it, with any button.
      // The track handles this and not the thumb, so that the press that bubbles from the thumb is
      // covered too.
      onMousedown(event: MouseEvent) {
        event.preventDefault();
      },
      onPointerup: handlePointerUp,
      // When the browser cancels a gesture on the track, no thumb has the pointer capture.
      // The track clears the drag state then, as `pointerup` does.
      onPointercancel: handlePointerUp,
      // A browser makes a `wheel` listener passive by default only on the window, the document, the
      // root element and the body. A listener on this element can call `preventDefault`.
      onWheel: handleWheel,
      style: {
        position: 'absolute',
        touchAction: 'none',
        // A server render writes the key `WebkitUserSelect` as `webkit-user-select`, which no
        // browser knows. The key in its CSS form is right on a server and in a browser.
        '-webkit-user-select': 'none',
        userSelect: 'none',
        visibility: !hasMeasuredScrollbar.value && !props.keepMounted ? 'hidden' : undefined,
        ...(props.orientation === 'vertical'
          ? {
              top: 0,
              bottom: `var(${ScrollAreaRootCssVars.scrollAreaCornerHeight})`,
              insetInlineEnd: 0,
              [ScrollAreaScrollbarCssVars.scrollAreaThumbHeight]: `${thumbSize.value.height}px`,
            }
          : {
              insetInlineStart: 0,
              insetInlineEnd: `var(${ScrollAreaRootCssVars.scrollAreaCornerWidth})`,
              bottom: 0,
              [ScrollAreaScrollbarCssVars.scrollAreaThumbWidth]: `${thumbSize.value.width}px`,
            }),
      },
    },
    attrs,
  ],
  stateAttributesMapping: scrollAreaStateAttributesMapping,
});

watch(
  () => props.orientation,
  (orientation, previousOrientation) => {
    const scrollbar = element.value;
    if (!scrollbar) {
      return;
    }

    const previousHolder = getElementHolder(previousOrientation);
    if (previousHolder.value === scrollbar) {
      previousHolder.value = null;
    }
    getElementHolder(orientation).value = scrollbar;
  },
);

defineExpose({ element });
</script>

<template>
  <template v-if="shouldRender">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
    <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
  </template>
</template>
