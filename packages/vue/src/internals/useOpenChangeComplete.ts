import { onMounted, onScopeDispose, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { useAnimationsFinished } from './useAnimationsFinished';

/**
 * Calls the provided function when the CSS open/close animation or transition completes.
 */
export function useOpenChangeComplete(parameters: UseOpenChangeCompleteParameters) {
  const { enabled, open, ref, batch = false, restartKey, onComplete } = parameters;

  const runOnceAnimationsFinish = useAnimationsFinished(ref, open, batch);

  let abortController: AbortController | undefined;

  // The wait needs the DOM update, not the paint. A `watch` with `flush: 'post'` runs after it.
  // `watchPostEffect` is not an option: `run` does not read `restartKey`, and a change of
  // `restartKey` must start a run.
  function run() {
    abortController?.abort();
    abortController = undefined;

    if (!(toValue(enabled) ?? true)) {
      return;
    }

    abortController = new AbortController();
    runOnceAnimationsFinish(onComplete, abortController.signal);
  }

  onMounted(run);
  watch([() => toValue(enabled), () => toValue(open), () => toValue(restartKey)], run, {
    flush: 'post',
  });
  onScopeDispose(() => {
    abortController?.abort();
  });
}

export interface UseOpenChangeCompleteParameters {
  /**
   * Whether the composable is enabled.
   * @default true
   */
  enabled?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Whether the element is open.
   */
  open?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * The element that closes, or a ref or a getter for it.
   */
  ref: MaybeRefOrGetter<HTMLElement | null | undefined>;
  /**
   * Whether completions ready in the same microtask may be coalesced into a single flush.
   * Only safe when `onComplete` doesn't read state that another completion can change.
   * @default false
   */
  batch?: boolean | undefined;
  /**
   * Restarts the wait when it changes, such as when the element attaches after the wait started.
   */
  restartKey?: MaybeRefOrGetter<unknown>;
  /**
   * Function to call when the animation completes (or there is no animation).
   */
  onComplete: () => void;
}
