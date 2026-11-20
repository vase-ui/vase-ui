import {
  computed,
  inject,
  provide,
  shallowRef,
  watch,
  type InjectionKey,
  type ShallowRef,
} from 'vue';
import { isInPopup, useLayer, type Layer } from '../popup/layer';
import type { usePlacement } from '../popup/placement';
import { PopupHandle, rootOfHandle, usePopupRoot, type PopupRoot } from '../popup/root';
import type { ViewportSizes } from '../popup/viewport';
import { hoveredLineOf, type Line } from './line';
import type {
  PreviewCardRootChangeEventDetails,
  PreviewCardRootChangeEventReason,
  PreviewCardRootProps,
} from './types';

/** Opens and closes a preview card from code, and connects triggers outside the root to it. */
export class PreviewCardHandle<Payload = unknown> extends PopupHandle<Payload> {}

/** Makes a handle. `new PreviewCard.Handle()` makes the same object. */
export function createHandle<Payload = unknown>() {
  return new PreviewCardHandle<Payload>();
}

/** What `PreviewCard.Root` gives to its parts. The properties are reactive. */
export interface PreviewCardRootContext<Payload = unknown> {
  readonly root: PopupRoot<Payload>;
  readonly layer: Layer;
  /** The line of a wrapped link that the pointer was on at the open by hover. */
  readonly line: Line | null;
  /** The element is in the popup or in a popup above it. */
  inside(element: Element): boolean;
  viewport: ShallowRef<ViewportSizes | null>;
}

const previewCardRootKey: InjectionKey<PreviewCardRootContext> = Symbol('preview card root');
/** The placement that `PreviewCard.Positioner` gives to the popup and the arrow. */
export const positionerKey: InjectionKey<ReturnType<typeof usePlacement>> =
  Symbol('preview card positioner');
const portalKey: InjectionKey<true> = Symbol('preview card portal');
const contexts = new WeakMap<PopupRoot, PreviewCardRootContext>();

/**
 * The `instant` state of a popup that opens on hover: `'focus'` after an open by the focus,
 * `'dismiss'` after a close by Escape, none after a hover. Each other reason keeps the value.
 */
export function hoverPopupInstant(open: boolean, reason: string, instant: string | undefined) {
  if (open && reason === 'trigger-focus') return 'focus';
  if (!open && reason === 'escape-key') return 'dismiss';
  if (reason === 'trigger-hover') return undefined;
  return instant;
}

/**
 * Closes the open root when its active trigger leaves the DOM. A trigger that a `v-if` with a new
 * `key` replaces in one update is mounted for a `post` watcher
 * (test/measurements/preview-card.test.ts).
 */
export function useCloseWhenTriggerLeaves(root: PopupRoot) {
  const mounted = computed(() =>
    root.triggers.some((trigger) => trigger.id === root.activeTriggerId && !!trigger.element),
  );
  watch(
    mounted,
    (isMounted) => {
      if (!isMounted && root.open) root.request(false, 'none', new Event('vase-ui'));
    },
    { flush: 'post' },
  );
}

export function usePreviewCardRoot<Payload>(
  props: Required<Pick<PreviewCardRootProps<Payload>, 'defaultOpen' | 'defaultTriggerId'>> &
    PreviewCardRootProps<Payload>,
  emit: {
    (event: 'openChange', open: boolean, details: PreviewCardRootChangeEventDetails): void;
    (event: 'update:open', open: boolean): void;
    (event: 'update:triggerId', id: string | null): void;
  },
) {
  const line = shallowRef<Line | null>(null);
  const root: PopupRoot<Payload> = usePopupRoot<Payload>({
    name: 'PreviewCard',
    open: () => props.open,
    defaultOpen: props.defaultOpen,
    triggerId: () => props.triggerId,
    defaultTriggerId: props.defaultTriggerId,
    handle: () => props.handle,
    emitChange(open, details) {
      emit('openChange', open, details as PreviewCardRootChangeEventDetails);
      if (!open) return;
      line.value =
        details.reason === 'trigger-hover' && details.trigger
          ? hoveredLineOf(details.trigger)
          : null;
    },
    emitOpen: (open) => emit('update:open', open),
    emitTriggerId: (id) => emit('update:triggerId', id),
    instantOf: (open, reason) => hoverPopupInstant(open, reason, root.instant),
  });
  watch(
    () => root.open,
    (open) => {
      if (!open) line.value = null;
    },
    { flush: 'sync' },
  );

  const layer = useLayer(root, () => ({
    escape: true,
    outsidePress: true,
    focusOut: false,
    pressStart: false,
    block: false,
    hide: false,
    trap: false,
    lockScroll: false,
  }));
  useCloseWhenTriggerLeaves(root);

  const context: PreviewCardRootContext<Payload> = {
    root,
    layer,
    get line() {
      return line.value;
    },
    inside: (element) => isInPopup(layer, element),
    viewport: shallowRef(null),
  };
  contexts.set(root, context);
  provide(previewCardRootKey, context as PreviewCardRootContext);

  return {
    root,
    /** Asks for a close with the reason `'imperative-action'`. */
    close() {
      root.request(
        false,
        'imperative-action' satisfies PreviewCardRootChangeEventReason,
        new Event('vase-ui'),
      );
    },
  };
}

function missingRoot(part: string): never {
  throw new Error(
    `Vase UI: <PreviewCard.${part}> must be inside <PreviewCard.Root>. Without a root the part has no preview card. Put the part inside <PreviewCard.Root>.`,
  );
}

/** The root of the part. A part with no root throws an error that names it. */
export function injectPreviewCardRoot(part: string) {
  return inject(previewCardRootKey, null) ?? missingRoot(part);
}

/**
 * The root of a trigger: the root of its `handle`, else the root around it. A trigger with a
 * `handle` and no mounted root is closed.
 */
export function useTriggerRoot(handle: () => PreviewCardHandle | undefined) {
  const injected = inject(previewCardRootKey, null);
  if (!injected && !handle()) {
    throw new Error(
      'Vase UI: <PreviewCard.Trigger> must be inside <PreviewCard.Root>, or it must have a `handle`. Without a root the trigger has no preview card to open. Put the trigger inside <PreviewCard.Root>, or pass a `handle`.',
    );
  }
  return computed(() => {
    const given = handle();
    if (!given) return injected;
    const root = rootOfHandle(given);
    return root ? (contexts.get(root) ?? null) : null;
  });
}

/** Marks the parts in a `PreviewCard.Portal`. */
export function providePortal() {
  provide(portalKey, true);
}

/** The placement of the positioner around the part. A part with no positioner throws an error. */
export function injectPositioner(part: string) {
  const placement = inject(positionerKey, null);
  if (!placement) {
    throw new Error(
      `Vase UI: <PreviewCard.${part}> must be inside <PreviewCard.Positioner>. Put the part inside <PreviewCard.Positioner>.`,
    );
  }
  return placement;
}

/** `PreviewCard.Positioner` and `PreviewCard.Backdrop` need a portal of their root. */
export function injectPortal(part: string) {
  if (!inject(portalKey, false)) {
    throw new Error(
      `Vase UI: <PreviewCard.${part}> must be inside <PreviewCard.Portal>. Put the part inside <PreviewCard.Portal>.`,
    );
  }
}
