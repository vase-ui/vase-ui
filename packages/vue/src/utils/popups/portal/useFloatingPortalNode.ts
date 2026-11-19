import { inject, shallowRef, toValue, useId, watch } from 'vue';
import type { ComponentPublicInstance, MaybeRefOrGetter, Ref } from 'vue';
import { useIsHydrated } from '../../../common/hydration';
import { ownerDocument } from '../../../common/owner';
import { resolveElement } from '../../../internals/resolveElement';
import { useKeepAliveState } from '../../../internals/useKeepAliveState';
import { useRenderElement } from '../../../internals/useRenderElement';
import type {
  UseRenderElementComponentProps,
  UseRenderElementReturnValue,
} from '../../../internals/useRenderElement';
import { createAttribute } from '../createAttribute';
import { DismissPortalRegistration, usePortalRegistration } from './portalElements';
import { usePortalContext } from './FloatingPortalContext';

const attr = createAttribute('portal');

export type FloatingPortalContainer =
  HTMLElement | ShadowRoot | ComponentPublicInstance | null | undefined;

export interface UseFloatingPortalNodeProps {
  /**
   * The container of the portal element, as the `container` prop of the part gives it. The prop
   * can be an element, a shadow root, a component, or a ref or a getter for one of them.
   * - `null`: no portal element renders until the container is not `null`.
   *   A `Teleport` with a `null` target fails.
   * - `undefined`, or a ref or a getter that gives `undefined` or `null`: the portal element of
   *   the portal above, or else `<body>`.
   */
  container: MaybeRefOrGetter<MaybeRefOrGetter<FloatingPortalContainer>>;
  /**
   * The props of the part. The composable reads `as`.
   */
  componentProps: UseRenderElementComponentProps<any>;
  /**
   * Set it to `true` for a part whose `#render` slot has the `children` prop.
   * `useRenderElement` then warns when the slot does not mount `children`.
   */
  children?: boolean | undefined;
  /**
   * Whether the part renders the portal element in its own place, with no `Teleport`. The
   * composable then does not read `container`.
   */
  inPlace?: MaybeRefOrGetter<boolean | undefined> | undefined;
}

export interface UseFloatingPortalNodeResult extends UseRenderElementReturnValue {
  /**
   * The element that the `Teleport` of the part renders into, or `null` while the part renders
   * no `Teleport`. It is `null` on a server, before the mount, and while `inPlace` is true.
   */
  containerElement: Readonly<Ref<HTMLElement | ShadowRoot | null>>;
  /**
   * Whether `KeepAlive` holds the part. The part gives it to `disabled` of its `Teleport`.
   */
  isHeld: Readonly<Ref<boolean>>;
}

function isShadowRoot(value: object): value is ShadowRoot {
  return (value as Node).nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}

function resolveContainer(
  container: UseFloatingPortalNodeProps['container'],
  parentPortalNode: Readonly<Ref<HTMLElement | null>> | undefined,
): HTMLElement | ShadowRoot | null {
  const prop = toValue(container);
  // A null prop delays the portal. A ref or getter that gives null uses the fallback container.
  if (prop === null) {
    return null;
  }
  const value = toValue<FloatingPortalContainer>(prop);
  const element = value != null && isShadowRoot(value) ? value : resolveElement(value);
  return (element ?? parentPortalNode?.value ?? ownerDocument(null).body) as
    HTMLElement | ShadowRoot;
}

/**
 * Makes the portal element of a portal and finds its container. The part renders one `Teleport`
 * to `containerElement`, unless `inPlace` is true. In place, the portal element is the root node.
 *
 * With the `#render` slot, the child of the `Teleport` is the fragment of the slot. Vue then warns
 * that it cannot animate the part with the `<Transition>` of a consumer. When the slot renders one
 * root node, Vue 3.5.44 and later still give the `<Transition>` to that node, with the same
 * warning. In Vue 3.6, they do this from 3.6.0-rc.12.
 */
export function useFloatingPortalNode(
  params: UseFloatingPortalNodeProps,
): UseFloatingPortalNodeResult {
  const uniqueId = useId();
  const parentPortalNode = usePortalContext()?.portalNode;

  const mounted = useIsHydrated();
  const containerElement = shallowRef<HTMLElement | ShadowRoot | null>(null);
  // A container getter can read the DOM. Wait for mount before calling it.
  // A parent or sibling can set the container ref during the patch, so resolve it after the patch.
  watch(
    () =>
      mounted.value && !toValue(params.inPlace)
        ? resolveContainer(params.container, parentPortalNode)
        : null,
    (container) => {
      containerElement.value = container;
    },
    { flush: 'post' },
  );

  // A `Teleport` leaves its content in the target when `KeepAlive` deactivates the part. A
  // disabled `Teleport` keeps the content in its own place, and `KeepAlive` takes that place out
  // of the document.
  const { isHeld } = useKeepAliveState();

  const { element, elementProps, setRef, usesRenderSlot } = useRenderElement(
    'div',
    params.componentProps,
    {
      props: (attrs) => [{ id: uniqueId, [attr]: '' }, attrs],
      children: params.children,
    },
  );

  usePortalRegistration(element, isHeld, containerElement, inject(DismissPortalRegistration, undefined));

  return { element, elementProps, setRef, usesRenderSlot, containerElement, isHeld };
}
