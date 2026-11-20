import {
  computed,
  inject,
  provide,
  shallowRef,
  watch,
  type InjectionKey,
  type ShallowRef,
} from 'vue';
import { useLayer, type Layer } from '../popup/layer';
import type { usePlacement } from '../popup/placement';
import { PopupHandle, rootOfHandle, usePopupRoot, type PopupRoot } from '../popup/root';
import type { ViewportSizes } from '../popup/viewport';
import { useCursorAnchor } from './cursor';
import { injectGroup, useGroupMember } from './group';
import type {
  TooltipInstant,
  TooltipRootChangeEventDetails,
  TooltipRootChangeEventReason,
  TooltipRootProps,
} from './types';

/** Opens and closes a tooltip from code, and connects triggers outside the root to it. */
export class TooltipHandle<Payload = unknown> extends PopupHandle<Payload> {}

/** Makes a handle. `new Tooltip.Handle()` makes the same object. */
export function createHandle<Payload = unknown>() {
  return new TooltipHandle<Payload>();
}

/** What `Tooltip.Root` gives to its parts. The properties are reactive. */
export interface TooltipRootContext<Payload = unknown> {
  readonly root: PopupRoot<Payload>;
  readonly layer: Layer;
  readonly disabled: boolean;
  /** The pointer can rest on the popup. */
  readonly hoverable: boolean;
  readonly trackCursorAxis: 'none' | 'x' | 'y' | 'both';
  readonly instant: TooltipInstant;
  readonly cursor: ReturnType<typeof useCursorAnchor>;
  viewport: ShallowRef<ViewportSizes | null>;
}

const tooltipRootKey: InjectionKey<TooltipRootContext> = Symbol('tooltip root');
/** The placement that `Tooltip.Positioner` gives to the popup and the arrow. */
export const positionerKey: InjectionKey<ReturnType<typeof usePlacement>> =
  Symbol('tooltip positioner');
const portalKey: InjectionKey<true> = Symbol('tooltip portal');
const contexts = new WeakMap<PopupRoot, TooltipRootContext>();

/**
 * The `pointerover` and `focusin` events that a trigger in another trigger got first. The outer
 * trigger gets the same event object, also across an open shadow root
 * (test/measurements/tooltip.test.ts).
 */
export const innerTriggerEvents = new WeakSet<Event>();

/**
 * The `instant` state of a change of a popup that opens on hover: `'focus'` after an open by the
 * focus, `'dismiss'` after a close by Escape or by a press on the trigger. A change by the hover
 * removes the value, and each other change keeps it.
 */
export function hoverPopupInstant(open: boolean, reason: string, previous: string | undefined) {
  if (open && reason === 'trigger-focus') return 'focus';
  if (!open && (reason === 'trigger-press' || reason === 'escape-key')) return 'dismiss';
  if (reason === 'trigger-hover') return undefined;
  return previous;
}

/**
 * Asks for a close with the reason `'none'` when the active trigger of an open popup leaves the
 * DOM, and no trigger with its id is in the DOM after that update.
 */
export function useCloseWhenTriggerLeaves(root: PopupRoot) {
  watch(
    () =>
      root.open &&
      root.activeTriggerId !== null &&
      root.triggers.some((trigger) => trigger.id === root.activeTriggerId),
    (present, was) => {
      if (was && !present && root.open) root.request(false, 'none', new Event('vase-ui'));
    },
    { flush: 'post' },
  );
}

