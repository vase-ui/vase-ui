import { watch, type Ref } from 'vue';

/**
 * Calls `onReset` after each native reset of the form that owns the element, when no listener
 * prevented the reset. Vue writes the `value` and `checked` attributes at each value, so the form
 * resets a control to its last value, and the part gives its first value itself.
 */
export function useFormReset(
  element: Readonly<Ref<HTMLInputElement | HTMLTextAreaElement | null>>,
  onReset: (event: Event) => void,
) {
  watch(
    element,
    (el, _, onCleanup) => {
      const form = el?.form;
      if (!el || !form) return;
      const listener = (event: Event) => {
        // A form resets only the controls that it owns at that moment: an element that
        // `KeepAlive` holds has no form.
        if (el.form !== event.currentTarget) return;
        // A later listener can still prevent the reset, so the part waits for the end of the
        // event.
        setTimeout(() => {
          if (!event.defaultPrevented) onReset(event);
        });
      };
      form.addEventListener('reset', listener);
      onCleanup(() => form.removeEventListener('reset', listener));
    },
    { flush: 'post' },
  );
}
