import { inject } from 'vue';
import type { ComputedRef, CSSProperties, InjectionKey, ShallowRef } from 'vue';
import type { Side, UseAnchorPositioningReturnValue } from '../../internals/useAnchorPositioning';

export interface SelectItemAlignment {
  popup: HTMLElement;
  positionerStyle: CSSProperties;
  transformOrigin?: string | undefined;
}

export interface SelectPositionerContext extends Pick<
  UseAnchorPositioningReturnValue,
  'align' | 'createArrowRef' | 'arrowUncentered' | 'arrowStyles' | 'isPositioned'
> {
  /**
   * The side of the popup. It is `'none'` while the popup is placed over the trigger.
   */
  side: ComputedRef<Side | 'none'>;
  itemAlignment: ShallowRef<SelectItemAlignment | null>;
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
