import { nextTick, onUnmounted, shallowRef, watch, type CSSProperties, type ShallowRef } from 'vue';
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
 * Keeps the edge of the popup that faces its anchor in place while the popup changes its size: at
 * the side `top` and at the physical side `left`, the popup grows away from the anchor.
 */
export function anchoredEdgeStyle(side: 'top' | 'bottom' | 'left' | 'right'): CSSProperties {
  if (side === 'top') return { position: 'absolute', bottom: 0 };
  if (side === 'left') return { position: 'absolute', right: 0 };
  return {};
}

/**
 * The sizes of a popup whose content changes while it is open. At rest, the positioner has the
 * size of the popup. `resize()`, called before or after the DOM update of the new content, gives
 * the popup the size that it has, gives the positioner and then the popup the size of the new
 * content, and gives the popup no size when its animations end.
 */
export function usePopupSizes(element: () => HTMLElement | null) {
  const popup = shallowRef<Size>();
  const positioner = shallowRef<Size>();
  const transitioning = shallowRef(false);

  watch(
    () => (transitioning.value ? null : element()),
    (current, _, onCleanup) => {
      if (!current) return;
      const measure = () => (positioner.value = sizeOf(current));
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(current);
      onCleanup(() => observer.disconnect());
    },
    { flush: 'post' },
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
    // The read applies the old size, so that a CSS transition goes from it to the new size.
    sizeOf(current);
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
export function usePopupViewport(root: PopupRoot, slot: ShallowRef<ViewportSizes | null>) {
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

  // The default flush runs before the render of the new content, so the popup has its old size.
  watch(
    () => (root.open ? root.activeTrigger : null),
    async (trigger, previous) => {
      if (!trigger || !previous || !root.popup) return;
      direction.value = directionBetween(previous, trigger);
      if (await steps.resize()) root.setInstant('trigger-change');
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
