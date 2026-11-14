import { inject } from 'vue';
import type { InjectionKey } from 'vue';
import type { UseAnchorPositioningReturnValue } from '../../internals/useAnchorPositioning';

export type ToastPositionerContext = Pick<
  UseAnchorPositioningReturnValue,
  'side' | 'align' | 'arrowRef' | 'arrowUncentered' | 'arrowStyles'
>;

export const ToastPositionerContext: InjectionKey<ToastPositionerContext> = Symbol();

export function useToastPositionerContext(): ToastPositionerContext {
  const context = inject(ToastPositionerContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <Toast.Arrow> must be inside <Toast.Positioner>. Without a positioner the arrow has no side and no alignment. Put the arrow inside <Toast.Positioner>.',
    );
  }
  return context;
}
