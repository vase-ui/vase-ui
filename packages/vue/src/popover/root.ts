import { computed, inject, provide, shallowRef, type InjectionKey, type ShallowRef } from 'vue';
import { createError } from '../common/createError';
import { usePopupFocus, type FocusTarget } from '../popup/focus';
import { isInPopup, type Layer } from '../popup/layer';
import { useModalLayer } from '../popup/modal';
import { PopupHandle, usePopupRoot, type PopupRoot } from '../popup/root';
import { useHandleRoot } from '../popup/trigger';
import { useFullWidth, type usePlacement } from '../popup/placement';
import type { ViewportSizes } from '../popup/viewport';
import type {
  PopoverRootChangeEventDetails,
  PopoverRootChangeEventReason,
  PopoverRootProps,
} from './types';

/** Opens and closes a popover from code, and connects triggers outside the root to it. */
export class PopoverHandle<Payload = unknown> extends PopupHandle<Payload> {}

/** Makes a handle. `new Popover.Handle()` makes the same object. */
export function createHandle<Payload = unknown>() {
  return new PopoverHandle<Payload>();
}

/** What `Popover.Root` gives to its parts. The properties are reactive. */
export interface PopoverRootContext<Payload = unknown> {
  readonly root: PopupRoot<Payload>;
  readonly layer: Layer;
  readonly modal: boolean | 'trap-focus';
  /** A hover opened the popover, and no press kept it open. */
  readonly hoverOpen: boolean;
  readonly focus: ReturnType<typeof usePopupFocus>;
  /** The element is in the popup or in a popup above it. */
  inside(element: Element): boolean;
  /** Adds a `Popover.Close`. The focus stays in a modal popover only with one. */
  addClose(): () => void;
  /** The positioner element, while it is mounted. */
  positioner: ShallowRef<HTMLElement | null>;
  /**
   * The positioner has a place. A positioner that stays mounted after a close keeps it until its
   * next place.
   */
  placed: ShallowRef<boolean>;
  /** The focus props of the popup. */
  popupFocus: ShallowRef<{ initialFocus?: FocusTarget; finalFocus?: FocusTarget }>;
  viewport: ShallowRef<ViewportSizes | null>;
}

const popoverRootKey: InjectionKey<PopoverRootContext> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'popover root' : undefined,
);
/** The placement that `Popover.Positioner` gives to the popup and the arrow. */
export const positionerKey: InjectionKey<ReturnType<typeof usePlacement>> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'popover positioner' : undefined,
);
const portalKey: InjectionKey<true> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'popover portal' : undefined,
);
const contexts = new WeakMap<PopupRoot, PopoverRootContext>();

export function usePopoverRoot<Payload>(
  props: Required<Pick<PopoverRootProps<Payload>, 'defaultOpen' | 'defaultTriggerId' | 'modal'>> &
    PopoverRootProps<Payload>,
  emit: {
    (event: 'openChange', open: boolean, details: PopoverRootChangeEventDetails): void;
    (event: 'update:open', open: boolean): void;
    (event: 'update:triggerId', id: string | null): void;
  },
) {
  const root = usePopupRoot<Payload>({
    name: 'Popover',
    open: () => props.open,
    defaultOpen: props.defaultOpen,
    triggerId: () => props.triggerId,
    defaultTriggerId: props.defaultTriggerId,
    handle: () => props.handle,
    emitChange: (open, details) =>
      emit('openChange', open, details as PopoverRootChangeEventDetails),
    emitOpen: (open) => emit('update:open', open),
    emitTriggerId: (id) => emit('update:triggerId', id),
    instantOf(open, reason, event) {
      if (reason === 'trigger-press' && (event as MouseEvent).detail === 0) return 'click';
      if (!open && (reason === 'escape-key' || reason === 'none')) return 'dismiss';
      if (reason === 'focus-out') return 'focus';
      return undefined;
    },
  });

  const closes = shallowRef(0);
  const positioner = shallowRef<HTMLElement | null>(null);
  const placed = shallowRef(false);
  const fullWidth = useFullWidth(positioner, placed);

  const hoverOpen = computed(() => root.reason === 'trigger-hover');
  // A touch screen reader needs a way out of a popup that keeps the focus.
  const trap = computed(() => props.modal !== false && closes.value > 0 && !hoverOpen.value);
  const layer = useModalLayer(root, () => {
    const modal = props.modal === true && !hoverOpen.value && !!positioner.value;
    return {
      escape: true,
      outsidePress: true,
      // A popover that a hover opened keeps the order of the page for the focus.
      focusOut: !hoverOpen.value,
      pressStart: props.modal === 'trap-focus' && trap.value,
      block: modal,
      hide: trap.value ? (props.modal === true ? 'inert' : 'aria-hidden') : false,
      trap: trap.value,
      lockScroll: modal && (root.interaction !== 'touch' || fullWidth.value),
      triggerInUse: true,
    };
  });

  const popupFocus = shallowRef<{ initialFocus?: FocusTarget; finalFocus?: FocusTarget }>({});
  const focus = usePopupFocus(root, layer, {
    takesFocus: () => !hoverOpen.value,
    placed: () => placed.value,
    initialFocus: () => popupFocus.value.initialFocus,
    finalFocus: () => popupFocus.value.finalFocus,
  });

  const context: PopoverRootContext<Payload> = {
    root,
    layer,
    get modal() {
      return props.modal;
    },
    get hoverOpen() {
      return hoverOpen.value;
    },
    focus,
    inside: (element) => isInPopup(layer, element),
    addClose() {
      closes.value += 1;
      return () => (closes.value -= 1);
    },
    positioner,
    placed,
    popupFocus,
    viewport: shallowRef(null),
  };
  contexts.set(root, context);
  provide(popoverRootKey, context as PopoverRootContext);

  return {
    root,
    /** Asks for a close with the reason `'imperative-action'`. */
    close() {
      root.request(
        false,
        'imperative-action' satisfies PopoverRootChangeEventReason,
        new Event('vase-ui'),
      );
    },
  };
}

function missingRoot(part: string): never {
  throw createError(42, part);
}

/** The root of the part. A part with no root throws an error that names it. */
export function injectPopoverRoot(part: string) {
  return inject(popoverRootKey, null) ?? missingRoot(part);
}

/**
 * The root of a trigger: the root of its `handle`, else the root around it. A trigger with a
 * `handle` and no mounted root is closed.
 */
export function useTriggerRoot(handle: () => PopoverHandle | undefined) {
  const injected = inject(popoverRootKey, null);
  if (!injected && !handle()) {
    throw createError(43);
  }
  const handleRoot = useHandleRoot(handle);
  return computed(() => {
    if (!handle()) return injected;
    const root = handleRoot.value;
    return root ? (contexts.get(root) ?? null) : null;
  });
}

/** Marks the parts in a `Popover.Portal`. */
export function providePortal() {
  provide(portalKey, true);
}

/** The placement of the positioner around the part. A part with no positioner throws an error. */
export function injectPositioner(part: string) {
  const placement = inject(positionerKey, null);
  if (!placement) {
    throw createError(44, part);
  }
  return placement;
}

/** `Popover.Positioner` and `Popover.Backdrop` need a portal of their root. */
export function injectPortal(part: string) {
  if (!inject(portalKey, false)) {
    throw createError(45, part);
  }
}
