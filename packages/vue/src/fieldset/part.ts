import { computed, inject, shallowRef, watch, type InjectionKey, type Ref } from 'vue';

/** What a `Fieldset.Root` gives to the parts in it. The properties are reactive. */
export interface FieldsetForPart {
  /**
   * A disabled `Fieldset.Root` holds the part. This is the answer for the server render and the
   * first render. After the mount, the part asks the browser.
   */
  readonly disabled: boolean;
}

export const fieldsetKey: InjectionKey<FieldsetForPart> = Symbol('fieldset');

/**
 * Whether a disabled fieldset holds the element, by the rule of HTML: a disabled fieldset disables
 * each form control in it, but not in its first `<legend>` child. The `disabled` of the element
 * itself does not count.
 */
export function useInDisabledFieldset(element: Readonly<Ref<Element | null>>) {
  const fieldset = inject(fieldsetKey, null);
  const answerOfBrowser = shallowRef<boolean>();
  watch(
    element,
    (el, _, onCleanup) => {
      if (!el) return;
      const update = () => (answerOfBrowser.value = inDisabledFieldset(el));
      update();
      // The browser sends no event when `:disabled` changes, so the part watches the `disabled`
      // attribute of each fieldset around it.
      const observer = new MutationObserver(update);
      for (let around = fieldsetAround(el); around; around = fieldsetAround(around)) {
        observer.observe(around, { attributeFilter: ['disabled'] });
      }
      onCleanup(() => observer.disconnect());
    },
    { flush: 'post' },
  );
  return computed(() => answerOfBrowser.value ?? !!fieldset?.disabled);
}

function fieldsetAround(element: Element) {
  return element.parentElement?.closest('fieldset');
}

function inDisabledFieldset(element: Element): boolean {
  const fieldset = fieldsetAround(element);
  if (!fieldset) return false;
  // The browser matches `:disabled` on a fieldset with `disabled`, and on a fieldset that a
  // disabled fieldset holds.
  return fieldset.querySelector(':scope > legend')?.contains(element)
    ? inDisabledFieldset(fieldset)
    : fieldset.matches(':disabled');
}
