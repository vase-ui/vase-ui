import { onMounted, onScopeDispose, watch } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { mergeCleanups } from '../common/mergeCleanups';
import { ownerDocument } from '../common/owner';
import { dispatchClickWithModifiers } from '../utils/dispatchClickWithModifiers';
import { isReleaseAtPressPoint } from '../utils/popups/isReleaseAtPressPoint';
import type { PopupRoot } from './root';

/**
 * The press, drag and release of a popup that a mouse press opens at `pointerdown`. The browser
 * sends the `click` of a press that starts on one element and ends on another to their common
 * ancestor (test/measurements/menu.test.ts), so a release on an item gives the item the focus and
 * one `click` itself.
 */
export function usePopupPress(
  root: PopupRoot,
  options: {
    /** The time in milliseconds after the open from which the release on an item acts. */
    delay: number;
    /** The enabled item at the target of a release, which can take a `click`. */
    itemAt: (target: Element) => HTMLElement | null;
    /** The target is in the popup or in a popup above it. */
    inside: (target: Element) => boolean;
    /** The release on this item acts before `delay` when it moved on the vertical axis. */
    earlyRelease?: (item: HTMLElement) => boolean;
    /** A release this many pixels off the edge of the trigger does not close the popup. */
    triggerMargin?: number;
    /** Each later mouse press in the popup that ends on another item gives that item a `click`. */
    laterPress?: boolean;
  },
) {
  let stop: (() => void) | undefined;
  const end = () => {
    stop?.();
    stop = undefined;
  };
  onScopeDispose(end);

  function release(item: HTMLElement, event: PointerEvent) {
    item.focus({ preventScroll: true });
    dispatchClickWithModifiers(item, event, { detail: 1, pointerType: 'mouse' });
  }

  function onOpeningRelease(press: PointerEvent, trigger: Element, event: PointerEvent) {
    end();
    if (event.type !== 'pointerup' || isReleaseAtPressPoint(press, event)) return;
    const target = event.composedPath()[0] as Element;
    const item = options.itemAt(target);
    if (item) {
      const early =
        !!options.earlyRelease?.(item) &&
        Math.abs(event.clientY - press.clientY) >= DRAG_DISTANCE;
      if (early || event.timeStamp - press.timeStamp >= options.delay) release(item, event);
      return;
    }
    if (trigger.contains(target) || options.inside(target)) return;
    const rect = trigger.getBoundingClientRect();
    const margin = options.triggerMargin ?? 0;
    const onTrigger =
      event.clientX >= rect.left - margin &&
      event.clientX <= rect.right + margin &&
      event.clientY >= rect.top - margin &&
      event.clientY <= rect.bottom + margin;
    if (!onTrigger) root.request(false, 'cancel-open', event);
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
                const target = event.composedPath()[0] as Element;
                pressed =
                  event.pointerType === 'mouse' && event.button === 0 && options.inside(target)
                    ? options.itemAt(target)
                    : undefined;
              },
              true,
            ),
            addEventListener(
              doc,
              'pointerup',
              (event) => {
                if (pressed === undefined || stop) return;
                const item = options.itemAt(event.composedPath()[0] as Element);
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
    /** Starts the gesture at the `pointerdown` on the trigger that opened the popup. */
    start(press: PointerEvent, trigger: Element) {
      end();
      const doc = ownerDocument(trigger);
      const listener = (event: PointerEvent) => onOpeningRelease(press, trigger, event);
      stop = mergeCleanups(
        addEventListener(doc, 'pointerup', listener, true),
        addEventListener(doc, 'pointercancel', listener, true),
      );
    },
  };
}

// Base UI starts a drag across the items after 8 px of vertical travel.
const DRAG_DISTANCE = 8;
