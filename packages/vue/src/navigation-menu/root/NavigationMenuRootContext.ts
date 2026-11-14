import { inject } from 'vue';
import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { FloatingRootStore } from '../../utils/popups/floating-root/FloatingRootStore';
import type { Orientation } from '../../internals/types';
import type { NavigationMenuRootChangeEventDetails } from './NavigationMenuRoot.vue';

export type NavigationMenuPopupAutoSizeResetState = {
  abortController: AbortController | null;
  /**
   * The value of the item whose trigger scheduled the reset.
   */
  owner: any;
};

export type NavigationMenuActivationDirection = 'left' | 'right' | 'up' | 'down' | null;

export interface NavigationMenuRootContext<Value = any> {
  open: ComputedRef<boolean>;
  value: ComputedRef<Value | null>;
  setValue: (
    value: Value | null,
    eventDetails: Omit<NavigationMenuRootChangeEventDetails, 'preventUnmountOnClose'>,
  ) => void;
  transitionStatus: Readonly<Ref<TransitionStatus>>;
  mounted: Readonly<Ref<boolean>>;
  popupElement: ShallowRef<HTMLElement | null>;
  positionerElement: ShallowRef<HTMLElement | null>;
  viewportElement: ShallowRef<HTMLElement | null>;
  viewportTargetElement: ShallowRef<HTMLElement | null>;
  /**
   * The direction of the last switch between two items while the menu is open, or `null`.
   */
  activationDirection: ComputedRef<NavigationMenuActivationDirection>;
  setActivationDirection: (direction: NavigationMenuActivationDirection) => void;
  floatingRootStore: Readonly<Ref<FloatingRootStore | undefined>>;
  setFloatingRootStore: (store: FloatingRootStore | undefined) => void;
  /**
   * Only handlers, hooks and `watch` callbacks read the next two refs. A template does not read
   * them, so a write wakes no render.
   */
  currentContentRef: ShallowRef<HTMLElement | null>;
  prevTriggerElementRef: ShallowRef<Element | null | undefined>;
  nested: boolean;
  rootRef: ShallowRef<HTMLElement | null>;
  beforeInsideRef: ShallowRef<HTMLElement | null>;
  afterInsideRef: ShallowRef<HTMLElement | null>;
  beforeOutsideRef: ShallowRef<HTMLElement | null>;
  afterOutsideRef: ShallowRef<HTMLElement | null>;
  /**
   * Shared across triggers, so that a newly active trigger can cancel a stale popup auto-size
   * reset that the previously active trigger scheduled. Code changes it in place.
   */
  popupAutoSizeResetRef: NavigationMenuPopupAutoSizeResetState;
  delay: ComputedRef<number>;
  closeDelay: ComputedRef<number>;
  orientation: ComputedRef<Orientation>;
  viewportInert: Readonly<Ref<boolean>>;
  setViewportInert: (inert: boolean) => void;
}

export const NavigationMenuRootContext: InjectionKey<NavigationMenuRootContext> = Symbol();

export const NavigationMenuTreeContext: InjectionKey<string> = Symbol();

export function useNavigationMenuRootContext(optional: true): NavigationMenuRootContext | undefined;
export function useNavigationMenuRootContext(optional?: false): NavigationMenuRootContext;
export function useNavigationMenuRootContext(optional = false) {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(NavigationMenuRootContext, undefined);
  if (context === undefined && !optional) {
    throw new Error(
      'Vase UI: <NavigationMenu.Root> is missing. A Navigation Menu part reads the open item from its root. Put the part inside <NavigationMenu.Root>.',
    );
  }
  return context;
}

/**
 * Gives the id of the node that the root registered in the popup tree, or `undefined` outside a
 * root.
 */
export function useNavigationMenuTreeContext() {
  return inject(NavigationMenuTreeContext, undefined);
}
