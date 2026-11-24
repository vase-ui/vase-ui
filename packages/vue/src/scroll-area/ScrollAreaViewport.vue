<script setup lang="ts">
import { mergeProps, onMounted, onUnmounted, provide, shallowRef, useAttrs, watch } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { styleDisableScrollbar } from '../common/styles';
import { hasTabStop } from '../common/tabbable';
import { injectScrollArea, stateAttributes, viewportKey } from './root';
import type { ScrollAreaViewportProps, ScrollAreaViewportState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<ScrollAreaViewportProps>();
defineSlots<{
  default?(scope: { state: ScrollAreaViewportState }): unknown;
  element?(scope: ElementSlotProps<ScrollAreaViewportState>): unknown;
}>();

const root = injectScrollArea('Viewport');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
provide(viewportKey, true);

// Chromium makes a scroll container a tab stop only while it holds no tab stop, Firefox makes each
// one a tab stop, and WebKit none (test/measurements/scroll-area.test.ts). The viewport follows
// Chromium: the keyboard scrolls it from a control in its content.
const holdsTabStop = shallowRef(true);
let readLater = false;
let inertObserver: MutationObserver | undefined;
let frame = 0;

function stopPending() {
  inertObserver?.disconnect();
  inertObserver = undefined;
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
}

// The tab stops of content with no box, or under an inert ancestor, do not count. Under `inert`,
// WebKit also gives `isContentEditable` false (test/measurements/scroll-area.test.ts). The
// viewport waits until it has a box again (at the next measurement) and no inert ancestor.
function readContent(fromFrame = false) {
  const target = element.value;
  if (!target) return;
  stopPending();
  const noBox = target.getClientRects().length === 0;
  const inert = target.closest('[inert]');
  readLater = noBox || !!inert;
  if (!readLater) {
    holdsTabStop.value = hasTabStop(target);
    return;
  }
  // Content that changed with no box can hold a new control, so the viewport stays out of the Tab
  // order until it shows again and takes no first focus ahead of that control.
  if (noBox) {
    holdsTabStop.value = true;
    // A hide and show in one frame skips `ResizeObserver`, so one frame callback checks once.
    if (!fromFrame) frame = requestAnimationFrame(() => readContent(true));
  }
  if (inert) {
    inertObserver = new MutationObserver(() => readContent());
    inertObserver.observe(inert, { attributeFilter: ['inert'] });
  }
}

// Nuxt removes the call of `onUnmounted` from its server build, with its arguments, so the part
// registers before the call.
const remove = root.addViewport({
  get element() {
    return element.value;
  },
  measured() {
    if (readLater) readContent();
  },
});
onUnmounted(remove);

watch(
  element,
  (target, _, onCleanup) => {
    if (target) onCleanup(root.observe(target));
  },
  { flush: 'post' },
);

// The watcher runs before the render that writes the overflow, so that render writes the final
// `tabindex`. A control can lose its tab stop through `style` (`v-show`), `class` or `type`
// with no change of nodes (test/measurements/scroll-area.test.ts).
watch(
  () => (root.state.hasOverflowX || root.state.hasOverflowY ? element.value : null),
  (target, _, onCleanup) => {
    if (!target) return;
    readContent();
    const observer = new MutationObserver((records) => {
      // The root writes the overflow variables on the viewport at each scroll.
      if (records.some((record) => record.target !== target || record.type === 'childList')) {
        readContent();
      }
    });
    observer.observe(target, {
      subtree: true,
      childList: true,
      attributeFilter: [
        'tabindex',
        'disabled',
        'inert',
        'hidden',
        'contenteditable',
        'href',
        'style',
        'class',
        'open',
        'type',
        'controls',
      ],
    });
    onCleanup(() => {
      observer.disconnect();
      stopPending();
      readLater = false;
    });
  },
);

// The platform does not say who made a scroll. The scrolls that follow one of these events of the
// user count as scrolls of the user, until 100 ms pass with no scroll.
let byUser = false;
let userScrollEnd: ReturnType<typeof setTimeout> | undefined;
let last = { x: 0, y: 0 };

function markUser() {
  byUser = true;
}

function onScroll() {
  const target = element.value;
  // A listener of the developer can unmount the viewport before this listener runs.
  if (!target) return;
  const position = { x: target.scrollLeft, y: target.scrollTop };
  // WebKit sends the page no event for a touch that catches a momentum scroll.
  if (byUser || root.touch) {
    if (position.y !== last.y) root.scroll(true);
    if (position.x !== last.x) root.scroll(false);
  }
  last = position;
  root.measure();
  clearTimeout(userScrollEnd);
  userScrollEnd = setTimeout(() => (byUser = false), 100);
}

// A script animation sends no event to an element, so the viewport reads the animations that run
// one task after the mount. An animation with no end never calls, and a cancelled one rejects.
let animationsRead: ReturnType<typeof setTimeout> | undefined;
onMounted(() => {
  animationsRead = setTimeout(() => {
    for (const animation of element.value?.getAnimations({ subtree: true }) ?? []) {
      animation.finished.then(root.measure, () => {});
    }
  });
});
onUnmounted(() => {
  clearTimeout(animationsRead);
  clearTimeout(userScrollEnd);
});

defineExpose({ element });

function elementProps() {
  const { hasOverflowX, hasOverflowY } = root.state;
  return mergeProps(
    {
      tabindex: (hasOverflowX || hasOverflowY) && !holdsTabStop.value ? 0 : -1,
      class: styleDisableScrollbar.className,
      style: { overflow: 'scroll' },
      ...stateAttributes(root.state),
      onScroll,
      onWheel: markUser,
      onPointerenter: markUser,
      onPointermove: markUser,
      onKeydown: markUser,
      // A CSS animation or transition in the viewport can change its scroll size with no other
      // event.
      onAnimationend: root.measure,
      onTransitionend: root.measure,
    },
    attrs,
    // During a press the thumb follows the pointer, so scroll snap is off. Vue writes the style
    // keys in order, so this key comes after a `scroll-snap-type` of the developer.
    root.press ? { style: { scrollSnapType: 'none !important' } } : {},
  );
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="root.state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="root.state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="root.state" />
  </div>
</template>
