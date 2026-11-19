import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { RegisterId } from '../../internals/labelable-provider/createIdRegistry';
import type { ToastObject } from '../useToastManager';

export interface ToastRootContext {
  toast: ComputedRef<ToastObject<any>>;
  /**
   * Registers the `id` of a title by its source. The root takes the `id` of the last title for
   * `aria-labelledby`.
   */
  registerTitleId: RegisterId;
  /**
   * Registers the `id` of a description by its source. The root takes the `id` of the last
   * description for `aria-describedby`. A root with no title takes it for `aria-labelledby`
   * instead, unless the consumer gives the root a non-blank `aria-label` or `aria-labelledby`.
   */
  registerDescriptionId: RegisterId;
  visibleIndex: ComputedRef<number>;
  expanded: ComputedRef<boolean>;
  recalculateHeight: () => void;
}

export const ToastRootContext: InjectionKey<ToastRootContext> = Symbol();

export function useToastRootContext(): ToastRootContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(ToastRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of a toast must be inside <Toast.Root>. Without a root the part has no toast to show. Put the part inside <Toast.Root>.',
    );
  }

  return context;
}
