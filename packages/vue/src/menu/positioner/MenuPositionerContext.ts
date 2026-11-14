import { inject } from 'vue';
import type { InjectionKey } from 'vue';
import type { UseAnchorPositioningReturnValue } from '../../internals/useAnchorPositioning';

export type MenuPositionerContext = Pick<
  UseAnchorPositioningReturnValue,
  'side' | 'align' | 'arrowRef' | 'arrowUncentered' | 'arrowStyles'
>;

export const MenuPositionerContext: InjectionKey<MenuPositionerContext> = Symbol();

export function useMenuPositionerContext(): MenuPositionerContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(MenuPositionerContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <Menu.Popup> and <Menu.Arrow> must be inside <Menu.Positioner>. Without a positioner the part has no side and no alignment. Put the part inside <Menu.Positioner>.',
    );
  }

  return context;
}
