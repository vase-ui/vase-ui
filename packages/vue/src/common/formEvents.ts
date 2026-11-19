import { watch, type Ref } from 'vue';

type FormControl = HTMLInputElement | HTMLTextAreaElement;

/**
 * Listens to an event of the form that owns the element, while the element is mounted. The form
 * of an element is a property of the element and gives no event when it changes, so the listener
 * stays on the form of the mount.
 */
export function useFormListener<Type extends keyof HTMLElementEventMap>(
  element: Readonly<Ref<FormControl | null>>,
  type: Type,
  listener: (event: HTMLElementEventMap[Type], form: HTMLFormElement) => void,
) {
  watch(
    element,
    (el, _, onCleanup) => {
      const form = el?.form;
      if (!el || !form) return;
      const onEvent = (event: HTMLElementEventMap[Type]) => {
        // A form acts only on the controls that it owns at that moment: an element that
        // `KeepAlive` holds has no form.
        if (el.form === form) listener(event, form);
      };
      form.addEventListener(type, onEvent);
      onCleanup(() => form.removeEventListener(type, onEvent));
    },
    { flush: 'post' },
  );
}

/**
 * Calls `onReset` after each native reset of the form that owns the element, when no listener
 * prevented the reset. Vue writes the `value` and `checked` attributes at each value, so the form
 * resets a control to its last value, and the part gives its first value itself.
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
