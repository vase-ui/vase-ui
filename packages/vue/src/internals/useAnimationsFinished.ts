import { nextTick, toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { NOOP } from '../common/empty';
import { useAnimationFrame } from '../common/useAnimationFrame';
import { isFiniteAnimation } from '../utils/getFiniteAnimations';
import * as TransitionStatusDataAttributes from './TransitionStatusDataAttributes';
import { createFlushBeforePaint } from './createFlushBeforePaint';

declare global {
  /**
   * When `true`, disables animation-related code, even if supported by the runtime environment.
   */
  var VASE_UI_ANIMATIONS_DISABLED: boolean | undefined;
}

/**
 * Returns a function that queues items and flushes them together in a microtask.
 */
function createMicrotaskQueue<T>(flush: (items: T[]) => void) {
  let pending: T[] = [];
  return (item: T) => {
    if (!pending.length) {
      queueMicrotask(() => {
        const items = pending;
        pending = [];
        flush(items);
      });
    }
    pending.push(item);
  };
}

/**
 * Passes each element's animations to its callback in a microtask.
 * In Blink, `element.getAnimations()` returns early for an element without animations, but
 * otherwise sorts every animation in the tree. Once an element with animations is found, the
 * remaining elements of its tree are served by a single `getAnimations()` call on the tree's root.
 * A root scan for a single remaining element cannot save a sort, so it is skipped.
 */
const getAnimationsBatched = createMicrotaskQueue<
  [element: Element, callback: (animations: Animation[]) => void]
>((lookups) => {
  const animationsByElement = new Map<Element, Animation[] | undefined>();
  for (const [element] of lookups) {
    animationsByElement.set(element, undefined);
  }
  let remaining = animationsByElement.size;
  let animatedRoot: (Node & Partial<DocumentOrShadowRoot>) | undefined;
  let animationsByTarget: Map<Element | null, Animation[]> | undefined;

  for (const [element, callback] of lookups) {
    let animations = animationsByElement.get(element);
    if (!animations) {
      remaining -= 1;
      const root: Node & Partial<DocumentOrShadowRoot> = element.getRootNode();
      if (root === animatedRoot && !animationsByTarget) {
        animationsByTarget = new Map();
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- `animatedRoot` is only a root that has `getAnimations`.
        for (const animation of root.getAnimations!()) {
          const effect = animation.effect as KeyframeEffect;
          // `element.getAnimations()` excludes animations of the element's pseudo-elements.
          if (!effect.pseudoElement) {
            animationsByTarget.set(effect.target, [
              ...(animationsByTarget.get(effect.target) ?? []),
              animation,
            ]);
          }
        }
      }
      animations =
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The block above makes `animationsByTarget` when `root` is `animatedRoot`.
        root === animatedRoot ? (animationsByTarget!.get(element) ?? []) : element.getAnimations();
      if (remaining > 1 && animations.length && element.isConnected && root.getAnimations) {
        animatedRoot ??= root;
      }
      animationsByElement.set(element, animations);
    }
    callback(animations);
  }
});

const flushBeforePaint = createFlushBeforePaint();

let lastCompletion: Promise<void> = Promise.resolve();

// Each completion that is not batched runs after the flush of the completion before it. A later
// completion then observes the state that an earlier completion changed. Only microtasks wait
// here, so the browser does not paint between the end of the animation and the effect of the
// callback: https://github.com/mui/base-ui/issues/979
// An error of a completion, or of the flush that it causes, does not stop the later completions.
function runAfterEarlierCompletions(fnToExecute: () => void, signal: AbortSignal | null) {
  lastCompletion = lastCompletion
    .then(() => {
      // The flush of an earlier completion can abort this completion.
      if (signal?.aborted) {
        return undefined;
      }
      fnToExecute();
      return nextTick();
    })
    .catch((error: unknown) => reportError(error));
}

/**
 * Executes a function once all animations have finished on the provided element.
 * If an animation is canceled, waits for any replacement animations before executing.
 * @param elementOrRef - The element to watch for animations, or a ref or a getter for it.
 * @param waitForStartingStyleRemoved - Whether to wait for [data-starting-style] to be removed before checking for animations. A ref or a getter gives the value when the returned function is called.
 * @param batch - Whether completions ready in the same microtask may be coalesced into a single
 * flush. A batched callback runs before the flush of the state writes of earlier callbacks, so only
 * opt in when the callback doesn't read state that another completion can change.
 * @returns A function that takes a callback to execute once all animations have finished, and an optional AbortSignal to abort the callback
 */
export function useAnimationsFinished(
  elementOrRef: MaybeRefOrGetter<HTMLElement | null | undefined>,
  waitForStartingStyleRemoved: MaybeRefOrGetter<boolean | undefined> = false,
  batch = false,
) {
  const frame = useAnimationFrame();

  return (
    /**
     * A function to execute once all animations have finished.
     */
    fnToExecute: () => void,
    /**
     * An optional [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) that
     * can be used to abort `fnToExecute` before all the animations have finished.
     * @default null
     */
    signal: AbortSignal | null = null,
  ) => {
    frame.cancel();

    const element = toValue(elementOrRef);
    if (element == null) {
      return;
    }

    const resolvedElement = element;

    const done = () => {
      if (!batch) {
        runAfterEarlierCompletions(fnToExecute, signal);
        return;
      }

      flushBeforePaint(() => {
        // Re-check at flush time: the signal may abort between queueing and the flush.
        if (!signal?.aborted) {
          fnToExecute();
        }
      });
    };

    if (
      typeof resolvedElement.getAnimations !== 'function' ||
      globalThis.VASE_UI_ANIMATIONS_DISABLED
    ) {
      fnToExecute();
      return;
    }

    function exec() {
      getAnimationsBatched([resolvedElement, waitForAnimations]);
    }

    function waitForAnimations(animations: Animation[]) {
      // Discard fulfilled Animation values so unfinished animations cannot retain their targets.
      Promise.all(
        animations.filter(isFiniteAnimation).map((animation) => animation.finished.then(NOOP)),
      ).then(
        () => {
          if (!signal?.aborted) {
            done();
          }
        },
        () => {
          // Sometimes animations can be aborted because a property they depend on changes while
          // the animation plays. Wait for the element's current animations, which include any
          // replacement.
          if (!signal?.aborted) {
            exec();
          }
        },
      );
    }

    if (toValue(waitForStartingStyleRemoved)) {
      const startingStyleAttribute = TransitionStatusDataAttributes.startingStyle;

      // If `[data-starting-style]` isn't present, fall back to waiting one more frame
      // to give "open" animations a chance to be registered.
      if (!resolvedElement.hasAttribute(startingStyleAttribute)) {
        frame.request(exec);
        return;
      }

      // Wait for `[data-starting-style]` to have been removed.
      const attributeObserver = new MutationObserver(() => {
        if (!resolvedElement.hasAttribute(startingStyleAttribute)) {
          attributeObserver.disconnect();
          exec();
        }
      });

      attributeObserver.observe(resolvedElement, {
        attributes: true,
        attributeFilter: [startingStyleAttribute],
      });

      signal?.addEventListener('abort', () => attributeObserver.disconnect(), { once: true });
      return;
    }

    frame.request(exec);
  };
}
