import { autoUpdate } from '@floating-ui/vue';
import {
  computed,
  inject,
  onMounted,
  onUnmounted,
  provide,
  shallowRef,
  watch,
  type CSSProperties,
  type InjectionKey,
  type Ref,
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
const targetKey: InjectionKey<() => PortalTarget> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'portal target' : undefined,
);

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

const portalMountedKey: InjectionKey<Readonly<Ref<boolean>>> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'portal mounted' : undefined,
);

export function usePopupPortal(root: PopupRoot, layer: Layer, props: PopupPortalProps) {
  const { target, mounted, rendered: placed } = usePortalTarget(props);
  provide(portalMountedKey, mounted);

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
  // A string, so that a notice of the observers with the same place renders nothing.
  const clipPath = shallowRef<string>();
  watch(
    [
      () =>
        layer.hole !== undefined ? layer.hole : layer.triggerInUse ? root.activeTrigger : null,
      blockElement,
    ],
    ([trigger, block], _, onCleanup) => {
      clipPath.value = undefined;
      if (!trigger || !block) return;
      onCleanup(
        autoUpdate(trigger, block, () => {
          const rect = trigger.getBoundingClientRect();
          clipPath.value = `polygon(evenodd,0 0,100% 0,100% 100%,0 100%,0 0,${rect.left}px ${rect.top}px,${rect.right}px ${rect.top}px,${rect.right}px ${rect.bottom}px,${rect.left}px ${rect.bottom}px,${rect.left}px ${rect.top}px)`;
        }),
      );
    },
    { flush: 'post' },
  );
  const blockStyle = computed<CSSProperties>(() => ({
    position: 'fixed',
    inset: 0,
    // The active trigger, or the hole of the layer, keeps its hover and its press.
    clipPath: clipPath.value,
  }));

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

/**
 * Whether a popup or a backdrop in a portal shows its element, which the part hides with `v-show`.
 * A `<Transition>` around the part then makes an open during the leave go back from where it is
 * (test/measurements/popup.test.ts). The element shows one update after its mount, so the
 * `<Transition>` runs its enter with no `appear`. An element that renders before its portal is
 * mounted, as on the server and in a disabled portal at the first render, shows at its mount. The
 * root keeps the element until its leave ends.
 */
export function usePopupPart(root: PopupRoot, element: Readonly<Ref<Element | null>>) {
  const entered = shallowRef(!inject(portalMountedKey, null)?.value);
  onMounted(() => (entered.value = true));
  const removeLeaving = root.addLeaving(() => element.value);
  onUnmounted(removeLeaving);
  return computed(() => root.keepMounted || (root.open && entered.value));
}

/**
 * The `id` of the popup for `aria-owns` of an element at the place of the portal, so that a screen
 * reader reads the popup after its trigger. It has a value while the portal has its sentinels and
 * Tab can leave the popup.
 */
export function usePortalOwner(root: PopupRoot, layer: Layer, sentinels: Readonly<Ref<boolean>>) {
  const id = shallowRef<string>();
  watch(
    () => (sentinels.value && !layer.trap ? root.popup : null),
    (popup, _, onCleanup) => {
      id.value = popup?.id || undefined;
      if (!popup) return;
      // The `id` attribute of an element is not reactive.
      const observer = new MutationObserver(() => (id.value = popup.id || undefined));
      observer.observe(popup, { attributeFilter: ['id'] });
      onCleanup(() => observer.disconnect());
    },
    { immediate: true },
  );
  return id;
}
