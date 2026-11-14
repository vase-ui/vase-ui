import { inject } from 'vue';
import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue';

export interface MenubarContext {
  modal: ComputedRef<boolean>;
  disabled: ComputedRef<boolean>;
  contentElement: ShallowRef<HTMLElement | null>;
  hasSubmenuOpen: Readonly<Ref<boolean>>;
  setHasSubmenuOpen: (open: boolean) => void;
  orientation: ComputedRef<'horizontal' | 'vertical'>;
  allowMouseUpTriggerRef: Ref<boolean>;
  rootId: ComputedRef<string | undefined>;
}

export const MenubarContext: InjectionKey<MenubarContext> = Symbol();

export function useMenubarContext(optional?: false): MenubarContext;
export function useMenubarContext(optional: true): MenubarContext | undefined;
export function useMenubarContext(optional?: boolean) {
  // The default `undefined` stops the Vue warning for a missing provider. The error below says more.
  const context = inject(MenubarContext, undefined);
  if (context === undefined && !optional) {
    throw new Error(
      'Vase UI: A part of Menubar must be inside <Menubar>. Without a menubar the part has no menubar state. Put the part inside <Menubar>.',
    );
  }

  return context;
}
