import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

/**
 * Whether `Dialog.Portal` keeps its parts mounted while the dialog is closed.
 */
export const DialogPortalContext: InjectionKey<ComputedRef<boolean>> = Symbol();

export function useDialogPortalContext(): ComputedRef<boolean> {
  const keepMounted = inject(DialogPortalContext, undefined);

  if (keepMounted === undefined) {
    throw new Error(
      'Vase UI: <Dialog.Portal> is missing. Without it the part cannot know if it stays mounted while the dialog is closed. Put the part inside <Dialog.Portal>.',
    );
  }

  return keepMounted;
}
