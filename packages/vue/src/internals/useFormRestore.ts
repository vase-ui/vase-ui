import { computed, shallowRef, watch } from 'vue';
import type { Ref } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { dispatchTakeEvents, isTextControl } from '../common/hydration';
import { ownerWindow } from '../common/owner';
import { sanitizeValue } from './useFormEntryValue';
import { useInputRender } from './useInputRender';
import { useKeepAliveState } from './useKeepAliveState';

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
 * A part that mounts in a held branch does not wait while `KeepAlive` holds it. Its input was not
 * in the document when the browser restored the form state.
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
  // `isHeld` is a source of the `watch`, so its cleanup removes the listener while `KeepAlive`
  // holds the part.
  const { isHeld } = useKeepAliveState();

  let waitsForPageshow = false;

  watch(
    [input, isHeld] as const,
    ([element, held], _previous, onCleanup) => {
      if (!element || held) {
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
 * Takes a silent browser restore through the control's input event. Until pageshow, an unrelated
 * render must leave the browser's text in place. A new model or a refused edit owns the next render.
 */
export function useFormRestoreAsInput<Value>(
  input: Readonly<Ref<Element | null>>,
  getValue: () => Value,
  leaves: boolean,
  uncontrolledText?: () => string | undefined,
) {
  const render = useInputRender();
  const model = computed(getValue);
  const binding = computed(() => ({ props: render.valueProps(model.value), applied: false }));
  const waitsForPageshow = useFormRestore(input, () => {
    const element = input.value;
    if (!isTextControl(element) || element.type === 'hidden') {
      return;
    }
    // A pending render already owns this input.
    if (model.value !== undefined && !binding.value.applied) {
      return;
    }
    const lastText = model.value === undefined ? uncontrolledText?.() : undefined;
    const text = String(model.value ?? element.defaultValue);
    if (
      lastText !== undefined
        ? element.value !== lastText
        : element.value !== text && element.value !== sanitizeValue(element, text)
    ) {
      dispatchTakeEvents(element, leaves);
    }
  });

  const resetTarget = shallowRef<HTMLInputElement | null>(null);
  watch(
    [input, resetTarget],
    ([current, element], [previous]) => {
      // A replacement input starts with the model, even if the old input held a silent edit.
      if (current && previous && current !== previous && model.value !== undefined) {
        render.renderValue();
      }
      if (element && element === current && model.value !== undefined) {
        const text = String(model.value ?? '');
        if (element.defaultValue !== text) {
          // Vue also sets the value attribute when it binds the restored text, which changes form.reset().
          element.defaultValue = text;
        }
      }
      resetTarget.value = null;
    },
    { flush: 'post' },
  );

  function valueProps() {
    const current = binding.value;
    if (current.applied && waitsForPageshow()) {
      const element = input.value;
      const text = String(current.props.value);
      if (
        isTextControl(element) &&
        element.type !== 'hidden' &&
        element.value !== text &&
        element.value !== sanitizeValue(element, text)
      ) {
        if (element.localName === 'input') {
          resetTarget.value = element as HTMLInputElement;
        }
        return { value: element.value };
      }
    }
    current.applied = true;
    return current.props;
  }
  return { valueProps, renderValue: render.renderValue };
}
