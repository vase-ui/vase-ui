import {
  computed,
  inject,
  onActivated,
  onDeactivated,
  shallowRef,
  watch,
  type InjectionKey,
  type Ref,
} from 'vue';
import type { ToolbarOrientation } from './types';

/** An element that the arrow keys of a toolbar reach, while it is mounted. The properties are reactive. */
export interface ToolbarItem {
  readonly element: HTMLElement;
  /** The toolbar stops the presses and the keys of a disabled item that can take the focus. */
  readonly disabled: boolean;
  /** The item can take the focus now. */
  readonly focusable: boolean;
  /** `KeepAlive` holds the item out of the document. */
  readonly held: boolean;
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
  // Vue keeps the element ref of an item that `KeepAlive` holds, so the item stays in the list.
  const held = shallowRef(false);
  onDeactivated(() => (held.value = true));
  onActivated(() => (held.value = false));
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
          get held() {
            return held.value;
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
// radio of its group is checked. With no radio checked, Firefox passes the group when its first
// radio has -1, and Chromium when the radio that had the focus has -1
// (test/measurements/toolbar.test.ts). With `tabindex="0"` on each radio of the group, Tab stops in
// the group in each browser: at the checked radio, or at a radio that the browser picks.
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
