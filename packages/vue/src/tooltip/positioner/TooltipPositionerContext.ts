import { inject } from 'vue';
import type { InjectionKey } from 'vue';
import type { UseAnchorPositioningReturnValue } from '../../internals/useAnchorPositioning';

export type TooltipPositionerContext = Pick<
  UseAnchorPositioningReturnValue,
  'side' | 'align' | 'arrowRef' | 'arrowUncentered' | 'arrowStyles'
>;

export const TooltipPositionerContext: InjectionKey<TooltipPositionerContext> = Symbol();

export function useTooltipPositionerContext(): TooltipPositionerContext {
  const context = inject(TooltipPositionerContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A popup or an arrow of Tooltip must be inside <Tooltip.Positioner>. Without a positioner the part has no side and no alignment. Put the part inside <Tooltip.Positioner>.',
    );
  }
  return context;
}
