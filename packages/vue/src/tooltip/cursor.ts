import { computed, shallowRef, watch } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { ownerDocument } from '../common/owner';
import type { VirtualElement } from '../popup/placement';
import type { PopupRoot } from '../popup/root';

type Axis = 'x' | 'y' | 'both';

/**
 * The anchor at the mouse pointer for `trackCursorAxis`: a virtual element at the last point of a
 * mouse or a pen on a trigger, on the axis of the prop. The popup follows the pointer on the page
 * while it is open, and stops while the pointer is on the popup.
 */
export function useCursorAnchor(root: PopupRoot, axis: () => 'none' | Axis) {
  const point = shallowRef<{ x: number; y: number; axis: Axis } | null>(null);
  // An open that no move of the pointer made keeps the offset of the point from the trigger, so
  // that the popup stays with its trigger at a scroll.
  const pinned = shallowRef(false);
  let paused = false;

  function record(event: PointerEvent) {
    const current = axis();
    if (event.pointerType === 'touch' || current === 'none') return;
    point.value = { x: event.clientX, y: event.clientY, axis: current };
    pinned.value = false;
  }

  watch(
    () => root.open,
    (open) => {
      if (open) pinned.value = root.reason !== 'trigger-hover';
    },
    { flush: 'sync' },
  );

  watch(
    () => (root.open && axis() !== 'none' ? root.popup : null),
    (popup, _, onCleanup) => {
      if (!popup) return;
      paused = false;
      // Pointer events are composed, so the document gets the moves in each shadow tree.
      onCleanup(
        addEventListener(
          ownerDocument(popup),
          'pointermove',
          (event) => {
            if (event.composedPath().includes(popup)) paused = true;
            else if (!paused) record(event);
          },
          true,
        ),
      );
    },
    { flush: 'post' },
  );

  const anchor = computed<VirtualElement | undefined>(() => {
    const at = point.value;
    const trigger = root.activeTrigger;
    // A tooltip that the focus opened stays at its trigger.
    if (!at || !trigger || axis() === 'none' || root.reason === 'trigger-focus') return undefined;
    const isPinned = pinned.value;
    let offset: { x: number; y: number } | undefined;
    return {
      contextElement: trigger,
      getBoundingClientRect() {
        const rect = trigger.getBoundingClientRect();
        offset ??= { x: at.x - rect.x, y: at.y - rect.y };
        const pointX = isPinned ? rect.x + offset.x : at.x;
        const pointY = isPinned ? rect.y + offset.y : at.y;
        const x = at.axis === 'y' ? rect.x : pointX;
        const y = at.axis === 'x' ? rect.y : pointY;
        const width = at.axis === 'y' ? rect.width : 0;
        const height = at.axis === 'x' ? rect.height : 0;
        return DOMRect.fromRect({ x, y, width, height });
      },
    };
  });

  return {
    anchor,
    /** A move of a mouse or a pen on a trigger: the anchor follows the pointer again. */
    onTriggerPointer(event: PointerEvent) {
      paused = false;
      record(event);
    },
  };
}
