<script lang="ts">
import type { VaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { TooltipHandle } from '../store/TooltipHandle';

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
import { onMounted, provide, watch } from 'vue';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { mergeProps } from '../../merge-props';
import { useClientPoint } from '../../utils/popups/interactions/useClientPoint';
import { useDismiss } from '../../utils/popups/interactions/useDismiss';
import { usePopupRoot } from '../../utils/popups/popupRoot';
import { usePopupInteractionProps } from '../../utils/popups/popupStoreUtils';
import { TooltipStore } from '../store/TooltipStore';
import type { State as TooltipStoreState } from '../store/TooltipStore';
import { TooltipRootContext } from './TooltipRootContext';

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

const emit = defineEmits<{
  /**
   * Event handler called when the tooltip is opened or closed.
   */
  openChange: [open: boolean, eventDetails: TooltipRootChangeEventDetails];
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

const {
  store,
  open: isOpen,
  payload,
  transitionStatus,
  actions,
} = usePopupRoot(
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

watch(
  [() => props.disabled, () => props.trackCursorAxis, () => props.disableHoverablePopup],
  ([disabled, trackCursorAxis, disableHoverablePopup]) =>
    store.update({ disabled, trackCursorAxis, disableHoverablePopup }),
);

function closeWhileDisabled() {
  if (store.select('open') && props.disabled) {
    store.setOpen(false, createChangeEventDetails(REASONS.disabled));
  }
}
onMounted(closeWhileDisabled);
watch([() => store.select('open'), () => props.disabled], closeWhileDisabled);

// Animations are instant in two cases: an open in the instant phase of a delay group, where the
// tooltip of an adjacent trigger opens at once, and a close with the reason `none`, for example
// because another tooltip of the group opened. An exit for another reason keeps its animation.
// The watcher keeps the instant type that it replaces, and gives it back when neither case holds.
let previousInstantType: TooltipStoreState<Payload>['instantType'] | null = null;
watch(
  [
    transitionStatus,
    () => store.select('isInstantPhase'),
    () => store.select('lastOpenChangeReason'),
    () => store.select('instantType'),
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

watch([isOpen, () => store.select('activeTriggerId')], ([openNow, triggerId]) => {
  if (openNow && triggerId == null) {
    store.set('payload', undefined);
  }
});

const dismiss = useDismiss(store, {
  enabled: () => !props.disabled,
  referencePress: () => store.select('closeOnClick'),
});
const clientPoint = useClientPoint(store, {
  enabled: () => !props.disabled && props.trackCursorAxis !== 'none',
  axis: () => (props.trackCursorAxis === 'none' ? undefined : props.trackCursorAxis),
});
const triggerProps = mergeProps(clientPoint, dismiss.reference);
usePopupInteractionProps(store, () => ({
  activeTriggerProps: triggerProps,
  inactiveTriggerProps: triggerProps,
  popupProps: dismiss.floating,
}));

provide(TooltipRootContext, store);

defineExpose(actions);
</script>

<template>
  <slot :payload="payload" />
</template>
