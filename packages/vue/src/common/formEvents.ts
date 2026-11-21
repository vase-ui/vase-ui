import { watch, type Ref } from 'vue';

type FormControl = HTMLInputElement | HTMLTextAreaElement;

/**
 * Listens to an event of the form that owns the element, while the element is mounted. `reset`
 * and `formdata` bubble from the form, so the listener is on the root node of the element, and it
 * follows the form that owns the element at the event, also one that a `form` attribute names.
 */
export function useFormListener<Type extends keyof HTMLElementEventMap>(
  element: Readonly<Ref<FormControl | null>>,
  type: Type,
  listener: (event: HTMLElementEventMap[Type], form: HTMLFormElement) => void,
) {
  watch(
    element,
    (el, _, onCleanup) => {
      if (!el) return;
      // eslint-disable-next-line no-restricted-syntax -- The form of the element is read at each event. Only a move by `Teleport` into another root node goes unseen, and then the element leaves its form too.
      const root = el.getRootNode();
      const onEvent = (event: Event) => {
        // A form acts only on the controls that it owns at that moment: an element that
        // `KeepAlive` holds has no form.
        const { form } = el;
        if (form && event.target === form) listener(event as HTMLElementEventMap[Type], form);
      };
      root.addEventListener(type, onEvent, true);
      onCleanup(() => root.removeEventListener(type, onEvent, true));
    },
    { flush: 'post' },
  );
}

/**
 * Calls `onReset` after each native reset of the form that owns the element, when no listener
 * prevented the reset. Vue writes the `value` and `checked` attributes at each value, so the form
 * resets a control to its last value, and the part gives the value of the reset itself.
 */
export function useFormReset(
  element: Readonly<Ref<FormControl | null>>,
  onReset: (event: Event) => void,
) {
  useFormListener(element, 'reset', (event) => {
    // A later listener can still prevent the reset, so the part waits for the end of the event.
    setTimeout(() => {
      if (!event.defaultPrevented) onReset(event);
    });
  });
}
