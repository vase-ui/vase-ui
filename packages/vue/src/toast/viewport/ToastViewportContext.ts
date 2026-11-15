import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { StoredToast } from '../store';

export interface ToastViewportContext {
  /**
   * Whether the viewport renders the focus guards in its element. They render while there is a
   * toast and a place to return the focus to.
   */
  hasFocusGuards: ComputedRef<boolean>;
  /**
   * Moves the focus from a guard into the first toast that can have it, or back to the place that
   * the focus came from.
   */
  handleFocusGuard: (event: FocusEvent) => void;
  /**
   * The element after the viewport that holds the alerts of the high priority toasts. It is `null`
   * while there is no alert to show, and before the mount.
   */
  alertRegion: ComputedRef<HTMLElement | null>;
  /**
   * The toasts that the alert region announces.
   */
  highPriorityToasts: ComputedRef<StoredToast[]>;
}

export const ToastViewportContext: InjectionKey<ToastViewportContext> = Symbol();

export function useToastViewportContext(): ToastViewportContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(ToastViewportContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: The `children` component of <Toast.Viewport> must be inside <Toast.Viewport>. Without the part it has no focus guards and no alerts to render. Mount the `children` component in the element of the `#render` slot of <Toast.Viewport>.',
    );
  }

  return context;
}
