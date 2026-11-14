import { inject } from 'vue';
import type { InjectionKey } from 'vue';
import type { ToastStore } from '../store';

export type ToastContext = ToastStore;

export const ToastContext: InjectionKey<ToastContext> = Symbol();

export function useToastProviderContext(): ToastContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(ToastContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: No <Toast.Provider> is above this component. `useToastManager` and each part of Toast read the toasts of the provider. Put the component inside <Toast.Provider>.',
    );
  }
  return context;
}
