<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import { isElement } from '@floating-ui/utils/dom';
import { getTarget } from '../../common/shadowDom';
import type {
  ComponentRenderFn,
  HTMLProps,
  VaseUIComponentProps,
  VaseUIEvent,
  WithVaseUIEvent,
} from '../../internals/types';
import type { TooltipHandle } from '../store/TooltipHandle';

const TOOLTIP_TRIGGER_IDENTIFIER = 'data-vase-ui-tooltip-trigger';

function getTargetElement(event: Event): Element | null {
  const target = getTarget(event);
  return isElement(target) ? target : null;
}

export interface TooltipTriggerState {
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
import { computed, onDeactivated, shallowRef } from 'vue';
import { closest, contains } from '../../common/shadowDom';
import { useTimeout } from '../../common/useTimeout';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { isMouseLikePointerType } from '../../utils/popups/event';
import { getHoverIntent } from '../../utils/popups/interactions/hoverIntent';
import { safePolygon } from '../../utils/popups/interactions/safePolygon';
import { useFocus } from '../../utils/popups/interactions/useFocus';
import { useHoverTriggerInteraction } from '../../utils/popups/interactions/useHoverTriggerInteraction';
import { triggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { useTriggerDataForwarding } from '../../utils/popups/popupStoreUtils';
import { usePopupHandleStore } from '../../utils/popups/usePopupHandleStore';
import { useTooltipRootContext } from '../root/TooltipRootContext';
import type { TooltipHandleStore } from '../store/TooltipStore';
import { OPEN_DELAY } from '../utils/constants';
import * as TooltipTriggerDataAttributes from './TooltipTriggerDataAttributes';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TooltipTriggerProps<Payload>>(), {
  as: 'button',
  closeOnClick: true,
  disabled: false,
  delay: undefined,
  closeDelay: undefined,
});

defineSlots<{
  default(props: { state: TooltipTriggerState }): unknown;
  render: ComponentRenderFn<HTMLProps, TooltipTriggerState>;
}>();

const rootStore = useTooltipRootContext(true);
const handleStore = usePopupHandleStore(() => props.handle);
if (rootStore === undefined && props.handle === undefined) {
  throw new Error(
    'Vase UI: <Tooltip.Trigger> must be inside <Tooltip.Root>, or it must have a `handle`. Without a root the trigger has no tooltip to open. Put the trigger inside <Tooltip.Root>, or pass a `handle`.',
  );
}
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The check above throws when the trigger has neither a root nor a handle.
const store = computed<TooltipHandleStore<any>>(() => handleStore.value ?? rootStore!);

const thisTriggerId = useVaseUiId(() => props.id);
const isTriggerActive = computed(() => store.value.select('isTriggerActive', thisTriggerId.value));
const isOpenedByThisTrigger = computed(() =>
  store.value.select('isOpenedByTrigger', thisTriggerId.value),
);

const triggerElement = shallowRef<Element | null>(null);

const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(
  thisTriggerId,
  store,
  () => ({
    payload: props.payload,
    closeOnClick: props.closeOnClick,
    closeDelay: props.closeDelay ?? 0,
  }),
);

const isDisabled = computed(() => props.disabled || store.value.select('disabled'));
const trackCursorAxis = computed(() => store.value.select('trackCursorAxis'));
const disableHoverablePopup = computed(() => store.value.select('disableHoverablePopup'));

let isNestedTriggerHovered = false;
const nestedTriggerOpenTimeout = useTimeout();
// A local copy, so the leave can clear it and keep the pointer type of the hover composable.
let pointerType: string | undefined;

function getOpenDelay() {
  return props.delay ?? OPEN_DELAY;
}

function isEnabledNestedTriggerTarget(target: Element | null) {
  const trigger = triggerElement.value;
  if (!trigger || !target) {
    return false;
  }

  const nearestTrigger = closest(target, `[${TOOLTIP_TRIGGER_IDENTIFIER}]`);
  return nearestTrigger !== null && nearestTrigger !== trigger && contains(trigger, nearestTrigger);
}

function detectNestedTriggerHover(target: Element | null) {
  const nestedTriggerHovered = isEnabledNestedTriggerTarget(target);

  isNestedTriggerHovered = nestedTriggerHovered;
  if (nestedTriggerHovered) {
    getHoverIntent(store.value).cancelPendingOpen();
    nestedTriggerOpenTimeout.clear();
  }
  return nestedTriggerHovered;
}

const hoverablePopupClose = safePolygon();

const hoverProps = useHoverTriggerInteraction(store, {
  enabled: () => !isDisabled.value,
  mouseOnly: true,
  move: false,
  handleClose: () =>
    !disableHoverablePopup.value && trackCursorAxis.value !== 'both' ? hoverablePopupClose : null,
  restMs: getOpenDelay,
  delay: () => ({ close: props.closeDelay ?? 0 }),
  triggerElement,
  isActiveTrigger: isTriggerActive,
  shouldOpen: () => !isNestedTriggerHovered,
});

const focusProps = useFocus(store, { enabled: () => !isDisabled.value });

function handleNestedTriggerHover(event: MouseEvent) {
  const currentStore = store.value;
  const wasNestedTriggerHovered = isNestedTriggerHovered;
  const target = getTargetElement(event);
  const nestedTriggerHovered = detectNestedTriggerHover(target);
  const trigger = triggerElement.value;
  const targetInsideTrigger = trigger && target && contains(trigger, target);

  // Close only a tooltip that hover opened. A tooltip that another interaction opened stays open.
  if (
    nestedTriggerHovered &&
    currentStore.select('open') &&
    currentStore.select('lastOpenChangeReason') === REASONS.triggerHover
  ) {
    currentStore.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
    return;
  }

  if (
    wasNestedTriggerHovered &&
    !nestedTriggerHovered &&
    targetInsideTrigger &&
    !isDisabled.value &&
    !currentStore.select('open') &&
    // The hover composable also accepts an empty pointer type for a sequence of mouse events.
    isMouseLikePointerType(pointerType)
  ) {
    const open = () => {
      if (!isNestedTriggerHovered && !isDisabled.value && !store.value.select('open')) {
        store.value.setOpen(
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
  store.value.select(
    'appliedTriggerProps',
    isMountedByThisTrigger.value || trackCursorAxis.value !== 'none',
  ),
);

function preventNestedTriggerFocus(event: FocusEvent) {
  if (isEnabledNestedTriggerTarget(getTargetElement(event))) {
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
onDeactivated(resetNestedTriggerHover);

function setPointerType(event: PointerEvent) {
  pointerType = event.pointerType;
}

function cancelPendingOpen(event: MouseEvent | PointerEvent) {
  if (props.closeOnClick && !store.value.select('open')) {
    store.value.cancelPendingOpen(event);
  }
}

function handlePointerdown(event: PointerEvent) {
  pointerType = event.pointerType;
  // A press of a trigger that is not active reaches the dismissal of the root while the tooltip
  // follows the cursor. The dismissal then reads `closeOnClick` of this trigger.
  store.value.set('closeOnClick', props.closeOnClick);
  cancelPendingOpen(event);
}

const state = computed<TooltipTriggerState>(() => ({ open: isOpenedByThisTrigger.value }));

const { element, elementProps } = useRenderElement('button', props, {
  state,
  ref: [
    registerTrigger,
    (trigger) => {
      triggerElement.value = trigger;
    },
  ],
  stateAttributesMapping: triggerOpenStateMapping,
  props: (attrs) => [
    hoverProps,
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

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
