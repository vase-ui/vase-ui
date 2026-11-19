<script lang="ts">
import { computed, onMounted, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { addEventListener } from '../../common/addEventListener';
import { ownerWindow } from '../../common/owner';
import { contains, getTarget } from '../../common/shadowDom';
import { useDomEffect } from '../../utils/popups/useDomEffect';
import type { PopupInteractionContext, ReferenceType } from '../../utils/popups/types';
import { isMouseLikePointerType } from '../../utils/popups/event';

import type { VaseUIChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { TooltipHandle } from '../store/TooltipHandle';

function createVirtualElement(
  domElement: Element | null | undefined,
  data: {
    axis: 'x' | 'y' | 'both';
    storeContext: Pick<PopupInteractionContext, 'openEvent'>;
    pointerType: string | undefined;
    x: number | null;
    y: number | null;
  },
) {
  let offsetX: number | null = null;
  let offsetY: number | null = null;
  let isAutoUpdateEvent = false;

  return {
    contextElement: domElement ?? undefined,
    getBoundingClientRect() {
      const domRect = domElement?.getBoundingClientRect() ?? {
        width: 0,
        height: 0,
        x: 0,
        y: 0,
      };

      const isXAxis = data.axis === 'x' || data.axis === 'both';
      const isYAxis = data.axis === 'y' || data.axis === 'both';
      const canTrackCursorOnAutoUpdate =
        ['mouseenter', 'mousemove'].includes(data.storeContext.openEvent?.type || '') &&
        data.pointerType !== 'touch';

      const width = data.axis === 'y' ? domRect.width : 0;
      const height = data.axis === 'x' ? domRect.height : 0;
      let x = domRect.x;
      let y = domRect.y;

      // An element out of the document, such as a trigger that `KeepAlive` holds, has an empty
      // rect. The offset waits for a rect of the element in the document.
      const isMeasured = !domElement || domElement.isConnected;

      if (offsetX == null && data.x && isXAxis && isMeasured) {
        offsetX = domRect.x - data.x;
      }

      if (offsetY == null && data.y && isYAxis && isMeasured) {
        offsetY = domRect.y - data.y;
      }

      x -= offsetX || 0;
      y -= offsetY || 0;

      if (!isAutoUpdateEvent || canTrackCursorOnAutoUpdate) {
        x = isXAxis && data.x != null ? data.x : x;
        y = isYAxis && data.y != null ? data.y : y;
      }

      isAutoUpdateEvent = true;

      return {
        width,
        height,
        x,
        y,
        top: y,
        right: x + width,
        bottom: y + height,
        left: x,
      };
    },
  };
}

function isMouseBasedEvent(event: Event | undefined): event is MouseEvent {
  return event != null && (event as MouseEvent).clientX != null;
}

interface CursorOwner {
  readonly open: boolean;
  readonly positioner: HTMLElement | null;
  readonly anchor: Element | null;
  readonly context: Pick<PopupInteractionContext, 'openEvent'>;
  setAnchor(anchor: ReferenceType | null): void;
}

interface CursorOptions {
  /**
   * Whether the composable is enabled, including all its internal effects and event handlers.
   * @default true
   */
  enabled?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Whether to restrict the client point to an axis and use the reference
   * element (if it exists) as the other axis. This can be useful if the
   * floating element is also interactive.
   * @default 'both'
   */
  axis?: MaybeRefOrGetter<'x' | 'y' | 'both' | undefined>;
}

export function useTooltipCursor(owner: MaybeRefOrGetter<CursorOwner>, props: CursorOptions = {}) {
  const enabled = computed(() => toValue(props.enabled) ?? true);
  const axis = () => toValue(props.axis) ?? 'both';

  const open = computed(() => toValue(owner).open);
  const floating = computed(() => toValue(owner).positioner);
  const domReference = computed(() => toValue(owner).anchor);

  let disabledWhileOpen = false;
  // eslint-disable-next-line no-restricted-syntax -- The pointer listener removes itself. The handler must know whether it still exists.
  let stopListening: (() => void) | null = null;
  const pointerType = shallowRef<string | undefined>();
  const restartCount = shallowRef(0);

  function resetReference(reference: Element | null) {
    toValue(owner).setAnchor(reference);
  }

  function setReference(
    newX: number | null,
    newY: number | null,
    referenceElement?: Element | null,
  ) {
    if (disabledWhileOpen) {
      return;
    }

    const current = toValue(owner);
    const storeContext = current.context;

    // A popup that a non-mouse event opened, such as a focus, keeps the anchor of its trigger. The
    // pointer on the trigger then does not move it.
    if (storeContext.openEvent && !isMouseBasedEvent(storeContext.openEvent)) {
      return;
    }

    current.setAnchor(
      createVirtualElement(referenceElement ?? domReference.value, {
        x: newX,
        y: newY,
        axis: axis(),
        storeContext,
        pointerType: pointerType.value,
      }),
    );
  }

  function handleReferenceEnterOrMove(event: MouseEvent) {
    if (!enabled.value) {
      return;
    }

    if (!open.value) {
      setReference(event.clientX, event.clientY, event.currentTarget as Element);
    } else if (!stopListening) {
      // The window listener removes itself when the pointer lands on the popup. The pointer is on
      // the reference again, so the count adds the listener again.
      setReference(event.clientX, event.clientY, event.currentTarget as Element);
      restartCount.value += 1;
    }
  }

  // A mouse-like pointer moves the popup while the popup closes. A touch pointer stops at the
  // close, because the popup would move to the point of the tap that closes it.
  const openCheck = computed(() =>
    isMouseLikePointerType(pointerType.value) ? floating.value : open.value,
  );

  function removeWindowListener() {
    stopListening?.();
    stopListening = null;
  }

  function syncWindowListener() {
    const current = toValue(owner);

    if (!enabled.value) {
      resetReference(domReference.value);
      return;
    }

    if (!openCheck.value) {
      return;
    }

    const floatingElement = floating.value;
    const win = ownerWindow(floatingElement);

    function handleMouseMove(event: MouseEvent) {
      const target = getTarget(event) as Element | null;

      if (!contains(floatingElement, target)) {
        setReference(event.clientX, event.clientY);
      } else {
        removeWindowListener();
      }
    }

    if (!current.context.openEvent || isMouseBasedEvent(current.context.openEvent)) {
      stopListening = addEventListener(win, 'mousemove', handleMouseMove);
    } else {
      resetReference(domReference.value);
    }
  }

  useDomEffect(
    [openCheck, enabled, floating, domReference, () => toValue(owner), restartCount],
    () => {
      syncWindowListener();
      return removeWindowListener;
    },
  );
  onMounted(() => {
    watch(
      () => toValue(owner),
      (current, _previous, onCleanup) => {
        onCleanup(() => current.setAnchor(null));
      },
      { immediate: true, flush: 'post' },
    );
  });

  function syncDisabledWhileOpen() {
    if (enabled.value && !floating.value) {
      disabledWhileOpen = false;
    }

    if (!enabled.value && open.value) {
      disabledWhileOpen = true;
    }
  }
  watch([enabled, floating, open], syncDisabledWhileOpen, { immediate: true, flush: 'post' });

  function setPointerType(event: PointerEvent) {
    if (enabled.value) {
      pointerType.value = event.pointerType;
    }
  }

  return {
    onPointerdown: setPointerType,
    onPointerenter: setPointerType,
    onMousemove: handleReferenceEnterOrMove,
    onMouseenter: handleReferenceEnterOrMove,
  };
}

export interface TooltipRootState {}

export interface TooltipRootProps<Payload = unknown> {
  /**
   * Whether the tooltip is initially open.
   *
   * To render a controlled tooltip, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the tooltip is currently open.
   */
  open?: boolean | undefined;
  /**
   * Whether the tooltip contents can be hovered without closing the tooltip.
   * @default false
   */
  disableHoverablePopup?: boolean | undefined;
  /**
   * Determines which axis the tooltip should track the cursor on.
   * @default 'none'
   */
  trackCursorAxis?: 'none' | 'x' | 'y' | 'both' | undefined;
  /**
   * Whether the tooltip is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A handle to associate the tooltip with a trigger.
   * If specified, allows external triggers to control the tooltip's open state.
   * Can be created with the Tooltip.createHandle() method.
   */
  handle?: TooltipHandle<Payload> | undefined;
  /**
   * ID of the trigger that the tooltip is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled tooltip.
   * There's no need to specify this prop when the tooltip is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * ID of the trigger that the tooltip is associated with.
   * This is useful in conjunction with the `defaultOpen` prop to create an initially open tooltip.
   */
  defaultTriggerId?: string | null | undefined;
}

export interface TooltipRootActions {
  /** Ends the closing phase after an exit animation that code outside the library runs. */
  unmount: () => void;
  /** Closes the tooltip. */
  close: () => void;
}

export type TooltipRootChangeEventReason =
  | typeof REASONS.triggerHover
  | typeof REASONS.triggerFocus
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.disabled
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type TooltipRootChangeEventDetails =
  VaseUIChangeEventDetails<TooltipRootChangeEventReason> & {
    /** Prevents the popup from unmounting until the `unmount` action is called. */
    preventUnmountOnClose: () => void;
  };
</script>

<script setup lang="ts" generic="Payload = unknown">
import { provide } from 'vue';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { mergeProps } from '../../merge-props';
import {
  dismissPopupBindings,
  dismissTriggerBindings,
  useDismissLayer,
} from '../../utils/popups/interactions/useDismissLayer';
import { usePopupRoot, popupStoreSelectors } from '../../utils/popups/usePopupRoot';
import { TooltipStore, TooltipRootContext } from './TooltipRootContext';
import type { State as TooltipStoreState } from './TooltipRootContext';

const props = withDefaults(defineProps<TooltipRootProps<Payload>>(), {
  open: undefined,
  defaultOpen: false,
  disableHoverablePopup: false,
  trackCursorAxis: 'none',
  disabled: false,
  handle: undefined,
  triggerId: undefined,
  defaultTriggerId: null,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Tooltip.Root');
}

const emit = defineEmits<{
  /**
   * Event handler called when the tooltip is opened or closed.
   */
  openChange: [open: boolean, eventDetails: TooltipRootChangeEventDetails];
  /**
   * Event handler called after `openChange` with the new value, unless a listener cancels the
   * change. `v-model:open` uses it.
   */
  'update:open': [open: boolean];
  /**
   * Event handler called after any animations complete when the tooltip is opened or closed.
   */
  openChangeComplete: [open: boolean];
}>();

defineSlots<{
  /** The content of the tooltip. It gets the `payload` of the active trigger. */
  default(props: { payload: Payload | undefined }): unknown;
}>();

const owner = usePopupRoot(
  props,
  (initialState, defaultPopupId) =>
    new TooltipStore<Payload>(
      {
        ...initialState,
        disabled: props.disabled,
        trackCursorAxis: props.trackCursorAxis,
        disableHoverablePopup: props.disableHoverablePopup,
      },
      defaultPopupId,
    ),
  {
    name: 'Tooltip',
    closeOnActiveTriggerUnmount: true,
    disabled: () => props.disabled,
    handle: () => props.handle,
    onOpenChange(nextOpen, details) {
      emit('openChange', nextOpen, details);
      if (!details.isCanceled) {
        emit('update:open', nextOpen);
      }
    },
    onOpenChangeComplete(nextOpen) {
      emit('openChangeComplete', nextOpen);
    },
  },
);

const {
  store,
  open: isOpen,
  payload,
  triggerId: activeId,
  requestOpen,
  transitionStatus,
  actions,
} = owner;

watch(
  [() => props.disabled, () => props.trackCursorAxis, () => props.disableHoverablePopup],
  ([disabled, trackCursorAxis, disableHoverablePopup]) =>
    store.update({ disabled, trackCursorAxis, disableHoverablePopup }),
);

function closeWhileDisabled() {
  if (popupStoreSelectors.open(store.state) && props.disabled) {
    requestOpen(false, createChangeEventDetails(REASONS.disabled));
  }
}
onMounted(closeWhileDisabled);
watch([() => popupStoreSelectors.open(store.state), () => props.disabled], closeWhileDisabled);

// Animations are instant in two cases: an open in the instant phase of a delay group, where the
// tooltip of an adjacent trigger opens at once, and a close with the reason `none`, for example
// because another tooltip of the group opened. An exit for another reason keeps its animation.
// The watcher keeps the instant type that it replaces, and gives it back when neither case holds.
let previousInstantType: TooltipStoreState<Payload>['instantType'] | null = null;
watch(
  [
    transitionStatus,
    () => store.state.isInstantPhase,
    () => store.state.openChangeReason,
    () => store.state.instantType,
  ],
  ([status, isInstantPhase, lastOpenChangeReason, instantType]) => {
    if (
      (status === 'ending' && lastOpenChangeReason === REASONS.none) ||
      (status !== 'ending' && isInstantPhase)
    ) {
      if (instantType !== 'delay') {
        previousInstantType = instantType;
      }
      store.set('instantType', 'delay');
    } else if (previousInstantType !== null) {
      store.set('instantType', previousInstantType);
      previousInstantType = null;
    }
  },
);

watch([isOpen, activeId], ([openNow, triggerId]) => {
  if (openNow && triggerId == null) {
    store.set('payload', undefined);
  }
});

const dismiss = useDismissLayer(store, {
  enabled: () => !props.disabled,
  referencePress: () => store.state.closeOnClick,
});
const clientPoint = useTooltipCursor(
  {
    get open() {
      return popupStoreSelectors.open(store.state);
    },
    get positioner() {
      return popupStoreSelectors.positionerElement(store.state);
    },
    get anchor() {
      return store.state.anchorElement;
    },
    context: store.context,
    setAnchor: (anchorOverride) => store.update({ anchorOverride }),
  },
  {
    enabled: () => !props.disabled && props.trackCursorAxis !== 'none',
    axis: () => (props.trackCursorAxis === 'none' ? undefined : props.trackCursorAxis),
  },
);
const triggerProps = mergeProps(clientPoint, dismissTriggerBindings(dismiss));
owner.bindParts({ trigger: () => triggerProps, popup: () => dismissPopupBindings(dismiss) });

provide(TooltipRootContext, owner);

defineExpose(actions);
</script>

<template>
  <slot :payload="payload" />
</template>
