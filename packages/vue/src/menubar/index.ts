import MenubarComponent from './Menubar.vue';
import type { MenubarProps, MenubarState } from './types';

/**
 * The container for menus.
 * Renders a `<div>` element.
 * @selector `[aria-orientation]` The axis of the menubar: `horizontal` or `vertical`.
 * @selector `:has([aria-expanded="true"])` A menu of the menubar is open.
 */
export const Menubar: typeof MenubarComponent = MenubarComponent;
export namespace Menubar {
  export type Props = MenubarProps;
  export type State = MenubarState;
}

export type { MenubarProps, MenubarState };
