import { inject } from 'vue';
import type { InjectionKey } from 'vue';
import type { RegisterId } from '../../internals/labelable-provider/LabelableContext';

/**
 * Registers the `id` of a label by its source. Two labels can have the same `id`, and Vue can
 * mount a label before it unmounts the label that it replaces.
 */
export type MenuGroupContext = RegisterId;

export const MenuGroupContext: InjectionKey<MenuGroupContext> = Symbol();

export function useMenuGroupRootContext(): MenuGroupContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(MenuGroupContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <Menu.GroupLabel> must be inside <Menu.Group>. Without a group the label has no group to name. Put the label inside <Menu.Group>.',
    );
  }

  return context;
}
