/** What the hook of the mount of a content finds. */
export interface PopupContentReading {
  /** The popup has no `display: none`. */
  shown: boolean;
  /** The input has a size. */
  sized: boolean;
  /** The input has the focus right after its `focus()`. */
  focused: boolean;
}

export type PopupContentMode = 'onMounted' | 'directive';

/** Gives the input the focus, as the hook of the mount of a content does, and reads the result. */
export function focusAtMount(element: HTMLInputElement): PopupContentReading {
  element.focus();
  return {
    shown: !!element.closest('[data-testid="popup"]')?.checkVisibility(),
    sized: element.offsetWidth > 0,
    focused: document.activeElement === element,
  };
}
