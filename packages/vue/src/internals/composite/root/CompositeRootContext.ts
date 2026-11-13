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
   * Tells an item if it holds the tab stop until the item is mounted. An item calls it one time,
   * in `setup`. Base UI does not have this function. Its server HTML has `tabindex="-1"` on each
   * item. The root gives `true` to at most one caller.
   */
  takeInitialTabStop: (index: number, active: boolean, disabled: boolean) => boolean;
  /**
   * The id of the root. An item gives it in an attribute while it hydrates, so the root can find
   * its own items in the DOM. Base UI does not have this field. Its server HTML has no tab stop,
   * so its root does not look for an item that is not mounted.
   */
  id: string;
  /**
   * Whether the server HTML has the tab stop on an item of this root that is not mounted. While it
   * is `true`, the mounted items do not take the tab stop. Base UI does not have this field, for
   * the reason of `id`.
   */
  hasUnmountedTabStop: ComputedRef<boolean>;
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
