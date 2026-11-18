import { computed, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { useOpenChangeComplete } from './useOpenChangeComplete';
import { useTransitionStatus } from './useTransitionStatus';

export interface UseUnmountAfterCloseParameters {
  /**
   * Whether the popup is open.
   */
  open: MaybeRefOrGetter<boolean>;
  /**
   * The element whose closing animations the composable awaits before it unmounts the popup, or a
   * ref or a getter for it.
   */
  ref: MaybeRefOrGetter<HTMLElement | null | undefined>;
  /**
   * Whether the current close cycle asked to keep the popup mounted until the `unmount` action
   * is called. Ignored while `open`.
   */
  preventUnmountOnClose: MaybeRefOrGetter<boolean>;
  /**
   * Writes `preventUnmountOnClose`. Opening starts a new close cycle, so the composable clears it
   * whenever `open` becomes `true`.
   */
  setPreventUnmountOnClose: (preventUnmountOnClose: boolean) => void;
  /**
   * Runs once per unmount, whether it completed automatically or through `forceUnmount`.
   */
  onUnmount: () => void;
  /**
   * Whether a popup that mounts already open should still play its enter transition.
   * See `useTransitionStatus`.
   */
  animateInitialOpen?: boolean | undefined;
}

/**
 * Keeps a popup mounted through its closing animation and unmounts it once the animation
 * finishes, unless the close cycle opted out through `preventUnmountOnClose`.
 *
 * @returns `forceUnmount` unmounts the popup immediately. It is a no-op once the popup is already
 *   unmounted, so calling it after the automatic unmount doesn't repeat the completion callback.
 *   A call while the popup is open takes effect only if the popup is closed after the next flush.
 */
export function useUnmountAfterClose(parameters: UseUnmountAfterCloseParameters) {
  const { open, ref, preventUnmountOnClose, setPreventUnmountOnClose, onUnmount } = parameters;
  const isOpen = () => toValue(open);
  const { mounted, setMounted, transitionStatus } = useTransitionStatus(
    open,
    false,
    false,
    parameters.animateInitialOpen,
    ref,
  );

  // An open starts a new close cycle. The wait reads this value before the watcher below clears
  // the stored value.
  const preventUnmountingOnClose = computed(() =>
    isOpen() ? false : toValue(preventUnmountOnClose),
  );

  // A `v-if` of the consumer can remove the part of the element in the flush of the close. Vue then
  // sets the ref to `null`, so the wait uses the last element. An element out of the document has
  // no CSS animations, and the close ends after one frame. A `<Transition>` of the consumer can
  // keep the element in the document. The close then ends when the animations of the element end.
  let lastElement: HTMLElement | null = null;
  const closeElement = () => toValue(ref) ?? lastElement;

  watch(isOpen, (nextOpen) => {
    if (nextOpen) {
      setPreventUnmountOnClose(false);
      // The unmount clears the last element. An element can stay in the document after the
      // unmount, as with `keepMounted`.
      lastElement = toValue(ref) ?? lastElement;
    }
  });

  function unmount() {
    lastElement = null;
    setMounted(false);
    onUnmount();
  }

  const unmountRequest = shallowRef(0);
  // The `open` of a controlled root changes in the flush, and `nextTick` can run before that
  // flush. A call while open thus waits until the flush ends.
  watch(
    unmountRequest,
    () => {
      if (!isOpen() && mounted.value) {
        unmount();
      }
    },
    { flush: 'post' },
  );

  function forceUnmount() {
    if (!mounted.value) {
      return;
    }
    if (isOpen()) {
      unmountRequest.value += 1;
      return;
    }
    unmount();
  }

  const waitsForClose = computed(
    () => mounted.value && !isOpen() && !preventUnmountingOnClose.value,
  );

  // The wait starts again only when the element attaches.
  const attachCount = shallowRef(0);
  watch(
    () => toValue(ref),
    (element, previousElement) => {
      if (element) {
        lastElement = element;
        if (!previousElement) {
          attachCount.value += 1;
        }
      }
    },
    { flush: 'post' },
  );

  useOpenChangeComplete({
    enabled: waitsForClose,
    open: isOpen,
    ref: closeElement,
    restartKey: attachCount,
    onComplete() {
      if (!isOpen()) {
        forceUnmount();
      }
    },
  });

  return { mounted, transitionStatus, preventUnmountingOnClose, forceUnmount };
}
