import { nextTick, onUnmounted, shallowRef, watch, type ShallowRef } from 'vue';
import type { PopupRoot } from './root';

type Size = { width: number; height: number };

/** What a viewport gives to the popup and the positioner around it. The properties are reactive. */
export interface ViewportSizes {
  /** The size of the popup during a move to another trigger. */
  readonly popup: Size | undefined;
  /** The size of the popup, and of its new content during a move. */
  readonly positioner: Size | undefined;
  /** The side of the new trigger from the old one, such as `'right down'`. */
  readonly direction: string | undefined;
  /** From a move to the end of the animations of the popup. */
  readonly transitioning: boolean;
}

/** The variables of a size, in pixels. */
export function sizeVariables(prefix: 'popup' | 'positioner', size: Size | undefined) {
  return size
    ? { [`--${prefix}-width`]: `${size.width}px`, [`--${prefix}-height`]: `${size.height}px` }
    : {};
}

/**
 * The sizes of a popup whose content changes while it is open. At rest, the positioner has the
 * size of the popup. Call `resize()` before or after the DOM update of the new content. It gives
 * the popup its present size, then the positioner and the popup the size of the new content. When
 * the animations of the popup end, the popup has no size.
 */
export function usePopupSizes(element: () => HTMLElement | null) {
  const popup = shallowRef<Size>();
  const positioner = shallowRef<Size>();
  const transitioning = shallowRef(false);

  watch(
    () => (transitioning.value ? null : element()),
    (current, _, onCleanup) => {
      if (!current) return;
      // A popup with `display: none`, such as one update after its mount, has no size. A
      // positioner with that size would keep the popup at that size. The observer measures the
      // popup when it shows.
      const measure = () => {
        if (current.checkVisibility()) positioner.value = sizeOf(current);
      };
      measure();
      let frame = 0;
      // The positioner can use the size of the popup. A change during observer delivery can resize
      // that ancestor and cause a ResizeObserver loop error.
      const observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(measure);
      });
      observer.observe(current);
      onCleanup(() => {
        observer.disconnect();
        cancelAnimationFrame(frame);
      });
    },
    // A viewport in the content of a popup part mounts after the popup element.
    { flush: 'post', immediate: true },
  );

  let step = 0;
  /** Gives `true` when the steps end, and `false` when a later call or a close stops them. */
  async function resize() {
    const current = element();
    if (!current) return false;
    const own = ++step;
    // At rest, the size of the last layout: the DOM can have the new content already. During the
    // steps, the size of the animation, so a new start goes on from it.
    const from = (!transitioning.value && positioner.value) || sizeOf(current);
    popup.value = from;
    transitioning.value = true;
    await nextTick();
    if (own !== step) return false;
    if (element() !== current) {
      popup.value = undefined;
      transitioning.value = false;
      return false;
    }
    // The size of the new content, with no size of a variable.
    current.style.setProperty('--popup-width', 'auto');
    current.style.setProperty('--popup-height', 'auto');
    const next = sizeOf(current);
    current.style.setProperty('--popup-width', `${from.width}px`);
    current.style.setProperty('--popup-height', `${from.height}px`);
    positioner.value = next;
    popup.value = next;
    await nextTick();
    // A cancelled animation rejects its promise.
    await Promise.allSettled(current.getAnimations().map((animation) => animation.finished));
    if (own !== step) return false;
    popup.value = undefined;
    transitioning.value = false;
    return true;
  }

  return { popup, positioner, transitioning, resize };
}

/**
 * The viewport of a popup that moves between triggers. At a move, the popup gets its old size,
 * then its new size, then no size when its animations end.
 */
export function usePopupViewport(
  root: PopupRoot,
  slot: ShallowRef<ViewportSizes | null>,
  options: {
    /** The root gets the `instant` value `'trigger-change'` when the animations of a move end. */
    triggerChange?: boolean;
  } = {},
) {
  const steps = usePopupSizes(() => (root.open ? root.popup : null));
  const direction = shallowRef<string>();
  const sizes: ViewportSizes = {
    get popup() {
      return steps.popup.value;
    },
    get positioner() {
      return steps.positioner.value;
    },
    get direction() {
      return direction.value;
    },
    get transitioning() {
      return steps.transitioning.value;
    },
  };
  slot.value = sizes;
  onUnmounted(() => {
    if (slot.value === sizes) slot.value = null;
  });

  // The default flush runs before the render of the new content, so the popup has its old size. A
  // close during the animations of a move ends that move, and the popup gets no instant state.
  watch(
    () => (root.open ? root.activeTrigger : null),
    async (trigger, previous, onCleanup) => {
      if (!trigger || !previous || !root.popup) return;
      let stopped = false;
      onCleanup(() => (stopped = true));
      direction.value = directionBetween(previous, trigger);
      const ended = await steps.resize();
      if (ended && !stopped && options.triggerChange) root.setInstant('trigger-change');
    },
  );

  return sizes;
}

function sizeOf(element: HTMLElement): Size {
  return { width: element.offsetWidth, height: element.offsetHeight };
}

// The side of the center of one trigger from the other. A distance of 5 px or less is no side.
function directionBetween(from: Element, to: Element) {
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const side = (distance: number, positive: string, negative: string) =>
    distance > 5 ? positive : distance < -5 ? negative : '';
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  return `${side(dx, 'right', 'left')} ${side(dy, 'down', 'up')}`;
}
