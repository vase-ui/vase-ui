import MenubarComponent from './Menubar.vue';
import type { MenubarProps, MenubarState } from './Menubar.vue';

/**
 * The container for menus.
 */
export const Menubar: typeof MenubarComponent = MenubarComponent;
export namespace Menubar {
  export type State = MenubarState;
  export type Props = MenubarProps;
}

export type * from './Menubar.vue';

export * as MenubarDataAttributes from './MenubarDataAttributes';
