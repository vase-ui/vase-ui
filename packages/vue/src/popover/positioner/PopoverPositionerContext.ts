import { inject } from 'vue';
import type { InjectionKey } from 'vue';
import type { UseAnchorPositioningReturnValue } from '../../internals/useAnchorPositioning';

export type PopoverPositionerContext = Pick<
  UseAnchorPositioningReturnValue,
  'side' | 'align' | 'arrowRef' | 'arrowUncentered' | 'arrowStyles'
>;

export const PopoverPositionerContext: InjectionKey<PopoverPositionerContext> = Symbol();

export function usePopoverPositionerContext(): PopoverPositionerContext {
  const context = inject(PopoverPositionerContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A popup or an arrow of Popover must be inside <Popover.Positioner>. Without a positioner the part has no side and no alignment. Put the part inside <Popover.Positioner>.',
    );
  }
  return context;
}
