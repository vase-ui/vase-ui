import { computed, inject, watch, type InjectionKey, type Ref } from 'vue';
import type { ToolbarOrientation } from './types';

/** An element that the arrow keys of a toolbar reach, while it is mounted. The properties are reactive. */
export interface ToolbarItem {
  readonly element: HTMLElement;
  /** The toolbar stops the presses and the keys of a disabled item that can take the focus. */
  readonly disabled: boolean;
  /** The item can take the focus now. */
  readonly focusable: boolean;
}

/** What a toolbar gives to the parts in it. The properties are reactive. */
export interface ToolbarForPart {
  readonly orientation: ToolbarOrientation;
  /** The toolbar, or a `Toolbar.Group` around the part, is disabled. */
  readonly disabled: boolean;
  /** The item with `tabindex="0"`, after the mount of the items. */
  readonly tabStop: HTMLElement | undefined;
  /** Adds an item. Returns the function that removes it. */
  addItem(item: ToolbarItem): () => void;
}

export const toolbarKey: InjectionKey<ToolbarForPart> = Symbol('toolbar');

export function injectToolbar() {
  const toolbar = inject(toolbarKey, null);
  if (!toolbar) {
    throw new Error(
      'Vase UI: A part of Toolbar must be inside <Toolbar.Root>. Without a root the part has no orientation and no disabled state. Put the part inside <Toolbar.Root>.',
    );
  }
  return toolbar;
}

/** Adds the element to the items of the toolbar while it is mounted. Gives the `tabindex` of the item. */
export function useToolbarItem(
  toolbar: ToolbarForPart,
  element: Readonly<Ref<HTMLElement | null>>,
  flags: { disabled(): boolean; focusable(): boolean },
) {
  watch(
    element,
    (el, _, onCleanup) => {
      if (!el) return;
      onCleanup(
        toolbar.addItem({
          element: el,
          get disabled() {
            return flags.disabled();
          },
          get focusable() {
            return flags.focusable();
          },
        }),
      );
    },
    { flush: 'post' },
  );
  return computed(() => {
    const tabStop = toolbar.tabStop;
    const el = element.value;
    if (!tabStop || !el) return undefined;
    return el === tabStop || isRadioOfGroup(el, tabStop) ? 0 : -1;
  });
}

// Chromium stops Tab at a radio with `tabindex="0"`, and Firefox and WebKit pass it when another
// radio of its group is checked (test/measurements/toolbar.test.ts). With `tabindex="0"` on each
// radio of the group, Tab stops at the checked radio in each browser.
function isRadioOfGroup(element: HTMLElement, tabStop: HTMLElement) {
  return (
    isNamedRadio(element) &&
    isNamedRadio(tabStop) &&
    element.name === tabStop.name &&
    element.form === tabStop.form
  );
}

function isNamedRadio(element: HTMLElement): element is HTMLInputElement {
  return (
    element.localName === 'input' &&
    (element as HTMLInputElement).type === 'radio' &&
    !!(element as HTMLInputElement).name
  );
}
