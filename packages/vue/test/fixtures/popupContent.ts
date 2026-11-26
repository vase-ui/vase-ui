export interface PopupContentReading {
  shown: boolean;
  sized: boolean;
  focused: boolean;
}

export type PopupContentMode = 'onMounted' | 'directive';

export function focusAtMount(element: HTMLInputElement): PopupContentReading {
  element.focus();
  return {
    shown: !!element.closest('[data-testid="popup"]')?.checkVisibility(),
    sized: element.offsetWidth > 0,
    focused: document.activeElement === element,
  };
}
