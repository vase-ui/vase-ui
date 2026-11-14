import { inject } from 'vue';
import type { InjectionKey } from 'vue';
import type { UseAnchorPositioningReturnValue } from '../../internals/useAnchorPositioning';

export type SelectPositionerContext = Pick<
  UseAnchorPositioningReturnValue,
  'side' | 'align' | 'arrowRef' | 'arrowUncentered' | 'arrowStyles'
>;

export const SelectPositionerContext: InjectionKey<SelectPositionerContext> = Symbol();

export function useSelectPositionerContext(): SelectPositionerContext {
  const context = inject(SelectPositionerContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A popup or an arrow of Select must be inside <Select.Positioner>. Without a positioner the part has no side and no alignment. Put the part inside <Select.Positioner>.',
    );
  }
  return context;
}
