import { shallowReactive, watch } from 'vue';
import type { InjectionKey, Ref } from 'vue';
import { closest } from '../../../common/shadowDom';

export const PortalNode: InjectionKey<Readonly<Ref<HTMLElement | null>>> = Symbol();
export const DismissPortalRegistration: InjectionKey<(portal: Element) => () => void> = Symbol();

const portals = shallowReactive(new Map<Element, symbol>());

export function usePortalRegistration(
  element: Readonly<Ref<HTMLElement | null>>,
  isHeld: Readonly<Ref<boolean>>,
  container?: Readonly<Ref<Element | ShadowRoot | null>>,
  registerDismiss?: (portal: Element) => () => void,
) {
  const owner = Symbol();
  watch(
    [element, isHeld, () => container?.value],
    ([node, held], _previous, onCleanup) => {
      if (!node || held) {
        return;
      }
      portals.set(node, owner);
      const releaseDismiss = registerDismiss?.(node);
      onCleanup(() => {
        releaseDismiss?.();
        if (portals.get(node) === owner) {
          portals.delete(node);
        }
      });
    },
    { flush: 'post' },
  );
}

function isPortal(element: Element) {
  return portals.has(element);
}

// Teleport can move the same element, including its nested portals, to another container or document.
export function getPortalLocation(element: Element | null | undefined) {
  const targets: ParentNode[] = [];
  for (
    let portal = closest(element, isPortal);
    portal?.parentNode;
    portal = closest(portal.parentNode, isPortal)
  ) {
    targets.push(portal.parentNode);
  }
  return { document: element?.ownerDocument, targets };
}

export function getNestedPortals(parent: Element | null | undefined) {
  if (!parent) {
    return [];
  }
  return Array.from(portals.keys()).filter(
    (portal) =>
      portal !== parent &&
      portal.isConnected &&
      closest(portal, (element) => element === parent) !== null,
  );
}

export function isPortalOfPart(portal: Element, part: Element | null | undefined) {
  if (!part?.isConnected) {
    return false;
  }
  // A raw positioner or a foreign container can also be the boundary.
  return closest(part, (element) => element === portal || portals.has(element)) === portal;
}