export function useTooltipRoot<Payload>(
  props: Required<
    Pick<
      TooltipRootProps<Payload>,
      'defaultOpen' | 'defaultTriggerId' | 'disabled' | 'disableHoverablePopup' | 'trackCursorAxis'
    >
  > &
    TooltipRootProps<Payload>,
  emit: {
    (event: 'openChange', open: boolean, details: TooltipRootChangeEventDetails): void;
    (event: 'update:open', open: boolean): void;
    (event: 'update:triggerId', id: string | null): void;
  },
) {
  const root: PopupRoot<Payload> = usePopupRoot<Payload>({
    name: 'Tooltip',
    open: () => props.open,
    defaultOpen: props.defaultOpen,
    triggerId: () => props.triggerId,
    defaultTriggerId: props.defaultTriggerId,
    handle: () => props.handle,
    disabled: () => props.disabled,
    emitChange: (open, details) =>
      emit('openChange', open, details as TooltipRootChangeEventDetails),
    emitOpen: (open) => emit('update:open', open),
    emitTriggerId: (id) => emit('update:triggerId', id),
    instantOf: (open, reason) => hoverPopupInstant(open, reason, root.instant),
  });
  const layer = useLayer(root, () => ({
    escape: true,
    outsidePress: true,
    focusOut: false,
    pressStart: false,
    block: false,
    hide: false,
    trap: false,
    lockScroll: false,
    triggerInUse: true,
    touchDrag: true,
  }));
  useCloseWhenTriggerLeaves(root);

  // A tooltip that opens while another tooltip of its group keeps the group active skips its
  // animations until it closes. A close by another tooltip, or because the trigger left, skips the
  // animation of the leave.
  const delayed = shallowRef(false);
  watch(
    () => root.open,
    (open) => {
      if (!open) delayed.value = root.reason === 'none';
    },
    { flush: 'sync' },
  );
  useGroupMember(root, injectGroup(), {
    opensInGroup: (inGroup) => (delayed.value = inGroup),
    closeForSibling() {
      if (root.open) {
        root.request(false, 'none' satisfies TooltipRootChangeEventReason, new Event('vase-ui'));
      } else if (root.leaving) {
        root.endLeaving();
      }
    },
  });

  const cursor = useCursorAnchor(root, () => props.trackCursorAxis);
  const hoverable = computed(
    () => !props.disableHoverablePopup && props.trackCursorAxis !== 'both',
  );

  const context: TooltipRootContext<Payload> = {
    root,
    layer,
    get disabled() {
      return props.disabled;
    },
    get hoverable() {
      return hoverable.value;
    },
    get trackCursorAxis() {
      return props.trackCursorAxis;
    },
    get instant() {
      return delayed.value ? 'delay' : (root.instant as TooltipInstant);
    },
    cursor,
    viewport: shallowRef(null),
  };
  contexts.set(root, context);
  provide(tooltipRootKey, context as TooltipRootContext);

  return {
    root,
    /** Asks for a close with the reason `'imperative-action'`. */
    close() {
      root.request(
        false,
        'imperative-action' satisfies TooltipRootChangeEventReason,
        new Event('vase-ui'),
      );
    },
  };
}

function missingRoot(part: string): never {
  throw new Error(
    `Vase UI: <Tooltip.${part}> must be inside <Tooltip.Root>. Without a root the part has no tooltip. Put the part inside <Tooltip.Root>.`,
  );
}

/** The root of the part. A part with no root throws an error that names it. */
export function injectTooltipRoot(part: string) {
  return inject(tooltipRootKey, null) ?? missingRoot(part);
}

/**
 * The root of a trigger: the root of its `handle`, else the root around it. A trigger with a
 * `handle` and no mounted root is closed.
 */
export function useTriggerRoot(handle: () => TooltipHandle | undefined) {
  const injected = inject(tooltipRootKey, null);
  if (!injected && !handle()) {
    throw new Error(
      'Vase UI: <Tooltip.Trigger> must be inside <Tooltip.Root>, or it must have a `handle`. Without a root the trigger has no tooltip to open. Put the trigger inside <Tooltip.Root>, or pass a `handle`.',
    );
  }
  return computed(() => {
    const given = handle();
    if (!given) return injected;
    const root = rootOfHandle(given);
    return root ? (contexts.get(root) ?? null) : null;
  });
}

/** Marks the parts in a `Tooltip.Portal`. */
export function providePortal() {
  provide(portalKey, true);
}

/** The placement of the positioner around the part. A part with no positioner throws an error. */
export function injectPositioner(part: string) {
  const placement = inject(positionerKey, null);
  if (!placement) {
    throw new Error(
      `Vase UI: <Tooltip.${part}> must be inside <Tooltip.Positioner>. Put the part inside <Tooltip.Positioner>.`,
    );
  }
  return placement;
}

/** `Tooltip.Positioner` needs a portal of its root. */
export function injectPortal(part: string) {
  if (!inject(portalKey, false)) {
    throw new Error(
      `Vase UI: <Tooltip.${part}> must be inside <Tooltip.Portal>. Put the part inside <Tooltip.Portal>.`,
    );
  }
}
