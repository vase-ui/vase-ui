<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  ComponentRenderFn,
  HTMLProps,
  VaseUIComponentProps,
  VaseUIEvent,
  WithVaseUIEvent,
} from '../../internals/types';
import type { TooltipHandle } from '../store/TooltipHandle';

const TOOLTIP_TRIGGER_IDENTIFIER = 'data-vase-ui-tooltip-trigger';

export interface TooltipTriggerState {
  /**
   * Whether a fieldset disables the native button.
   */
  disabled: boolean;
  /**
   * Whether the tooltip is currently open and was opened by this trigger.
   */
  open: boolean;
}

export interface TooltipTriggerProps<Payload = unknown>
  extends
    VaseUIComponentProps<TooltipTriggerState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<ButtonHTMLAttributes, 'id' | 'disabled'>> {
  /**
   * A handle to associate the trigger with a tooltip.
   */
  handle?: TooltipHandle<Payload> | undefined;
  /**
   * A payload to pass to the tooltip when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * How long to wait before opening the tooltip on hover. Specified in milliseconds.
   * @default 600
   */
  delay?: number | undefined;
  /**
   * Whether the tooltip should close when this trigger is clicked.
   * @default true
   */
  closeOnClick?: boolean | undefined;
  /**
   * How long to wait before closing the tooltip. Specified in milliseconds.
   * @default 0
   */
  closeDelay?: number | undefined;
  /**
   * If `true`, the tooltip will not open when interacting with this trigger.
   * Note that this doesn't apply the `disabled` attribute to the trigger element.
   * If you want to disable the trigger element itself, you can pass the `disabled` prop to the
   * trigger element with the `#render` slot.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The id of the trigger. `triggerId` of the root and `open()` of a handle name a trigger by it.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts" generic="Payload = unknown">
import { tooltipTriggers } from '../../utils/popups/registeredParts';
import { useElementRegistration } from '../../internals/useElementRegistration';
import { computed, onMounted, useSlots, watch } from 'vue';
import { closestInEventPath } from '../../common/shadowDom';
import { useTimeout } from '../../common/useTimeout';
import { useFieldsetDisabled } from '../../fieldset/root/useFieldsetDisabled';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { useRenderElement } from '../../internals/useRenderElement';
import {
  useDelayGroup,
  useTooltipProviderContext,
  OPEN_DELAY,
  useTooltipRootContext,
} from '../root/TooltipRootContext';
import { isMouseLikePointerType } from '../../utils/popups/event';
import { getHoverIntent } from '../../utils/popups/interactions/hoverIntent';
import { safePolygon } from '../../utils/popups/interactions/safePolygon';
import { usePopupTrigger, useTriggerOwner } from '../../utils/popups/usePopupTrigger';
import { useHoverPointerStyle } from '../../utils/popups/interactions/hoverPointerEvents';
import { useHoverTriggerInteraction } from '../../utils/popups/interactions/useHoverTriggerInteraction';
import { getDelay } from '../../utils/popups/interactions/useHoverShared';
import { triggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { triggerBindings } from '../../utils/popups/popupBindings';
import type { TooltipHandleStore } from '../root/TooltipRootContext';
import * as TooltipTriggerDataAttributes from './TooltipTriggerDataAttributes';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TooltipTriggerProps<Payload>>(), {
  as: 'button',
  closeOnClick: true,
  disabled: false,
  delay: undefined,
  closeDelay: undefined,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Tooltip.Trigger');
}

defineSlots<{
  default(props: { state: TooltipTriggerState }): unknown;
  render: ComponentRenderFn<HTMLProps, TooltipTriggerState>;
}>();

const store = useTriggerOwner<TooltipHandleStore<unknown>>(
  useTooltipRootContext(true)?.store,
  () => props.handle,
  'Vase UI: <Tooltip.Trigger> must be inside <Tooltip.Root>, or it must have a `handle`. Without a root the trigger has no tooltip to open. Put the trigger inside <Tooltip.Root>, or pass a `handle`.',
);
const thisTriggerId = useVaseUiId(() => props.id);
const {
  element: triggerElement,
  registerTrigger,
  useFocus,
  isMountedByThisTrigger,
  isTriggerActive,
  isOpenedByThisTrigger,
  open: popupOpen,
  requestOpen,
} = usePopupTrigger(thisTriggerId, store, () => ({
  payload: props.payload,
  closeOnClick: props.closeOnClick,
  closeDelay: props.closeDelay ?? 0,
}));

const providerDelay = useTooltipProviderContext();
const delayGroup = useDelayGroup({
  open: isOpenedByThisTrigger,
  popupId: () => store.value.state.defaultPopupId,
  popupOpen: () => popupOpen.value,
  closeForSibling: () => store.value.closeForSibling(),
});
function writeIsInstantPhase() {
  store.value.update({ isInstantPhase: delayGroup.isInstantPhase.value });
}
// A new trigger clears the instant phase left by a trigger that unmounted.
onMounted(writeIsInstantPhase);
watch([store, delayGroup.isInstantPhase], writeIsInstantPhase);

const fieldsetDisabled = useFieldsetDisabled(triggerElement);
const slots = useSlots();
// The part has no element in a server render and in the first client render. The default tag
// then gives the answer, so the server HTML follows `Fieldset.Root`.
const isNativeButton = computed(() =>
  triggerElement.value
    ? triggerElement.value.tagName === 'BUTTON'
    : props.as === 'button' && !slots.render,
);
const isButtonDisabled = computed(() => isNativeButton.value && fieldsetDisabled.value);
const isDisabled = computed(
  () => props.disabled || store.value.state.disabled || isButtonDisabled.value,
);
const trackCursorAxis = computed(() => store.value.state.trackCursorAxis);
const disableHoverablePopup = computed(() => store.value.state.disableHoverablePopup);

let isNestedTriggerHovered = false;
const nestedTriggerOpenTimeout = useTimeout();
// A local copy, so the leave can clear it and keep the pointer type of the hover composable.
let pointerType: string | undefined;

function getOpenDelay() {
  // Adjacent tooltips open instantly while the group is active.
  if (delayGroup.hasProvider && delayGroup.activeId() != null) {
    return 0;
  }
  return props.delay ?? providerDelay?.value ?? OPEN_DELAY;
}

function isEnabledNestedTriggerTarget(event: MouseEvent | FocusEvent) {
  const trigger = triggerElement.value;
  const nearest = closestInEventPath(
    event,
    (node) => node === trigger || tooltipTriggers.get(node)?.() === false,
  );
  return trigger !== null && nearest !== null && nearest !== trigger;
}

function detectNestedTriggerHover(event: MouseEvent) {
  const nestedTriggerHovered = isEnabledNestedTriggerTarget(event);

  isNestedTriggerHovered = nestedTriggerHovered;
  if (nestedTriggerHovered) {
    getHoverIntent(store.value).cancelPendingOpen();
    nestedTriggerOpenTimeout.clear();
  }
  return nestedTriggerHovered;
}

const hoverablePopupClose = safePolygon();

const hoverStyle = useHoverPointerStyle(triggerElement);
const hoverProps = useHoverTriggerInteraction(store, {
  enabled: () => !isDisabled.value,
  mouseOnly: true,
  move: false,
  handleClose: () =>
    !disableHoverablePopup.value && trackCursorAxis.value !== 'both' ? hoverablePopupClose : null,
  restMs: getOpenDelay,
  delay: () => {
    if (props.closeDelay == null && delayGroup.hasProvider) {
      return { close: getDelay(delayGroup.delay(), 'close') };
    }
    return { close: props.closeDelay ?? 0 };
  },
  triggerElement,
  isActiveTrigger: isTriggerActive,
  shouldOpen: () => !isNestedTriggerHovered,
});

const focusProps = useFocus({ enabled: () => !isDisabled.value });

function handleNestedTriggerHover(event: MouseEvent) {
  const currentStore = store.value;
  const wasNestedTriggerHovered = isNestedTriggerHovered;
  const nestedTriggerHovered = detectNestedTriggerHover(event);
  const trigger = triggerElement.value;

  // Close only a tooltip that hover opened. A tooltip that another interaction opened stays open.
  if (
    nestedTriggerHovered &&
    popupOpen.value &&
    currentStore.state.openChangeReason === REASONS.triggerHover
  ) {
    requestOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
    return;
  }

  if (
    wasNestedTriggerHovered &&
    !nestedTriggerHovered &&
    trigger &&
    closestInEventPath(event, (node) => node === trigger) &&
    !isDisabled.value &&
    !popupOpen.value &&
    // The hover composable also accepts an empty pointer type for a sequence of mouse events.
    isMouseLikePointerType(pointerType)
  ) {
    const open = () => {
      if (!isNestedTriggerHovered && !isDisabled.value && !popupOpen.value) {
        requestOpen(
          true,
          createChangeEventDetails(REASONS.triggerHover, event, trigger ?? undefined),
        );
      }
    };

    const openDelay = getOpenDelay();

    // With `move: false`, the hover composable listens only to the enter and the leave of this
    // trigger. A move from a nested trigger to the area of this trigger sends neither event, so
    // this trigger opens the tooltip itself.
    if (openDelay === 0) {
      nestedTriggerOpenTimeout.clear();
      open();
    } else {
      nestedTriggerOpenTimeout.start(openDelay, open);
    }
  }
}

const rootTriggerProps = computed(() =>
  isMountedByThisTrigger.value || trackCursorAxis.value !== 'none'
    ? triggerBindings(store.value, true)
    : undefined,
);

function preventNestedTriggerFocus(event: FocusEvent) {
  if (isEnabledNestedTriggerTarget(event)) {
    (event as VaseUIEvent<FocusEvent>).preventVaseUIHandler();
  }
}

function resetNestedTriggerHover() {
  isNestedTriggerHovered = false;
  nestedTriggerOpenTimeout.clear();
  pointerType = undefined;
}

// `KeepAlive` sends no leave event. A reopen that waits would then open the tooltip of a trigger
// that is not in the document.
const { isHeld } = useKeepAliveState();
watch(
  isHeld,
  (held) => {
    if (held) {
      resetNestedTriggerHover();
    }
  },
  { flush: 'sync' },
);

function setPointerType(event: PointerEvent) {
  pointerType = event.pointerType;
}

function cancelPendingOpen(event: MouseEvent | PointerEvent) {
  if (props.closeOnClick && !popupOpen.value) {
    store.value.cancelPendingOpen(event);
  }
}

function handlePointerdown(event: PointerEvent) {
  pointerType = event.pointerType;
  // A press of a trigger that is not active reaches the dismissal of the root while the tooltip
  // follows the cursor. The dismissal then reads `closeOnClick` of this trigger.
  store.value.update({ closeOnClick: props.closeOnClick });
  cancelPendingOpen(event);
}

const state = computed<TooltipTriggerState>(() => ({
  open: isOpenedByThisTrigger.value,
  disabled: isButtonDisabled.value,
}));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('button', props, {
  state,
  ref: registerTrigger,
  stateAttributesMapping: triggerOpenStateMapping,
  props: (attrs) => [
    hoverProps,
    { style: hoverStyle.value },
    focusProps,
    rootTriggerProps.value,
    {
      onMouseover: handleNestedTriggerHover,
      onFocusin: preventNestedTriggerFocus,
      onMouseleave: resetNestedTriggerHover,
      onPointerenter: setPointerType,
      onPointerdown: handlePointerdown,
      onClick: cancelPendingOpen,
      id: thisTriggerId.value,
      [TooltipTriggerDataAttributes.triggerDisabled]: isDisabled.value ? '' : undefined,
      [TOOLTIP_TRIGGER_IDENTIFIER]: isDisabled.value ? undefined : '',
    },
    attrs,
  ],
});

useElementRegistration(tooltipTriggers, element, () => isDisabled.value);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
