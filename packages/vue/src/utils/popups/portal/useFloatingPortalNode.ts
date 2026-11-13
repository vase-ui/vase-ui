import { onActivated, onDeactivated, shallowRef, toValue, useId, watch } from 'vue';
import type { ComponentPublicInstance, MaybeRefOrGetter, Ref } from 'vue';
import { useIsHydrated } from '../../../common/hydration';
import { ownerDocument } from '../../../common/owner';
import { resolveElement } from '../../../internals/resolveElement';
import { useRenderElement } from '../../../internals/useRenderElement';
import type {
  UseRenderElementComponentProps,
  UseRenderElementReturnValue,
} from '../../../internals/useRenderElement';
import { createAttribute } from '../createAttribute';
import { usePortalContext } from './FloatingPortalContext';

const attr = createAttribute('portal');

export type FloatingPortalContainer =
  HTMLElement | ShadowRoot | ComponentPublicInstance | null | undefined;

export interface UseFloatingPortalNodeParameters {
  /**
   * The container of the portal element, as the `container` prop of the part gives it. The prop
   * can be an element, a shadow root, a component, or a ref or a getter for one of them.
   * - `null`: no portal element renders until the container is not `null`.
   * - `undefined`, or a ref or a getter that gives `undefined` or `null`: the portal element of
   *   the portal above, or else `<body>`.
   */
  container: MaybeRefOrGetter<MaybeRefOrGetter<FloatingPortalContainer>>;
  /**
   * The props of the part. The composable reads `as`, `stateClass` and `stateStyle`.
   */
  componentProps: UseRenderElementComponentProps<any>;
}

export interface UseFloatingPortalNodeReturnValue extends UseRenderElementReturnValue {
  /**
   * The element that the `Teleport` of the part renders into, or `null` while the part renders
   * no `Teleport`. It is `null` on a server and until the part is mounted.
   */
  containerElement: Readonly<Ref<HTMLElement | ShadowRoot | null>>;
  /**
   * Whether `KeepAlive` holds the part. The part gives it to `disabled` of its `Teleport`.
   */
  deactivated: Readonly<Ref<boolean>>;
}

function isShadowRoot(value: object): value is ShadowRoot {
  return (value as Node).nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}

function resolveContainer(
  container: UseFloatingPortalNodeParameters['container'],
  parentPortalNode: Readonly<Ref<HTMLElement | null>> | undefined,
): HTMLElement | ShadowRoot | null {
  const prop = toValue(container);
  // A `null` prop waits for the consumer to give the container. A ref or a getter that gives
  // `null` uses the fallback, as an empty ref object of Base UI does.
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
 * to `containerElement`, and the portal element is inside that `Teleport`.
 */
export function useFloatingPortalNode(
  params: UseFloatingPortalNodeParameters,
): UseFloatingPortalNodeReturnValue {
  const uniqueId = useId();
  const parentPortalNode = usePortalContext()?.portalNode;

  const mounted = useIsHydrated();
  const containerElement = shallowRef<HTMLElement | ShadowRoot | null>(null);
  // The getter reads nothing before the mount, because a server has no DOM and a getter of the
  // consumer can read the DOM. An ancestor or a later sibling can fill a ref container in the flush
  // of the mount. The ref has its element when this `watch` runs.
  watch(
    () => (mounted.value ? resolveContainer(params.container, parentPortalNode) : null),
    (container) => {
      containerElement.value = container;
    },
    { flush: 'post' },
  );

  // A `Teleport` leaves its content in the target when `KeepAlive` deactivates the part. A
  // disabled `Teleport` keeps the content in its own place, and `KeepAlive` takes that place out
  // of the document.
  const deactivated = shallowRef(false);
  onDeactivated(() => {
    deactivated.value = true;
  });
  onActivated(() => {
    deactivated.value = false;
  });

  const { element, elementProps } = useRenderElement('div', params.componentProps, {
    props: (attrs) => [{ id: uniqueId, [attr]: '' }, attrs],
  });

  return { element, elementProps, containerElement, deactivated };
}
