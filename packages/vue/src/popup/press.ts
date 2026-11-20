import { onMounted, shallowRef, watch } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { mergeCleanups } from '../common/mergeCleanups';
import { isElement } from '../common/element';
import { ownerDocument } from '../common/owner';
import { dispatchClickWithModifiers } from '../common/dispatchClickWithModifiers';
import { isReleaseAtPressPoint } from './isReleaseAtPressPoint';
import type { PopupRoot } from './root';

/** The times in milliseconds from the press after which its release acts. */
export interface PressDelays {
  /** A release on an item clicks it. */
  item: number;
  /** A release outside the popup and the trigger closes the popup. */
  outside?: number;
}

/**
 * The press, drag and release of a popup that a mouse press opens. The browser sends the `click` of
 * a press that starts on one element and ends on another to their common ancestor
 * (test/measurements/select.test.ts), so a release on an item gives the item one `click` itself,
 * and the focus in a list that is not virtual.
 */
export function usePopupPress(
  root: PopupRoot,
  options: {
    /** The enabled item in the path of a release, which can take a `click`. */
    itemAt: (path: readonly Element[]) => HTMLElement | null;
    /** The element is in the popup or in a popup above it. */
    inside: (element: Element) => boolean;
    /** The release on this item acts before its delay when it moved on the vertical axis. */
    earlyRelease?: (item: HTMLElement) => boolean;
    /** A release this many pixels off the edge of the trigger does not close the popup. */
    triggerMargin?: number;
    /** Each later mouse press in the popup that ends on another item gives that item a `click`. */
    laterPress?: boolean;
    /** The control keeps the focus at a release on an item, and names the highlighted item. */
    virtual?: boolean;
  },
) {
  // The opening press, from the event that opened the popup to its release.
  const opening = shallowRef<{ press: MouseEvent; trigger: Element; delays: PressDelays } | null>(
    null,
  );
  const end = () => (opening.value = null);
  watch(
    opening,
    (current, _, onCleanup) => {
      if (!current) return;
      const doc = ownerDocument(current.trigger);
      const listener = (event: PointerEvent) => {
        end();
        onOpeningRelease(current, event);
      };
      onCleanup(
        mergeCleanups(
          addEventListener(doc, 'pointerup', listener, true),
          addEventListener(doc, 'pointercancel', listener, true),
        ),
      );
    },
    { flush: 'sync' },
  );

  function release(item: HTMLElement, event: PointerEvent) {
    if (!options.virtual) item.focus({ preventScroll: true });
    dispatchClickWithModifiers(item, event, { detail: 1, pointerType: 'mouse' });
  }

  function onOpeningRelease(
    { press, trigger, delays }: { press: MouseEvent; trigger: Element; delays: PressDelays },
    event: PointerEvent,
  ) {
    if (event.type !== 'pointerup' || isReleaseAtPressPoint(press, event)) return;
    const elapsed = event.timeStamp - press.timeStamp;
    const path = event.composedPath().filter(isElement);
    const item = options.itemAt(path);
    if (item) {
      const early =
        !!options.earlyRelease?.(item) && Math.abs(event.clientY - press.clientY) >= DRAG_DISTANCE;
      if (early || elapsed >= delays.item) release(item, event);
      return;
    }
    if (path.some((element) => element === trigger || options.inside(element))) return;
    if (elapsed < (delays.outside ?? 0) || nearTrigger(trigger, event)) return;
    root.request(false, 'cancel-open', event);
  }

  function nearTrigger(trigger: Element, event: PointerEvent) {
    const margin = options.triggerMargin;
    if (margin === undefined) return false;
    const rect = trigger.getBoundingClientRect();
    return (
      event.clientX >= rect.left - margin &&
      event.clientX <= rect.right + margin &&
      event.clientY >= rect.top - margin &&
      event.clientY <= rect.bottom + margin
    );
  }

  watch(
    () => root.open,
    (open) => {
      if (!open) end();
    },
    { flush: 'sync' },
  );

  // The listeners of the document start after the mount, so a server render adds none.
  onMounted(() => {
    if (!options.laterPress) return;
    watch(
      () => root.open,
      (open, _, onCleanup) => {
        if (!open) return;
        const doc = ownerDocument(root.activeTrigger);
        let pressed: Element | null | undefined;
        onCleanup(
          mergeCleanups(
            addEventListener(
              doc,
              'pointerdown',
              (event) => {
                const path = event.composedPath().filter(isElement);
                pressed =
                  event.pointerType === 'mouse' && event.button === 0 && path.some(options.inside)
                    ? options.itemAt(path)
                    : undefined;
              },
              true,
            ),
            addEventListener(
              doc,
              'pointerup',
              (event) => {
                if (pressed === undefined || opening.value) return;
                const item = options.itemAt(event.composedPath().filter(isElement));
                if (item && item !== pressed) release(item, event);
                pressed = undefined;
              },
              true,
            ),
          ),
        );
      },
      { flush: 'sync', immediate: true },
    );
  });

  return {
    /**
     * Starts the gesture at the event that opened the popup: the `pointerdown` on the trigger, or
     * the `contextmenu` of a press that is still down.
     */
    start(press: MouseEvent, trigger: Element, delays: PressDelays) {
      opening.value = { press, trigger, delays };
    },
  };
}

// Base UI starts a drag across the items after 8 px of vertical travel.
const DRAG_DISTANCE = 8;
