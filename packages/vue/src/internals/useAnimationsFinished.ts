import { effectScope, getCurrentScope, nextTick, onScopeDispose, toValue, watch } from 'vue';
import type { EffectScope, MaybeRefOrGetter } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { NOOP } from '../common/empty';
import { AnimationFrame } from '../common/useAnimationFrame';
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
function runAfterEarlierCompletions(fnToExecute: () => void, wait: EffectScope) {
  lastCompletion = lastCompletion
    .then(() => {
      // The flush of an earlier completion can abort this completion.
      if (!wait.active) {
        return undefined;
      }
      fnToExecute();
      return nextTick();
    })
    .catch((error: unknown) => reportError(error));
}

/** Waits for the finite animations of one element, including replacements after cancellation. */
export function useAnimationsFinished(
  elementOrRef: MaybeRefOrGetter<HTMLElement | null | undefined>,
  waitForStartingStyleRemoved: MaybeRefOrGetter<boolean | undefined> = false,
  batch = false,
  isStarting?: () => boolean,
) {
  const owner = getCurrentScope();
  let current: EffectScope | undefined;

  return (onFinish: () => void, signal: AbortSignal | null = null) => {
    current?.stop();
    const element = toValue(elementOrRef);
    if (!element || !owner?.active || signal?.aborted) return;

    if (typeof element.getAnimations !== 'function' || globalThis.VASE_UI_ANIMATIONS_DISABLED) {
      onFinish();
      return;
    }

    // A frame or a native event can start a wait outside the component's active scope.
    const wait = owner.run(() => effectScope());
    if (!wait) return;
    current = wait;

    const finish = () => {
      if (wait.active) {
        wait.stop();
        onFinish();
      }
    };

    const sample = () => {
      if (!wait.active) return;
      getAnimationsBatched([
        element,
        (animations) => {
          if (!wait.active) return;
          Promise.all(
            animations.filter(isFiniteAnimation).map((animation) => animation.finished.then(NOOP)),
          ).then(
            () => {
              if (batch) flushBeforePaint(finish);
              else runAfterEarlierCompletions(finish, wait);
            },
            () => {
              if (wait.active) sample();
            },
          );
        },
      ]);
    };

    wait.run(() => {
      if (signal)
        onScopeDispose(addEventListener(signal, 'abort', () => wait.stop(), { once: true }));
      if (toValue(waitForStartingStyleRemoved)) {
        if (isStarting) {
          if (isStarting()) {
            watch(isStarting, sample, { once: true, flush: 'post' });
            return;
          }
        } else {
          const attribute = TransitionStatusDataAttributes.startingStyle;
          const Observer = element.ownerDocument.defaultView?.MutationObserver;
          if (Observer && element.hasAttribute(attribute)) {
            const observer = new Observer(() => {
              if (!element.hasAttribute(attribute)) {
                observer.disconnect();
                sample();
              }
            });
            onScopeDispose(() => observer.disconnect());
            observer.observe(element, { attributes: true, attributeFilter: [attribute] });
            return;
          }
        }
      }

      // The browser can register an animation in the next frame.
      const id = AnimationFrame.request(sample);
      onScopeDispose(() => AnimationFrame.cancel(id));
    });
  };
}
