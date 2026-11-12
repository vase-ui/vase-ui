import type { InjectionKey } from 'vue';

export interface CompositeRootContext {
  highlightedIndex: number;
  onHighlightedIndexChange: (index: number, shouldScrollIntoView?: boolean) => void;
  highlightItemOnHover: boolean;
  /**
   * Lets a composite component get events that do not come from its children.
   * For example, a Menubar with detached triggers can define its Menu.Root outside of CompositeRoot.
   * CompositeRoot does not get the keyboard events inside that menu, so the menu must relay them
   * with this function.
   */
  relayKeyboardEvent: (event: KeyboardEvent) => void;
}

export const CompositeRootContext: InjectionKey<CompositeRootContext> = Symbol();
