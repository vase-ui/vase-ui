import type { InjectionKey } from 'vue';
import type { List } from '../list/list';
import type { MenuContext } from '../menu/root';

/** What a menubar gives to its menus and their triggers. The properties are reactive. */
export interface MenubarForMenu {
  readonly element: HTMLElement | null;
  readonly orientation: 'horizontal' | 'vertical';
  readonly modal: boolean;
  readonly disabled: boolean;
  /** The list of the triggers. */
  readonly list: List;
  readonly openMenu: MenuContext | null;
  /** The elements of the triggers. */
  readonly triggers: readonly Element[];
  /** The `tabindex` of a trigger: 0 for the tab stop of the bar, and none before the mount. */
  tabIndex(element: Element | null): 0 | -1 | undefined;
  /** Adds a trigger and its menu while it is mounted. */
  addTrigger(element: Element, menu: () => MenuContext | null, disabled: () => boolean): () => void;
  /** The bar has one open menu. */
  setOpen(menu: MenuContext, open: boolean): void;
  /** An arrow key of the bar axis that the open menu did not use moves to the next menu. */
  onMenuKey(event: KeyboardEvent, menu: MenuContext): boolean;
}

export const menubarKey: InjectionKey<MenubarForMenu> = Symbol('menubar');

const bars = new WeakMap<Element, MenubarForMenu>();

/** Gives the trigger to the bar, so that a root that a handle connects to it is a menu of the bar. */
export function addBarTrigger(element: Element, bar: MenubarForMenu) {
  bars.set(element, bar);
  return () => bars.delete(element);
}

/** The menubar of a trigger. */
export function menubarOfTrigger(element: Element | null) {
  return element ? bars.get(element) : undefined;
}
