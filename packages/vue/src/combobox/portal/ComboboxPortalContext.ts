import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

/**
 * Whether `Combobox.Portal` keeps its parts mounted while the popup is closed.
 */
export const ComboboxPortalContext: InjectionKey<ComputedRef<boolean>> = Symbol();

export function useComboboxPortalContext(): ComputedRef<boolean> {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const keepMounted = inject(ComboboxPortalContext, undefined);
  if (keepMounted === undefined) {
    throw new Error(
      'Vase UI: <Combobox.Portal> is missing. Without it the positioner cannot know if it stays mounted while the popup is closed. Put <Combobox.Positioner> inside <Combobox.Portal>.',
    );
  }
  return keepMounted;
}
