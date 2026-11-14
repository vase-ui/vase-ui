import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { Side, UseAnchorPositioningReturnValue } from '../../internals/useAnchorPositioning';

export interface SelectPositionerContext extends Pick<
  UseAnchorPositioningReturnValue,
  'align' | 'arrowRef' | 'arrowUncentered' | 'arrowStyles' | 'isPositioned'
> {
  /**
   * The side of the popup. It is `'none'` while the popup is placed over the trigger.
   */
  side: ComputedRef<Side | 'none'>;
  alignItemWithTriggerActive: ComputedRef<boolean>;
  setControlledAlignItemWithTrigger: (alignItemWithTrigger: boolean) => void;
}

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
