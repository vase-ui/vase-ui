import type { HTMLAttributes } from 'vue';
import type { AsProps } from '../common/element';

export interface MenubarProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /** The `id` of the element. */
  id?: string | undefined;
  /**
   * The axis of the bar: its arrow keys move between the triggers.
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical' | undefined;
  /**
   * An arrow key at the last trigger goes to the first trigger, and the other way.
   * @default true
   */
  loopFocus?: boolean | undefined;
  /**
   * The page does not scroll and gets no pointer while a menu of the bar is open.
   * @default true
   */
  modal?: boolean | undefined;
  /**
   * The user cannot open the menus of the bar.
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface MenubarState {
  orientation: 'horizontal' | 'vertical';
  modal: boolean;
  /** A menu of the bar is open. */
  hasSubmenuOpen: boolean;
}
