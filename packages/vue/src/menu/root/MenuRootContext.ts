import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { MenuStore } from '../store/MenuStore';
import type { MenuParent, MenuRootOrientation } from './MenuRoot.vue';

export interface MenuRootContext<Payload = unknown> {
  store: MenuStore<Payload>;
  parent: MenuParent;
  orientation: ComputedRef<MenuRootOrientation>;
  loopFocus: ComputedRef<boolean>;
  /** Whether arrow keys can step from either end of the list back to a virtual focus owner. */
  allowEscape: ComputedRef<boolean>;
  /**
   * The `id` of the active trigger element, which names the part that has the `menu` role. It
   * follows each change of the attribute. While no trigger element exists, it is the registered id
   * of the active trigger.
   */
  popupLabelId: ComputedRef<string | null | undefined>;
  virtualFocus: boolean;
  parentVirtualFocus: boolean;
  /** Reports `itemHighlighted` again after the item registry settles. */
  syncHighlightedItem: () => void;
}

// `ContextMenu.Root` provides `undefined`, so a menu in a context menu does not see a menu around
// the context menu.
export const MenuRootContext: InjectionKey<MenuRootContext<any> | undefined> = Symbol();

export function useMenuRootContext(optional?: false): MenuRootContext;
export function useMenuRootContext(optional: true): MenuRootContext | undefined;
export function useMenuRootContext(optional?: boolean) {
  // The default `undefined` stops the Vue warning for a missing provider. The error below says more.
  const context = inject(MenuRootContext, undefined);
  if (context === undefined && !optional) {
    throw new Error(
      'Vase UI: A part of Menu must be inside <Menu.Root>. Without a root the part has no menu state. Put the part inside <Menu.Root>.',
    );
  }

  return context;
}
