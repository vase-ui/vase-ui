import { inject } from 'vue';
import type { InjectionKey, Ref } from 'vue';

export interface PortalContextValue {
  /**
   * The portal element of the nearest portal that provides this context.
   * A portal with no `container` renders inside it.
   */
  portalNode: Readonly<Ref<HTMLElement | null>>;
}

export const PortalContext: InjectionKey<PortalContextValue> = Symbol();

export function usePortalContext(): PortalContextValue | undefined {
  // A part with no portal above is valid, so this function does not throw. The default
  // `undefined` stops the Vue warning for a missing provider.
  return inject(PortalContext, undefined);
}
