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
 * The viewport of a popup that moves between triggers. At a move, the popup gets its old size,
 * then its new size one frame later, then no size when its animations end.
 */
export function usePopupViewport(
  root: PopupRoot,
  slot: ShallowRef<ViewportSizes | null>,
  options: {
    /** The root gets the `instant` value `'trigger-change'` when the animations of a move end. */
    triggerChange?: boolean;
  } = {},
) {
  const popup = shallowRef<Size>();
  const positioner = shallowRef<Size>();
  const direction = shallowRef<string>();
  const transitioning = shallowRef(false);
  const sizes: ViewportSizes = {
    get popup() {
      return popup.value;
    },
    get positioner() {
      return positioner.value;
    },
    get direction() {
      return direction.value;
    },
    get transitioning() {
      return transitioning.value;
    },
  };
  slot.value = sizes;
  onUnmounted(() => {
    if (slot.value === sizes) slot.value = null;
  });

  // The positioner has the size of the popup, so that a style can animate a change of the content.
  watch(
    () => (root.open && !transitioning.value ? root.popup : null),
    (element, _, onCleanup) => {
      if (!element) return;
      const measure = () => (positioner.value = sizeOf(element));
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      onCleanup(() => observer.disconnect());
    },
    { flush: 'post' },
  );

  let move = 0;
  // The default flush runs before the render of the new content, so the popup has its old size.
  watch(
    () => (root.open ? root.activeTrigger : null),
    async (trigger, previous) => {
      const element = root.popup;
      if (!trigger || !previous || !element) return;
      const current = ++move;
      direction.value = directionBetween(previous, trigger);
      popup.value = sizeOf(element);
      transitioning.value = true;
      await nextTick();
      if (current !== move) return;
      // The size of the new content, with no size of a variable.
      element.style.setProperty('--popup-width', 'auto');
      element.style.setProperty('--popup-height', 'auto');
      const next = sizeOf(element);
      element.style.setProperty('--popup-width', `${popup.value.width}px`);
      element.style.setProperty('--popup-height', `${popup.value.height}px`);
      positioner.value = next;
      popup.value = next;
      await nextTick();
      // A cancelled animation rejects its promise.
      await Promise.allSettled(element.getAnimations().map((animation) => animation.finished));
      if (current !== move) return;
      popup.value = undefined;
      transitioning.value = false;
      if (options.triggerChange) root.setInstant('trigger-change');
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
