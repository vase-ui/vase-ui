import { inject } from 'vue';
import type { InjectionKey } from 'vue';
import type { DialogStore } from '../store/DialogStore';

export const DialogRootContext: InjectionKey<DialogStore<unknown>> = Symbol();

export function useDialogRootContext(optional?: false): DialogStore<unknown>;
export function useDialogRootContext(optional: true): DialogStore<unknown> | undefined;
export function useDialogRootContext(optional?: boolean) {
  const store = inject(DialogRootContext, undefined);

  if (!optional && store === undefined) {
    throw new Error(
      'Vase UI: DialogRootContext is missing. Without it a Dialog part has no dialog to read. Put the Dialog parts inside <Dialog.Root>.',
    );
  }

  return store;
}
