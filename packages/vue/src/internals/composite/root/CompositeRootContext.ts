import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

export interface CompositeRootContext {
  highlightedIndex: ComputedRef<number>;
  onHighlightedIndexChange: (index: number, shouldScrollIntoView?: boolean) => void;
  highlightItemOnHover: ComputedRef<boolean>;
  /**
   * Lets a composite component get events that do not come from its children.
   * For example, a Menubar with detached triggers can define its Menu.Root outside of CompositeRoot.
   * CompositeRoot does not get the keyboard events inside that menu, so the menu must relay them
   * with this function.
   */
  relayKeyboardEvent: (event: KeyboardEvent) => void;
  /**
   * Whether the root has made its first map of the items. Base UI does not have this field,
   * because its items always read the highlighted index. A Vue item keeps the tab stop of
   * `takeInitialTabStop` until this field is `true`. The first client render is then equal to the
   * server HTML.
   */
  hasSetDefaultIndex: ComputedRef<boolean>;
  /**
   * Tells an item if it holds the tab stop before the first map of the root. An item calls it one
   * time, in `setup`. Base UI does not have this function. Its server HTML has `tabindex="-1"` on
   * each item. The root gives `true` to at most one caller.
   */
  takeInitialTabStop: (index: number, active: boolean, disabled: boolean) => boolean;
}

export const CompositeRootContext: InjectionKey<CompositeRootContext> = Symbol();

export function useCompositeRootContext(optional: true): CompositeRootContext | undefined;
export function useCompositeRootContext(optional?: false): CompositeRootContext;
export function useCompositeRootContext(optional = false) {
  // With one argument, Vue shows a warning when there is no provider. The default `undefined`
  // stops that warning, and the error below says more.
  const context = inject(CompositeRootContext, undefined);
  if (context === undefined && !optional) {
    throw new Error(
      'Vase UI: A composite item must be inside a composite root. Without a root the item has no highlighted index and no tab stop. Put the item part inside its root part.',
    );
  }

  return context;
}
