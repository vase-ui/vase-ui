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
 * focus to `<body>`, and a double click selects text of the page in Firefox. The default action of
 * `mousedown` does both (test/measurements/dialog.test.ts).
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
  /** Renders the content in place, also on the server. */
  disabled?: boolean | undefined;
  /** Moves the content after the other content of the same update mounted. */
  defer?: boolean | undefined;
  /** The closed popup stays in the DOM, with `hidden` and `inert`. */
  keepMounted?: boolean | undefined;
}

// One key for each popup family, so that a popup in a popup has the target of its parent.
const targetKey: InjectionKey<() => PortalTarget> = Symbol('portal target');

export function usePopupPortal(root: PopupRoot, layer: Layer, props: PopupPortalProps) {
  const inherited = inject(targetKey, () => 'body');
  const target = computed(() => (props.to === undefined ? inherited() : props.to));
  provide(targetKey, () => target.value);

  // The server HTML has no content of a teleport to `<body>`, and Vue cannot hydrate one. So the
  // portal renders its teleport after its mount (the Vue guide on server rendering, "Teleports").
  const mounted = useIsHydrated();

  watch(
    () => !!props.keepMounted,
    (keep) => root.setKeepMounted(keep),
    { immediate: true },
  );

  const rendered = computed(
    () =>
      (mounted.value || !!props.disabled) &&
      target.value !== null &&
      (root.open || root.leaving || root.keepMounted),
  );
  // The server HTML of a disabled portal has no sentinels and no block, because the server has no
  // popup element and no layer. In place, a popup with no trap has the order of the document.
  const sentinels = computed(
    () => mounted.value && root.open && !!root.popup && (!props.disabled || layer.trap),
  );
  const blocks = computed(() => mounted.value && root.open && layer.block);

  const blockElement = shallowRef<HTMLElement | null>(null);
  const hole = shallowRef<DOMRect>();
  watch(
    [() => (layer.triggerInUse ? root.activeTrigger : null), blockElement],
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
      // The active trigger keeps its hover and its press.
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
    target,
    rendered,
    sentinels,
    blocks,
    blockStyle,
    sentinelStyle: visuallyHidden,
    onBlockMousedown: keepFocus,
    setBlock: (element: unknown) => (blockElement.value = element as HTMLElement | null),
    setBefore: (element: unknown) => (before.value = element as HTMLElement | null),
    setAfter: (element: unknown) => (after.value = element as HTMLElement | null),
  };
}
