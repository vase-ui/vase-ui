import MenubarComponent from './Menubar.vue';
import type { MenubarProps, MenubarState } from './types';

/**
 * A bar of menu triggers, with one tab stop.
 * Renders a `<div>` element.
 */
export const Menubar: typeof MenubarComponent = MenubarComponent;
export namespace Menubar {
  export type Props = MenubarProps;
  export type State = MenubarState;
}

export type { MenubarProps, MenubarState };
