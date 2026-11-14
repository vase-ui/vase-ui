import { inject } from 'vue';
import type { InjectionKey } from 'vue';
import type { UseAnchorPositioningReturnValue } from '../../internals/useAnchorPositioning';

export type PreviewCardPositionerContext = Pick<
  UseAnchorPositioningReturnValue,
  'side' | 'align' | 'arrowRef' | 'arrowUncentered' | 'arrowStyles'
>;

export const PreviewCardPositionerContext: InjectionKey<PreviewCardPositionerContext> = Symbol();

export function usePreviewCardPositionerContext(): PreviewCardPositionerContext {
  const context = inject(PreviewCardPositionerContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A popup or an arrow of PreviewCard must be inside <PreviewCard.Positioner>. Without a positioner the part has no side and no alignment. Put the part inside <PreviewCard.Positioner>.',
    );
  }
  return context;
}
