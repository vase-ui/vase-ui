import { inject } from 'vue';
import type { InjectionKey } from 'vue';
import type { RegisterId } from '../../internals/labelable-provider/LabelableContext';

/**
 * Registers the id of a `Menu.GroupLabel` with the group above it.
 */
export type MenuGroupContext = RegisterId;

export const MenuGroupContext: InjectionKey<MenuGroupContext> = Symbol();

export function useMenuGroupRootContext() {
  // The default `undefined` stops the Vue warning for a missing provider. The error below says more.
  const context = inject(MenuGroupContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <Menu.GroupLabel> must be inside <Menu.Group> or <Menu.RadioGroup>. Without a group the label has no group to name. Put the label inside <Menu.Group> or <Menu.RadioGroup>.',
    );
  }

  return context;
}
