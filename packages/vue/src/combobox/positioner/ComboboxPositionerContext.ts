import { inject } from 'vue';
import type { InjectionKey } from 'vue';
import type { UseAnchorPositioningReturnValue } from '../../internals/useAnchorPositioning';

export type ComboboxPositionerContext = Pick<
  UseAnchorPositioningReturnValue,
  | 'side'
  | 'align'
  | 'arrowRef'
  | 'arrowUncentered'
  | 'arrowStyles'
  | 'anchorHidden'
  | 'isPositioned'
>;

export const ComboboxPositionerContext: InjectionKey<ComboboxPositionerContext> = Symbol();

export function useComboboxPositionerContext(optional?: false): ComboboxPositionerContext;
export function useComboboxPositionerContext(optional: true): ComboboxPositionerContext | undefined;
export function useComboboxPositionerContext(optional?: boolean) {
  const context = inject(ComboboxPositionerContext, undefined);
  if (context === undefined && !optional) {
    throw new Error(
      'Vase UI: <Combobox.Popup> and <Combobox.Arrow> must be inside <Combobox.Positioner>. Without a positioner they have no side and no alignment. Put them inside <Combobox.Positioner>.',
    );
  }
  return context;
}
