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
  type RendererElement,
} from 'vue';
import { useIsHydrated } from '../common/hydration';
import { visuallyHidden } from '../common/visuallyHidden';
import type { Layer } from './layer';
import type { PopupRoot } from './root';

/** The target of a `<Teleport>`: a selector or an element. `null` renders nothing. */
export type PortalTarget = string | RendererElement | null;

export interface PopupPortalProps {
  /**
   * The target of the content. With no value, the target of the nearest portal above, else
   * `body`. While it is `null`, the portal renders nothing.
   */
  to?: PortalTarget | undefined;
  /** Renders the content in place, also on the server. */
  disabled?: boolean;
  /** Moves the content after the other content of the same update mounted. */
  defer?: boolean;
  /** The closed popup stays in the DOM, with `hidden` and `inert`. */
  keepMounted?: boolean;
}

// One key for each popup family, so that a popup in a popup has the target of its parent.
const targetKey: InjectionKey<() => PortalTarget> = Symbol('portal target');

export function usePopupPortal(
  root: PopupRoot,
  layer: Layer,
  props: PopupPortalProps,
  options: { takesFocus: () => boolean },
) {
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
  const sentinels = computed(() => root.open && options.takesFocus() && !!root.popup);
  const blocks = computed(() => root.open && layer.block);

  const blockElement = shallowRef<HTMLElement | null>(null);
  const hole = shallowRef<DOMRect>();
  watch(
    [() => root.activeTrigger, blockElement],
    ([trigger, block], _, onCleanup) => {
      hole.value = undefined;
      if (!trigger?.isConnected || !block) return;
      onCleanup(autoUpdate(trigger, block, () => (hole.value = trigger.getBoundingClientRect())));
    },
    { flush: 'post' },
  );
  const blockStyle = computed<CSSProperties>(() => {
    const rect = hole.value;
    return {
      position: 'fixed',
      inset: 0,
      // A double click selects text of the page in Firefox and WebKit
      // (test/measurements/popup.test.ts).
      userSelect: 'none',
      WebkitUserSelect: 'none',
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
    setBlock: (element: unknown) => (blockElement.value = element as HTMLElement | null),
    setBefore: (element: unknown) => (before.value = element as HTMLElement | null),
    setAfter: (element: unknown) => (after.value = element as HTMLElement | null),
  };
}
