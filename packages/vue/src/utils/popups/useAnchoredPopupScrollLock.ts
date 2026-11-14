import { onMounted, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { ownerDocument } from '../../common/owner';
import { useScrollLock } from '../../common/useScrollLock';

// Touch-opened popups normally avoid scroll locking so users can still swipe outside to dismiss.
// This hook re-enables scroll lock only when the popup is effectively full-width.
// Treat popups with up to 20px of total horizontal gutter as full-width so common ~10px side
// padding still locks scroll, since that leaves too little outside space for a reliable swipe.
const VIEWPORT_WIDTH_TOLERANCE_PX = 20;

/**
 * Manages scroll lock for anchored popups. For non-touch opens, scroll lock is applied when
 * enabled. For touch opens, scroll lock is applied only when the positioner width is effectively
 * viewport-sized.
 */
export function useAnchoredPopupScrollLock(
  enabled: MaybeRefOrGetter<boolean>,
  touchOpen: MaybeRefOrGetter<boolean>,
  positionerElement: MaybeRefOrGetter<HTMLElement | null>,
  referenceElement: MaybeRefOrGetter<Element | null>,
): void {
  const touchOpenShouldLockScroll = shallowRef(false);

  function measure() {
    const positioner = toValue(positionerElement);
    if (!toValue(enabled) || !toValue(touchOpen) || positioner == null) {
      touchOpenShouldLockScroll.value = false;
      return;
    }

    const viewportWidth = ownerDocument(positioner).documentElement.clientWidth;
    const popupWidth = positioner.offsetWidth;

    touchOpenShouldLockScroll.value =
      viewportWidth > 0 &&
      popupWidth > 0 &&
      popupWidth >= viewportWidth - VIEWPORT_WIDTH_TOLERANCE_PX;
  }

  // The scroll lock comes after these two, so a flush measures the popup first and then locks.
  onMounted(measure);
  watch(
    [() => toValue(enabled), () => toValue(touchOpen), () => toValue(positionerElement)],
    measure,
    { flush: 'post' },
  );

  useScrollLock(
    () => toValue(enabled) && (!toValue(touchOpen) || touchOpenShouldLockScroll.value),
    referenceElement,
  );
}
