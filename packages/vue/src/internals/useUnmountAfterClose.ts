import { computed, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, WatchSource } from 'vue';
import { useOpenChangeComplete } from './useOpenChangeComplete';
import { useTransitionStatus } from './useTransitionStatus';

export interface UseUnmountAfterCloseParameters {
  /**
   * Whether the popup is open.
   */
  open: WatchSource<boolean>;
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
 * Store-agnostic: hosts sync `mounted` and `transitionStatus` wherever they need them.
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
  watch(isOpen, (nextOpen) => {
    if (nextOpen) {
      setPreventUnmountOnClose(false);
    }
  });

  function unmount() {
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

  // The wait starts again only when the element attaches. A wait that starts again when the
  // element detaches has no element and never completes.
  const attachCount = shallowRef(0);
  watch(
    () => toValue(ref) != null,
    (attached) => {
      if (attached) {
        attachCount.value += 1;
      }
    },
    { flush: 'post' },
  );

  useOpenChangeComplete({
    enabled: waitsForClose,
    open: isOpen,
    ref,
    restartKey: attachCount,
    onComplete() {
      if (!isOpen()) {
        forceUnmount();
      }
    },
  });

  return { mounted, transitionStatus, preventUnmountingOnClose, forceUnmount };
}
