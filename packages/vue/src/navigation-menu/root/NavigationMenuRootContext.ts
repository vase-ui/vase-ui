import { inject } from 'vue';
import { contains } from '../../common/shadowDom';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { DismissLayer } from '../../utils/popups/interactions/useDismissLayer';
import { useFloatingTree } from '../../utils/popups/tree/FloatingTree';
import { getNodeChildren } from '../../utils/popups/tree/nodes';
import type { Dimensions } from '@floating-ui/utils';
import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { FloatingRootStore } from '../../utils/popups/floating-root/FloatingRootStore';
import type { Orientation } from '../../internals/types';
import type { NavigationMenuRootChangeEventDetails } from './NavigationMenuRoot.vue';

export type NavigationMenuPopupAutoSizeResetState = {
  abortController: AbortController | null;
  owner: symbol | null;
};

export type NavigationMenuActivationDirection = 'left' | 'right' | 'up' | 'down' | null;

export interface NavigationMenuSizes {
  popup: Dimensions | 'auto' | null;
  positioner: Dimensions | null;
  measuring?: boolean;
}

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
  /**
   * The `id` of `popupElement`. The root follows each change of the attribute.
   */
  popupElementId: Readonly<Ref<string | undefined>>;
  /**
   * The positioner element, also while `KeepAlive` holds it. `null` means that the menu has no
   * positioner. The trigger of an open menu then has no click interaction. The root waits for
   * the positioner's animations at a close when the popup gives no element.
   */
  positionerElement: ShallowRef<HTMLElement | null>;
  /**
   * The backdrop element, also while `KeepAlive` holds it. Its animations end an open change of the
   * root while the popup and the positioner give no element.
   */
  backdropElement: ShallowRef<HTMLElement | null>;
  /**
   * The viewport element, also while `KeepAlive` holds it. In a positioner,
   * `NavigationMenu.Content` teleports into it.
   */
  viewportElement: ShallowRef<HTMLElement | null>;
  /**
   * The viewport element, or `null` while `KeepAlive` holds the viewport.
   */
  shownViewportElement: ShallowRef<HTMLElement | null>;
  /**
   * The `id` of `shownViewportElement`. The root follows each change of the attribute.
   */
  viewportElementId: Readonly<Ref<string | undefined>>;
  /**
   * The element between the inside guards of an inline viewport, also while `KeepAlive` holds the
   * viewport. `NavigationMenu.Content` teleports into it.
   */
  viewportTargetElement: ShallowRef<HTMLElement | null>;
  /**
   * The direction of the last switch between two items while the menu is open, or `null`.
   */
  activationDirection: ComputedRef<NavigationMenuActivationDirection>;
  setActivationDirection: (direction: NavigationMenuActivationDirection) => void;
  floatingRootStore: Readonly<Ref<FloatingRootStore | undefined>>;
  setFloatingRootStore: (store: FloatingRootStore | undefined) => void;
  /**
   * Only handlers, hooks and `watch` callbacks read this ref. A template does not read it, so a
   * write wakes no render.
   */
  currentContentRef: ShallowRef<HTMLElement | null>;
  /**
   * The popup reads this ref in its render for its name. A write thus renders the popup again.
   */
  prevTriggerElementRef: ShallowRef<Element | null | undefined>;
  nodeId: string;
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
  sizes: ShallowRef<NavigationMenuSizes>;
  delay: ComputedRef<number>;
  closeDelay: ComputedRef<number>;
  orientation: ComputedRef<Orientation>;
  viewportInert: Readonly<Ref<boolean>>;
  setViewportInert: (inert: boolean) => void;
}

export const NavigationMenuRootContext: InjectionKey<NavigationMenuRootContext> = Symbol();

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

export const OPEN_DELAY = 50;
export const CLOSE_DELAY = 50;
export const NAVIGATION_MENU_TRIGGER_IDENTIFIER = 'data-vase-ui-navigation-menu-trigger';

export const navigationTriggers = new WeakMap<Element, () => boolean>();

export const NavigationMenuDismissContext: InjectionKey<ComputedRef<DismissLayer | undefined>> =
  Symbol();

export const NavigationMenuPortalContext: InjectionKey<ComputedRef<boolean>> = Symbol();

export function useNavigationMenuPortalContext() {
  const keepMounted = inject(NavigationMenuPortalContext, undefined);
  if (keepMounted === undefined) {
    throw new Error(
      'Vase UI: <NavigationMenu.Portal> is missing. The positioner reads from the portal whether the popup stays in the DOM while it is closed. Put <NavigationMenu.Positioner> inside <NavigationMenu.Portal>.',
    );
  }
  return keepMounted;
}

export function useNavigationMenuFocusout() {
  const { positionerElement, popupElement, rootRef, nodeId, setValue } =
    useNavigationMenuRootContext();
  const tree = useFloatingTree();

  return (event: FocusEvent) => {
    const popup = popupElement.value;
    const next = event.relatedTarget as Element | null;
    if (
      !positionerElement.value ||
      !popup ||
      contains(popup, event.currentTarget as Element) ||
      contains(popup, next) ||
      contains(rootRef.value, next) ||
      (tree.value &&
        getNodeChildren(tree.value.nodesRef.value, nodeId).some((node) =>
          contains(node.context?.elements.floating, next),
        ))
    ) {
      return;
    }
    setValue(null, createChangeEventDetails(REASONS.focusOut, event));
  };
}
