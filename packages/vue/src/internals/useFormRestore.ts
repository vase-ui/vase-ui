import { onActivated, onDeactivated, shallowRef, watch } from 'vue';
import type { Ref } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { dispatchTakeEvents, isTextControl } from '../common/hydration';
import { ownerWindow } from '../common/owner';

/**
 * Calls `onRestore` at each `pageshow` event of the window of `input` that does not come from the
 * back/forward cache. Call it in `setup`.
 *
 * Chromium can restore the form state of a page after the app is mounted, before `pageshow`, with
 * no event on the input. A page from the back/forward cache keeps its script state, so the part
 * has nothing to take.
 * @param input The element of a control. A ref that a `ref` setter writes.
 * @param onRestore Gets the `pageshow` event.
 */
export function useFormRestore(
  input: Readonly<Ref<Element | null>>,
  onRestore: (event: PageTransitionEvent) => void,
): void {
  // `KeepAlive` takes the input out of the document. The flag is a source of the `watch`, so its
  // cleanup removes the listener of the window.
  const isDeactivated = shallowRef(false);
  onDeactivated(() => {
    isDeactivated.value = true;
  });
  onActivated(() => {
    isDeactivated.value = false;
  });

  watch(
    [input, isDeactivated] as const,
    ([element, deactivated], _previous, onCleanup) => {
      if (!element || deactivated) {
        return;
      }

      onCleanup(
        addEventListener(ownerWindow(element), 'pageshow', (event) => {
          if (!event.persisted) {
            onRestore(event);
          }
        }),
      );
    },
    { flush: 'post' },
  );
}

/**
 * Calls {@link useFormRestore} for a control that takes a restored value through its `input`
 * event. At a restore, an `<input>` or a `<textarea>` whose value is not the value that the part
 * handled last gets the events of {@link dispatchTakeEvents}.
 * @param input The element of the control.
 * @param getHandledValue Gives the value that the part handled last.
 * @param leaves Passed to {@link dispatchTakeEvents}. `false` for an input that the user cannot
 * focus.
 */
export function useFormRestoreAsInput(
  input: Readonly<Ref<Element | null>>,
  getHandledValue: () => string | undefined,
  leaves: boolean,
): void {
  useFormRestore(input, () => {
    const element = input.value;
    if (isTextControl(element) && element.value !== getHandledValue()) {
      dispatchTakeEvents(element, leaves);
    }
  });
}
