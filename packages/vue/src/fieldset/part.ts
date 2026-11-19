import {
  computed,
  inject,
  onMounted,
  shallowRef,
  toValue,
  watch,
  type InjectionKey,
  type MaybeRefOrGetter,
} from 'vue';

/** What a `Fieldset.Root` gives to the parts in it. The properties are reactive. */
export interface FieldsetForPart {
  /**
   * A disabled `Fieldset.Root` holds the part. This is the answer for the server render and the
   * first render. After the mount, the part asks the browser.
   */
  readonly disabled: boolean;
  /**
   * A disabled `Fieldset.Root` whose element is not a `<fieldset>` holds the part. The browser
   * does not see such a root, so this answer adds to the answer of the browser.
   */
  readonly disabledOutsideBrowser: boolean;
  /** The id of the legend of the nearest `Fieldset.Root`, for a group that nothing else names. */
  readonly legendId: string | undefined;
}

export const fieldsetKey: InjectionKey<FieldsetForPart> = Symbol('fieldset');

/**
 * Whether a disabled fieldset holds the element, by the rule of HTML: a disabled fieldset disables
 * each form control in it, but not in its first `<legend>` child. The `disabled` of the element
 * itself does not count. With no element, the answer comes from the `Fieldset.Root` around.
 */
export function useInDisabledFieldset(element: MaybeRefOrGetter<Element | null | undefined>) {
  const fieldset = inject(fieldsetKey, null);
  const answerOfBrowser = shallowRef<boolean>();
  // A part can give a getter of an element that it declares after this call, so the watch starts
  // at the mount.
  onMounted(() => {
    watch(
      () => toValue(element),
      (el, _, onCleanup) => {
        answerOfBrowser.value = undefined;
        if (!el) return;
        const update = () => (answerOfBrowser.value = inDisabledFieldset(el));
        update();
        // The browser sends no event when `:disabled` changes, so the part watches the `disabled`
        // attribute of each fieldset around it, and the children that can make a first legend.
        const observer = new MutationObserver(update);
        for (let around = fieldsetAround(el); around; around = fieldsetAround(around)) {
          observer.observe(around, { attributeFilter: ['disabled'], childList: true });
        }
        onCleanup(() => observer.disconnect());
      },
      { flush: 'post', immediate: true },
    );
  });
  return computed(
    () => (answerOfBrowser.value ?? !!fieldset?.disabled) || !!fieldset?.disabledOutsideBrowser,
  );
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
