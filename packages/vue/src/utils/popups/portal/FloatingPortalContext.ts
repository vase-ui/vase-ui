import { inject } from 'vue';
import type { InjectionKey, Ref, ShallowRef } from 'vue';
import type { VaseUIChangeEventDetails } from '../../../internals/createBaseUIEventDetails';

/**
 * What the focus manager of a popup tells the portal around it. The portal renders its focus
 * guards from this state.
 */
export interface FocusManagerState {
  modal: boolean;
  open: boolean;
  onOpenChange(open: boolean, eventDetails: VaseUIChangeEventDetails<string>): void;
  domReference: Element | null;
  closeOnFocusOut: boolean;
}

export interface PortalContextValue {
  /**
   * The portal element of the nearest portal that provides this context.
   * A portal with no `container` renders inside it.
   */
  portalNode: Readonly<Ref<HTMLElement | null>>;
  /**
   * The focus manager gives its state to the portal, and it gives `null` when it goes away. It
   * gives a new object when a value changes, because the portal does not see a change in an object.
   */
  setFocusManagerState(state: FocusManagerState | null): void;
  /**
   * The guards that the focus manager renders at the edges of the popup. The focus manager writes
   * them.
   */
  beforeInsideRef: ShallowRef<HTMLSpanElement | null>;
  afterInsideRef: ShallowRef<HTMLSpanElement | null>;
  /**
   * The guards that the portal renders around its place in the document. They are `null` while the
   * portal renders no guards.
   */
  beforeOutsideRef: Readonly<Ref<HTMLSpanElement | null>>;
  afterOutsideRef: Readonly<Ref<HTMLSpanElement | null>>;
}

export const PortalContext: InjectionKey<PortalContextValue> = Symbol();

export function usePortalContext(): PortalContextValue | undefined {
  // A part with no portal above is valid, so this function does not throw. The default
  // `undefined` stops the Vue warning for a missing provider.
  return inject(PortalContext, undefined);
}
