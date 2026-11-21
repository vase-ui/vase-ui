import { autoUpdate } from '@floating-ui/vue';
import {
  computed,
  inject,
  onUnmounted,
  provide,
  shallowRef,
  watch,
  type CSSProperties,
  type InjectionKey,
} from 'vue';
import { useIsHydrated } from '../common/hydration';
import { visuallyHidden } from '../common/visuallyHidden';
import type { Layer } from './layer';
import type { PopupRoot } from './root';

/**
 * A `mousedown` listener of an element that covers the page. A press on such an element moves the
 * focus to `<body>`, and a double click selects text of the page in Firefox and WebKit. The default
 * action of `mousedown` does both (test/measurements/dialog.test.ts, "a press on a fixed element
 * that is not focusable", and test/measurements/popup.test.ts, "a double click on a fixed element
 * over text").
 */
export function keepFocus(event: MouseEvent) {
  if (event.target === event.currentTarget) event.preventDefault();
}

/** The target of a `<Teleport>`: a selector, an element or a shadow root. `null` renders nothing. */
export type PortalTarget = string | Element | ShadowRoot | null;

export interface PopupPortalProps {
  /**
   * The target of the content. With no value, the target of the nearest portal above, else
   * `body`. While it is `null`, the portal renders nothing.
   */
  to?: PortalTarget | undefined;
  /**
   * Renders the content in place, also on the server.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Moves the content after the other content of the same update mounted.
   * @default false
   */
  defer?: boolean | undefined;
  /**
   * The closed popup stays in the DOM, with `hidden` and `inert`.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

// One key for each popup family, so that a popup in a popup has the target of its parent.
const targetKey: InjectionKey<() => PortalTarget> = Symbol('portal target');

/**
 * Gives the portals below the component the target that the function gives from the inherited
 * one, such as the target of a portal that is not above them in the component tree.
 */
export function providePortalTarget(target: (inherited: PortalTarget) => PortalTarget) {
  const inherited = inject(targetKey, () => 'body');
  provide(targetKey, () => target(inherited()));
}

/**
 * The target of the `<Teleport>` of a portal, and whether the portal renders it. A portal with no
 * popup root, such as `Toast.Portal`, calls it alone.
 */
export function usePortalTarget(props: Pick<PopupPortalProps, 'to' | 'disabled'>) {
  const inherited = inject(targetKey, () => 'body');
  const target = computed(() => (props.to === undefined ? inherited() : props.to));
  provide(targetKey, () => target.value);

  // The server HTML has no content of a teleport to `<body>`, and Vue cannot hydrate one. So the
  // portal renders its teleport after its mount (the Vue guide on server rendering, "Teleports").
  const mounted = useIsHydrated();
  const rendered = computed(() => (mounted.value || !!props.disabled) && target.value !== null);
  return { target, mounted, rendered };
}

export function usePopupPortal(root: PopupRoot, layer: Layer, props: PopupPortalProps) {
  const { target, mounted, rendered: placed } = usePortalTarget(props);

  watch(
    () => !!props.keepMounted,
    (keep) => root.setKeepMounted(keep),
    { immediate: true },
  );

  const rendered = computed(() => placed.value && (root.open || root.leaving || root.keepMounted));
  // The server HTML of a disabled portal has no sentinels and no block, because the server has no
  // popup element and no layer. In place, a popup with no trap has the order of the document.
  const sentinels = computed(
    () => mounted.value && root.open && !!root.popup && (!props.disabled || layer.trap),
  );
  const blocks = computed(() => mounted.value && root.open && layer.block);

  const blockElement = shallowRef<HTMLElement | null>(null);
  const hole = shallowRef<DOMRect>();
  watch(
    [
      () =>
        layer.hole !== undefined ? layer.hole : layer.triggerInUse ? root.activeTrigger : null,
      blockElement,
    ],
    ([trigger, block], _, onCleanup) => {
      hole.value = undefined;
      if (!trigger || !block) return;
      onCleanup(autoUpdate(trigger, block, () => (hole.value = trigger.getBoundingClientRect())));
    },
    { flush: 'post' },
  );
  const blockStyle = computed<CSSProperties>(() => {
    const rect = hole.value;
    return {
      position: 'fixed',
      inset: 0,
      // The active trigger, or the hole of the layer, keeps its hover and its press.
      clipPath: rect
        ? `polygon(evenodd,0 0,100% 0,100% 100%,0 100%,0 0,${rect.left}px ${rect.top}px,${rect.right}px ${rect.top}px,${rect.right}px ${rect.bottom}px,${rect.left}px ${rect.bottom}px,${rect.left}px ${rect.top}px)`
        : undefined,
    };
  });

  const before = shallowRef<HTMLElement | null>(null);
  const after = shallowRef<HTMLElement | null>(null);
  const removals = [
    root.addPortalElement(() => blockElement.value),
    root.addPortalElement(() => before.value),
    root.addPortalElement(() => after.value),
  ];
  onUnmounted(() => {
    for (const remove of removals) remove();
  });

  return {
    /** The target of the `<Teleport>`. */
    target,
    rendered,
    sentinels,
    blocks,
    blockStyle,
    sentinelStyle: visuallyHidden,
    before,
    after,
    onBlockMousedown: keepFocus,
    setBlock: (element: unknown) => (blockElement.value = element as HTMLElement | null),
    setBefore: (element: unknown) => (before.value = element as HTMLElement | null),
    setAfter: (element: unknown) => (after.value = element as HTMLElement | null),
  };
}
