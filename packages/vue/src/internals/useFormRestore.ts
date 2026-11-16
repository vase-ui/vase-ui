import { onActivated, onBeforeUpdate, onDeactivated, onUpdated, shallowRef, watch } from 'vue';
import type { Ref } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { dispatchTakeEvents, isTextControl } from '../common/hydration';
import { ownerWindow } from '../common/owner';
import { isInHeldBranch } from './useKeepAliveState';

// `pageshow` comes in the task of `load`, after its listeners. `loadEventEnd` is 0 until then.
function isBeforePageshow(win: Window) {
  const navigation = win.performance.getEntriesByType('navigation')[0] as
    PerformanceNavigationTiming | undefined;
  return navigation?.loadEventEnd === 0;
}

/**
 * Calls `onRestore` at each `pageshow` event of the window of `input` that does not come from the
 * back/forward cache. Call it in `setup`.
 *
 * Chromium can restore the form state of a page after the app is mounted, before `pageshow`, with
 * no event on the input. A page from the back/forward cache keeps its script state, so the part
 * has nothing to take.
 *
 * `KeepAlive` takes the input out of the document, and the part then has no listener. When `load`
 * ends while `KeepAlive` holds a part that waits, the part calls `onRestore` with no event at its
 * next activation.
 * A part that mounts in a held branch does not wait. Its input was not in the document when the
 * browser restored the form state.
 * @param input An element of the part, such as its input. A ref that a `ref` setter writes.
 * @param onRestore Gets the `pageshow` event. Gets no event at an activation.
 * @returns Gives `true` from a mount or an activation before the `pageshow` event of the page until
 * the part gets that event or calls `onRestore`. The value does not change while `KeepAlive` holds
 * the part.
 */
export function useFormRestore(
  input: Readonly<Ref<Element | null>>,
  onRestore: (event?: PageTransitionEvent) => void,
): () => boolean {
  // The flag is a source of the `watch`, so its cleanup removes the listener while `KeepAlive`
  // holds the part.
  const isDeactivated = shallowRef(isInHeldBranch());
  onDeactivated(() => {
    isDeactivated.value = true;
  });
  onActivated(() => {
    isDeactivated.value = false;
  });

  let waitsForPageshow = false;

  watch(
    [input, isDeactivated] as const,
    ([element, deactivated], _previous, onCleanup) => {
      if (!element || deactivated) {
        return;
      }

      const win = ownerWindow(element);
      if (!waitsForPageshow) {
        waitsForPageshow = isBeforePageshow(win);
      } else if (!isBeforePageshow(win)) {
        // The page showed while `KeepAlive` held the part.
        waitsForPageshow = false;
        onRestore();
      }
      const removeListener = addEventListener(win, 'pageshow', (event) => {
        waitsForPageshow = false;
        if (!event.persisted) {
          onRestore(event);
        }
      });
      onCleanup(removeListener);
    },
    { flush: 'post' },
  );

  return () => waitsForPageshow;
}

/**
 * Calls {@link useFormRestore} for a control that takes a restored value through its `input`
 * event. At a restore, an `<input>` or a `<textarea>` whose value is not the value that the part
 * handled last gets the events of {@link dispatchTakeEvents}.
 *
 * While the part waits for its `pageshow` event, as {@link useFormRestore} gives, a render of the
 * part that gives the input its earlier value keeps a value that the part did not handle. Call it in
 * the component that renders the input, because it uses the `onBeforeUpdate` and `onUpdated` hooks
 * of that component.
 * @param input The element of the control.
 * @param getHandledValue Gives the value that the input had after the last event that the part
 * handled, or after the last write of Vue or of the part. The value sanitization of the input type
 * can change the text of the state of the part, so the part does not give that text.
 * @param leaves Passed to {@link dispatchTakeEvents}. `false` for an input that the user cannot
 * focus.
 */
export function useFormRestoreAsInput(
  input: Readonly<Ref<Element | null>>,
  getHandledValue: () => string | undefined,
  leaves: boolean,
): void {
  const waitsForPageshow = useFormRestore(input, () => {
    const element = input.value;
    if (isTextControl(element) && element.value !== getHandledValue()) {
      dispatchTakeEvents(element, leaves);
    }
  });

  // Chromium restores the form state in a task after the parse, and `pageshow` can come much later.
  // Vue writes the key `value` at each render, also when the state of the part stays.
  let unhandled:
    | {
        element: HTMLInputElement | HTMLTextAreaElement;
        value: string;
        handledValue: string | undefined;
      }
    | undefined;
  onBeforeUpdate(() => {
    const element = input.value;
    if (!waitsForPageshow() || !isTextControl(element)) {
      return;
    }
    const handledValue = getHandledValue();
    if (element.value !== handledValue) {
      unhandled = { element, value: element.value, handledValue };
    }
  });
  onUpdated(() => {
    // A render that gave the input a new value keeps it.
    if (unhandled && unhandled.element.value === unhandled.handledValue) {
      unhandled.element.value = unhandled.value;
    }
    unhandled = undefined;
  });
}
