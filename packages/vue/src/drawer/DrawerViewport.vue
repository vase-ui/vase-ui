<script setup lang="ts">
import { computed, mergeProps, nextTick, onUnmounted, provide, useAttrs, watch } from 'vue';
import { useElement } from '../common/element';
import { injectDialogPortal } from '../dialog/root';
import { keepFocus } from '../popup/portal';
import { injectKeyboard } from './keyboard';
import { injectDrawer, viewportKey } from './root';
import { releaseSnap, snapMovement, snapProgress } from './snap';
import {
  along,
  axisOf,
  claimsTouch,
  closesAtRelease,
  ignoresTouch,
  pathTo,
  pressStartsSwipe,
  releaseStrength,
  resist,
  toward,
  useSwipeTracker,
  type SwipeRelease,
} from './swipe';
import type { DrawerViewportProps, DrawerViewportState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<DrawerViewportProps>();
defineSlots<{
  default?(scope: { state: DrawerViewportState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: DrawerViewportState;
  }): unknown;
}>();

const drawer = injectDrawer('Viewport');
const { dialog } = drawer;
injectDialogPortal('Viewport', dialog, 'Drawer');
provide(viewportKey, true);
const { root } = dialog;
const keyboard = injectKeyboard();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

const state = computed<DrawerViewportState>(() => ({
  open: root.open,
  nested: dialog.nested,
  nestedDialogOpen: dialog.dialogsAbove > 0,
}));
const axis = computed(() => axisOf(drawer.swipeDirection));

// The viewport is in the layer of its drawer, so a modal drawer does not hide it from itself.
const removePortalElement = root.addPortalElement(() => element.value);
onUnmounted(removePortalElement);
watch(element, (viewport, _, onCleanup) => {
  drawer.setViewport(viewport);
  if (!viewport) return;
  const html = viewport.ownerDocument.documentElement;
  const observer = new ResizeObserver(() =>
    drawer.setSizes({
      viewport: viewport.offsetHeight,
      rootFontSize: Number.parseFloat(getComputedStyle(html).fontSize),
    }),
  );
  observer.observe(viewport);
  onCleanup(() => observer.disconnect());
});

/** The popup has a selection: the handles of a touch selection take the drag. */
function hasSelection(popup: HTMLElement) {
  const doc = popup.ownerDocument;
  const selection = doc.getSelection();
  if (
    selection &&
    !selection.isCollapsed &&
    (popup.contains(selection.anchorNode) || popup.contains(selection.focusNode))
  ) {
    return true;
  }
  const field = doc.activeElement as HTMLInputElement | null;
  return (
    !!field &&
    popup.contains(field) &&
    /^(?:input|textarea)$/.test(field.localName) &&
    field.selectionStart !== null &&
    field.selectionStart !== field.selectionEnd
  );
}

let pressPath: Element[] = [];
let startedOutside = false;
/** The movement of the popup at the start: its place in an enter that runs. */
let base = { x: 0, y: 0 };
let size = 0;

function sizeOf(popup: HTMLElement) {
  return axis.value === 'x' ? popup.offsetWidth : popup.offsetHeight;
}

function goBack() {
  drawer.write({ x: 0, y: 0, progress: 0 });
  drawer.setSwiping(false);
}

function clearDismiss() {
  for (const target of [root.popup, drawer.backdrop]) {
    target?.removeAttribute('data-swipe-dismiss');
    target?.style.removeProperty('--drawer-swipe-strength');
  }
  drawer.write({ strength: 1 });
}

function dismiss(release: SwipeRelease, traveled: number, restore: () => void) {
  const popup = root.popup;
  const direction = drawer.swipeDirection;
  const velocity =
    along(direction, release.lastVelocityX, release.lastVelocityY) ||
    along(direction, release.velocityX, release.velocityY);
  const strength = releaseStrength(size, traveled, velocity);
  // Vue does not patch an element that leaves in a `<Transition>`, so the release writes the marks
  // of the leave (test/measurements/drawer.test.ts).
  for (const target of [popup, drawer.backdrop]) {
    target?.setAttribute('data-swipe-dismiss', '');
    target?.removeAttribute('data-swiping');
    target?.style.setProperty('--drawer-swipe-strength', String(strength));
  }
  if (popup?.style.transition === 'none') popup.style.transition = '';
  drawer.write({ strength });
  drawer.setSwiping(false);
  root.request(false, 'swipe', release.event);
  // A listener cancelled the close, or the parent kept the drawer open.
  void nextTick(() => {
    if (!root.open) return;
    clearDismiss();
    restore();
    goBack();
  });
}

function release(end: SwipeRelease) {
  const direction = drawer.swipeDirection;
  const movement = along(direction, end.x, end.y);
  const { points, offset, active } = drawer.snap;
  if (points.length === 0) {
    const velocity = along(direction, end.velocityX, end.velocityY);
    if (closesAtRelease(size, movement, velocity)) dismiss(end, movement, () => {});
    else goBack();
    return;
  }
  const target = releaseSnap({
    points,
    offset: offset ?? 0,
    delta: movement,
    velocity: along(direction, end.lastVelocityX, end.lastVelocityY),
    dragVelocity: along(direction, end.velocityX, end.velocityY),
    popupHeight: drawer.height,
    sequential: drawer.snapToSequentialPoints,
    directed: end.directed,
  });
  if (target) {
    drawer.snap.set(target.value, 'swipe', end.event);
    goBack();
    return;
  }
  // A close first asks for no snap point. A cancelled request keeps the drawer open.
  if (!drawer.snap.set(null, 'swipe', end.event)) {
    goBack();
    return;
  }
  dismiss(end, (offset ?? 0) + movement, () => drawer.snap.set(active, 'swipe', end.event));
}

const tracker = useSwipeTracker({
  axis: () => axis.value,
  press(event) {
    const popup = root.popup;
    const viewport = element.value;
    if (!root.open || !popup || !viewport || drawer.nestedOpen > 0) return false;
    pressPath = pathTo(event, viewport);
    if (event.pointerType === 'touch') {
      if (ignoresTouch(pressPath, axis.value) || hasSelection(popup)) return false;
      startedOutside = !pressPath.includes(popup);
      return true;
    }
    if (drawer.isContentPress(event) || !pressStartsSwipe(event, popup, axis.value)) return false;
    startedOutside = false;
    // Firefox and WebKit start a selection at the press, so a later write is too late
    // (test/measurements/drawer.test.ts).
    viewport.style.setProperty('user-select', 'none');
    viewport.style.setProperty('-webkit-user-select', 'none');
    return true;
  },
  claim: (x, y) => claimsTouch(pressPath, drawer.swipeDirection, x, y),
  // A touch that starts outside the popup moves it from the point where it comes in. Its events
  // keep the start element as their target (test/measurements/drawer.test.ts).
  begins(event) {
    if (!startedOutside) return true;
    const rect = root.popup?.getBoundingClientRect();
    return (
      !!rect &&
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  },
  start(event) {
    const popup = root.popup!;
    if (event.pointerType !== 'touch') {
      const selection = popup.ownerDocument.getSelection();
      if (selection && popup.contains(selection.anchorNode)) selection.removeAllRanges();
    }
    // A press while the enter runs starts at the place of the popup, with no jump
    // (test/measurements/drawer.test.ts).
    const moving = new DOMMatrixReadOnly(getComputedStyle(popup).transform);
    popup.style.transition = 'none';
    const resting = new DOMMatrixReadOnly(getComputedStyle(popup).transform);
    base = { x: moving.m41 - resting.m41, y: moving.m42 - resting.m42 };
    size = sizeOf(popup);
    clearDismiss();
    drawer.setSwiping(true);
  },
  move(x, y) {
    const direction = drawer.swipeDirection;
    const movement = along(direction, x, y);
    const { points, offset } = drawer.snap;
    let place: number;
    let progress: number;
    if (points.length > 0) {
      place = snapMovement(offset ?? 0, movement);
      progress = snapProgress(
        points,
        Math.min(Math.max((offset ?? 0) + movement, 0), drawer.height),
      );
    } else {
      place = resist(movement);
      progress = size > 0 ? Math.min(Math.max(movement / size, 0), 1) : 0;
    }
    const moved = toward(direction, place);
    drawer.write({ x: moved.x + base.x, y: moved.y + base.y, progress });
    drawer.setSwiping(true, Math.abs(movement) >= 10);
  },
  end(end) {
    if (end) release(end);
    else goBack();
  },
  done() {
    element.value?.style.removeProperty('user-select');
    element.value?.style.removeProperty('-webkit-user-select');
  },
});

// A gesture ends when its popup goes, and when its drawer closes.
watch(
  () => root.open && root.popup,
  (popup) => {
    if (!popup) tracker.cancel();
  },
);

function onTouchmove(event: TouchEvent) {
  // The keyboard provider reads each move, also a move that the swipe stops.
  keyboard?.onTouchmove(event);
  tracker.onTouchmove(event);
}

function elementProps() {
  const closed = !root.open;
  return mergeProps(
    {
      role: 'presentation',
      // While the popup leaves, a press reaches the page and Tab does not reach the popup.
      inert: closed ? true : undefined,
      hidden: closed && root.keepMounted ? true : undefined,
      'data-nested': dialog.nested ? '' : undefined,
      onMousedown: keepFocus,
      ...tracker.listeners,
      onTouchstartPassive: keyboard?.onTouchstart,
      onTouchmoveCapture: onTouchmove,
      onTouchend: keyboard?.onTouchend,
      onTouchcancel: keyboard?.onTouchcancel,
    },
    attrs,
  );
}

defineExpose({ element });
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
