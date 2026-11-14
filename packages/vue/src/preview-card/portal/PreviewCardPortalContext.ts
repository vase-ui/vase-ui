import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

export const PreviewCardPortalContext: InjectionKey<ComputedRef<boolean>> = Symbol();

export function usePreviewCardPortalContext(): ComputedRef<boolean> {
  const value = inject(PreviewCardPortalContext, undefined);
  if (value === undefined) {
    throw new Error(
      'Vase UI: <PreviewCard.Positioner> must be inside <PreviewCard.Portal>. Without a portal the positioner does not know if the popup stays mounted while it is closed. Put the positioner inside <PreviewCard.Portal>.',
    );
  }
  return value;
}
