import { onMounted, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, Ref, WatchSource } from 'vue';
import { AnimationFrame } from '../common/useAnimationFrame';

export type TransitionStatus = 'starting' | 'ending' | 'idle' | undefined;

function watchFrame<T>(source: () => T, effect: (phase: T) => (() => void) | undefined) {
  onMounted(() => {
    watch(
      source,
      (phase, _, onCleanup) => {
        const callback = effect(phase);
        if (callback) {
          const id = AnimationFrame.request(callback);
          onCleanup(() => AnimationFrame.cancel(id));
        }
      },
      { immediate: true, flush: 'post' },
    );
  });
}

/**
 * Provides a status string for CSS animations.
 * @param open - a ref or a getter for a boolean that determines if the element is open.
 * @param enableIdleState - a boolean that enables the `'idle'` state between `'starting'` and `'ending'`
 * @param deferEndingState - a boolean that delays the `'ending'` state by a frame
 * @param animateInitialOpen - a boolean that makes an element which mounts already open still go
 *   through `'starting'`. Off by default so content that was open on the first render (a
 *   `defaultOpen` popup on page load, SSR'd markup) doesn't animate in.
 * @param element - the element that gets `data-starting-style`, or a ref or a getter for it. When
 *   the status is `'starting'`, the composable reads the layout of the element one time before it
 *   removes the status. Omit it for an element that has no enter transition.
 */
export function useTransitionStatus(
  open: WatchSource<boolean>,
  enableIdleState = false,
  deferEndingState = false,
  animateInitialOpen = false,
  element?: MaybeRefOrGetter<Element | null | undefined>,
): {
  mounted: Readonly<Ref<boolean>>;
  setMounted: (mounted: boolean) => void;
  transitionStatus: Readonly<Ref<TransitionStatus>>;
} {
  const isOpen = () => toValue(open);
  const transitionStatus = shallowRef<TransitionStatus>(
    isOpen() && enableIdleState ? 'idle' : undefined,
  );
  // With `animateInitialOpen`, `mounted` starts at `false` while open. The first run of the
  // watcher below then gives the `'starting'` status. The watcher runs in `setup`, so the element
  // mounts with that status.
  const mounted = shallowRef(isOpen() && !animateInitialOpen);

  function setMounted(nextMounted: boolean) {
    mounted.value = nextMounted;
  }

  // A sync watcher runs in the write that changes `open`, before the component renders.
  // The component then renders one time with the new status.
  watch(
    [isOpen, mounted, transitionStatus],
    () => {
      if (isOpen() && !mounted.value) {
        mounted.value = true;
        transitionStatus.value = 'starting';
      }

      if (!isOpen() && mounted.value && transitionStatus.value !== 'ending' && !deferEndingState) {
        transitionStatus.value = 'ending';
      }

      if (!isOpen() && !mounted.value && transitionStatus.value === 'ending') {
        transitionStatus.value = undefined;
      }
    },
    { flush: 'sync', immediate: true },
  );

  if (deferEndingState) {
    const needsEndingFrame = () =>
      !isOpen() && mounted.value && transitionStatus.value !== 'ending';
    watchFrame(needsEndingFrame, (needed) =>
      needed
        ? () => {
            transitionStatus.value = 'ending';
          }
        : undefined,
    );
  }

  if (enableIdleState) {
    const openPhase = () => {
      if (!isOpen() || !mounted.value) return undefined;
      const phase = transitionStatus.value;
      return phase === 'starting' || phase === 'idle' ? phase : 'reopen';
    };
    watchFrame(openPhase, (phase) => {
      if (phase === 'reopen') {
        transitionStatus.value = 'starting';
      } else if (phase === 'starting') {
        toValue(element)?.getBoundingClientRect();
        return () => {
          transitionStatus.value = 'idle';
        };
      }
      return undefined;
    });
  } else {
    const openPhase = () => (isOpen() ? transitionStatus.value : undefined);
    watchFrame(openPhase, (phase) => {
      if (phase === undefined) return undefined;
      // Compute the enter style before the frame removes its attribute.
      if (phase === 'starting') toValue(element)?.getBoundingClientRect();
      return () => {
        transitionStatus.value = undefined;
      };
    });
  }

  return {
    mounted,
    setMounted,
    transitionStatus,
  };
}
