<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, useId, watch } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { injectDrawer } from './root';
import {
  along,
  axisOf,
  oppositeOf,
  opensAtRelease,
  toward,
  useSwipeTracker,
} from './swipe';
import type { DrawerSwipeAreaProps, DrawerSwipeAreaState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DrawerSwipeAreaProps>(), {
  disabled: false,
  swipeDirection: undefined,
});
defineSlots<{
  default?(scope: { state: DrawerSwipeAreaState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: DrawerSwipeAreaState;
  }): unknown;
}>();

const drawer = injectDrawer('SwipeArea');
const { root } = drawer.dialog;
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const elementId = computed(() => givenId(props.id) ?? generatedId);

const direction = computed(() => props.swipeDirection ?? oppositeOf(drawer.swipeDirection));
const closing = computed(() => oppositeOf(direction.value));

// The area is a trigger of its root: its id names it, and a press on it is no outside press.
// Nuxt removes the call of `onUnmounted` from its server build, with its arguments, so the part
// registers before the call.
const removeTrigger = root.addTrigger({
  get id() {
    return elementId.value;
  },
  get element() {
    return element.value;
  },
  payload: undefined,
  get disabled() {
    return props.disabled;
  },
});
onUnmounted(removeTrigger);

let movement = 0;
let opened = false;
/** The distance from the open place to the closed place of the popup. */
let closed: number | null = null;

function popupSize(popup: HTMLElement) {
  return axisOf(closing.value) === 'x' ? popup.offsetWidth : popup.offsetHeight;
}

// The popup mounts in the class of its enter, at its closed place (test/measurements/drawer.test.ts).
function closedPlace(popup: HTMLElement) {
  const size = popupSize(popup);
  const matrix = new DOMMatrixReadOnly(getComputedStyle(popup).transform);
  const offset = Math.abs(axisOf(closing.value) === 'x' ? matrix.m41 : matrix.m42);
  return offset > 0.5 ? Math.min(size, offset) : size;
}

function follow() {
  const popup = root.popup;
  if (!opened || !root.open || !popup) return;
  closed ??= closedPlace(popup);
  if (!closed) return;
  const shown = Math.max(0, movement);
  const damped = shown > closed ? closed + Math.sqrt(shown - closed) : shown;
  const moved = toward(closing.value, closed - damped);
  drawer.write({ ...moved, progress: 1 - Math.min(shown / closed, 1) });
}

function finish() {
  opened = false;
  closed = null;
  movement = 0;
  drawer.write({ x: 0, y: 0, progress: 0 });
  drawer.setSwiping(false);
}

const enabled = computed(() => !props.disabled && (!root.open || tracker.swiping.value));

const tracker = useSwipeTracker({
  axis: () => axisOf(direction.value),
  captureAtPress: true,
  press(event) {
    if (!enabled.value || root.open) return false;
    // The focus stays where it was. WebKit still selects text, so the area has `user-select: none`
    // (test/measurements/drawer.test.ts).
    if (event.pointerType !== 'touch' && event.cancelable) event.preventDefault();
    return true;
  },
  start() {
    opened = false;
    closed = null;
    movement = 0;
    drawer.write({ x: 0, y: 0, progress: 1, strength: 1 });
    drawer.setSwiping(true);
  },
  move(x, y, event) {
    movement = along(direction.value, x, y);
    if (!opened && movement >= 1) {
      opened = !root.request(true, 'swipe', event, element.value).isCanceled;
    }
    follow();
  },
  end(release) {
    if (release && opened && root.open) {
      const popup = root.popup;
      const keep = opensAtRelease(
        popup ? popupSize(popup) : null,
        movement,
        along(direction.value, release.lastVelocityX, release.lastVelocityY),
      );
      if (!keep) {
        // The popup leaves from the place of the drag.
        if (popup?.style.transition === 'none') popup.style.transition = '';
        popup?.removeAttribute('data-swiping');
        root.request(false, 'swipe', release.event, element.value);
      }
    }
    finish();
  },
});

// The popup of an open by the swipe mounts after the open, and after the leave of an earlier popup.
watch(
  () => root.popup,
  (popup) => {
    if (popup && tracker.swiping.value) follow();
  },
  { flush: 'post' },
);
watch(
  () => root.open,
  (open) => {
    if (!open && opened) tracker.cancel();
  },
);

const state = computed<DrawerSwipeAreaState>(() => ({
  open: root.open,
  swiping: tracker.swiping.value,
  swipeDirection: direction.value,
  disabled: props.disabled,
}));

function elementProps() {
  const { value } = state;
  return mergeProps(
    {
      id: elementId.value,
      role: 'presentation',
      'aria-hidden': 'true',
      'data-open': value.open ? '' : undefined,
      'data-swiping': value.swiping ? '' : undefined,
      'data-swipe-direction': value.swipeDirection,
      'data-disabled': value.disabled ? '' : undefined,
      style: {
        'touch-action': axisOf(direction.value) === 'x' ? 'pan-y' : 'pan-x',
        'user-select': 'none',
        '-webkit-user-select': 'none',
        'pointer-events': enabled.value ? undefined : 'none',
      },
      ...tracker.listeners,
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
