import { onMounted, onScopeDispose, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, Ref, WatchSource } from 'vue';
import { AnimationFrame } from '../common/useAnimationFrame';

export type TransitionStatus = 'starting' | 'ending' | 'idle' | undefined;

/**
 * Runs `effect` at mount and after each DOM update that follows a change of a source.
 * `effect` returns the animation frame that it requests. The next run and the end of the scope
 * cancel that frame.
 * A server has no `requestAnimationFrame`, and a server render does not run `effect`: it runs no
 * `onMounted` hook and no `watch` that has a callback and no `immediate`.
 */
function registerFrameEffect(sources: WatchSource[], effect: () => number | undefined) {
  let frame: number | undefined;
  const cancel = () => {
    if (frame !== undefined) {
      AnimationFrame.cancel(frame);
      frame = undefined;
    }
  };
  const run = () => {
    cancel();
    frame = effect();
  };
  onMounted(run);
  watch(sources, run, { flush: 'post' });
  onScopeDispose(cancel);
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
  enableIdleState: boolean = false,
  deferEndingState: boolean = false,
  animateInitialOpen: boolean = false,
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

  // `getBoundingClientRect` exists on each `Element`. `offsetHeight` exists only on `HTMLElement`,
  // so on an `<svg>` it reads nothing and the browser computes no layout.
  const readLayout = () => {
    toValue(element)?.getBoundingClientRect();
  };

  if (deferEndingState) {
    registerFrameEffect([isOpen, mounted, transitionStatus], () =>
      !isOpen() && mounted.value && transitionStatus.value !== 'ending'
        ? AnimationFrame.request(() => {
            transitionStatus.value = 'ending';
          })
        : undefined,
    );
  }

  if (enableIdleState) {
    registerFrameEffect([isOpen, mounted, transitionStatus], () => {
      if (!isOpen()) {
        return undefined;
      }

      if (transitionStatus.value === 'starting') {
        readLayout();
      } else if (mounted.value && transitionStatus.value !== 'idle') {
        // A reopen in the middle of an exit. This run is before the DOM update that applies the
        // status, so it must not read the layout. The watcher runs again after that update.
        transitionStatus.value = 'starting';
      }

      return AnimationFrame.request(() => {
        transitionStatus.value = 'idle';
      });
    });
  } else {
    registerFrameEffect([isOpen, transitionStatus], () => {
      // Nothing to clear when the element mounted open or reopened after its exit settled.
      if (!isOpen() || transitionStatus.value === undefined) {
        return undefined;
      }

      // The read comes after the DOM update that applies `data-starting-style`. The browser then
      // computes the style of the element with the attribute before the frame callback removes it.
      // A stale `'ending'` status needs no read, because the element has a computed style.
      if (transitionStatus.value === 'starting') {
        readLayout();
      }

      return AnimationFrame.request(() => {
        // Vue applies this write in the microtask after the frame callback, before the browser
        // computes the style of the frame. Without the read above, the element never has a
        // computed style with the attribute. Chromium and Firefox then do not start the enter
        // transition.
        // See https://github.com/mui/base-ui/pull/3424
        transitionStatus.value = undefined;
      });
    });
  }

  return {
    mounted,
    setMounted,
    transitionStatus,
  };
}
