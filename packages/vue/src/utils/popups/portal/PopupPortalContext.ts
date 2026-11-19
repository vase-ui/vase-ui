import { inject } from 'vue';
import type { InjectionKey, Ref, ShallowRef } from 'vue';
import type { VaseUIChangeEventDetails } from '../../../internals/createVaseUIEventDetails';

/**
 * What the focus manager of a popup tells the portal around it. The portal uses this state for its
 * focus guards.
 */
export interface FocusManagerState {
  modal: boolean;
  open: boolean;
  onOpenChange(open: boolean, eventDetails: VaseUIChangeEventDetails<string>): void;
  domReference: Element | null;
  closeOnFocusOut: boolean;
  /**
   * Whether the focus manager has an element that gets the focus when the Tab key leaves the popup
   * forward. A popup part gives the guard after its trigger. The popup then has one place in the
   * tab order, and the portal keeps no guards of its own.
   */
  hasNextFocusableElement: boolean;
}

export interface PortalContextValue {
  /**
   * The portal element of the nearest portal that provides this context.
   * A portal with no `to` renders inside it.
   */
  portalNode: Readonly<Ref<HTMLElement | null>>;
  /**
   * Whether the portal element is in the place of the part, with no `Teleport`. The popup is then
   * at its place in the tab order, and the portal keeps no guards and no owner element.
   */
  inPlace: Readonly<Ref<boolean>>;
  /**
   * The focus manager gives its state to the portal, and it gives `null` when it goes away. It
   * gives a new object when a value changes, because the portal does not see a change in an object.
   */
  setFocusManagerState(state: FocusManagerState | null): void;
  /**
   * The guards that the focus manager keeps beside the popup element. The focus manager writes
   * them.
   */
  beforeInsideRef: ShallowRef<HTMLSpanElement | null>;
  afterInsideRef: ShallowRef<HTMLSpanElement | null>;
  /**
   * The guards that the portal keeps around its place in the document. They are `null` while the
   * portal keeps no guards.
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
