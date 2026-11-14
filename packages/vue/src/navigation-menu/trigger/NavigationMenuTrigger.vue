<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { HandleCloseContextBase } from '../../utils/popups/interactions/useHoverShared';

export interface NavigationMenuTriggerState {
  /**
   * If `true`, the popup is open and the item is active.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface NavigationMenuTriggerProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<NavigationMenuTriggerState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled'> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

function getPlacementFromElements(
  anchorElement: Element,
  positionerElement: HTMLElement,
): HandleCloseContextBase['placement'] {
  const referenceRect = anchorElement.getBoundingClientRect();
  const floatingRect = positionerElement.getBoundingClientRect();
  const referenceCenterX = referenceRect.left + referenceRect.width / 2;
  const referenceCenterY = referenceRect.top + referenceRect.height / 2;
  const floatingCenterX = floatingRect.left + floatingRect.width / 2;
  const floatingCenterY = floatingRect.top + floatingRect.height / 2;
  const deltaX = floatingCenterX - referenceCenterX;
  const deltaY = floatingCenterY - referenceCenterY;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? 'right' : 'left';
  }

  return deltaY >= 0 ? 'bottom' : 'top';
}

function getHandleCloseContext(
  anchorElement: Element,
  positionerElement: HTMLElement,
  nodeId: string | undefined,
): HandleCloseContextBase {
  return {
    placement: getPlacementFromElements(anchorElement, positionerElement),
    elements: {
      domReference: anchorElement,
      floating: positionerElement,
    },
    nodeId,
  };
}

// The listeners of the hover interaction read `currentTarget`, and an event that no one
// dispatched has none.
function createHoverEvent(type: 'mouseenter' | 'mousemove', currentTarget: HTMLElement) {
  const event = new MouseEvent(type);
  Object.defineProperty(event, 'currentTarget', { value: currentTarget });
  return event;
}
</script>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  shallowRef,
  watch,
} from 'vue';
import { closest, contains } from '../../common/shadowDom';
import { useTimeout } from '../../common/useTimeout';
import { useCompositeItem } from '../../internals/composite/item/useCompositeItem';
import { ownerVisuallyHidden, PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useRenderElement } from '../../internals/useRenderElement';
import { stopEvent } from '../../utils/popups/event';
import { useFloatingRootStore } from '../../utils/popups/floating-root/useFloatingRootStore';
import FocusGuard from '../../utils/popups/focus/FocusGuard.vue';
import {
  getNextTabbable,
  getPreviousTabbable,
  getTabbableNearElement,
  isOutsideEvent,
} from '../../utils/popups/focus/tabbable';
import { getHoverIntent } from '../../utils/popups/interactions/hoverIntent';
import { safePolygon } from '../../utils/popups/interactions/safePolygon';
import { useClick } from '../../utils/popups/interactions/useClick';
import { useHoverTriggerInteraction } from '../../utils/popups/interactions/useHoverTriggerInteraction';
import { pressableTriggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { useFloatingTree } from '../../utils/popups/tree/FloatingTree';
import { useNavigationMenuItemContext } from '../item/NavigationMenuItemContext';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import type { NavigationMenuRootChangeEventDetails } from '../root/NavigationMenuRoot.vue';
import { NAVIGATION_MENU_TRIGGER_IDENTIFIER } from '../utils/constants';
import { createElementSetter } from '../utils/createElementSetter';
import { isOutsideMenuEvent } from '../utils/isOutsideMenuEvent';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavigationMenuTriggerProps>(), {
  as: 'button',
  nativeButton: true,
  disabled: false,
});

defineSlots<{
  default(props: { state: NavigationMenuTriggerState }): unknown;
  render: ComponentRenderFn<HTMLProps, NavigationMenuTriggerState>;
}>();

const {
  value,
  setValue,
  mounted,
  open,
  positionerElement,
  setActivationDirection,
  setFloatingRootStore,
  popupElement,
  viewportElement,
  rootRef,
  beforeOutsideRef,
  afterOutsideRef,
  afterInsideRef,
  beforeInsideRef,
  prevTriggerElementRef,
  delay,
  closeDelay,
  orientation,
  setViewportInert,
  nested,
} = useNavigationMenuRootContext();
const { value: itemValue } = useNavigationMenuItemContext();
const nodeId = useNavigationMenuTreeContext();
const tree = useFloatingTree();
const direction = useDirection();

const stickIfOpenTimeout = useTimeout();

const triggerElement = shallowRef<HTMLElement | null>(null);
const stickIfOpen = shallowRef(true);
const pointerType = shallowRef('');

const isActiveItem = computed(() => open.value && value.value === itemValue.value);
const interactionsEnabled = computed(
  () => (positionerElement.value != null || value.value == null) && !props.disabled,
);
const hoverPopupElement = computed(() => positionerElement.value || viewportElement.value);
const hoverInteractionsEnabled = computed(
  () => (hoverPopupElement.value != null || value.value == null) && !props.disabled,
);
const shouldBlockSafePolygonPointerEvents = computed(() => pointerType.value !== 'touch');

// A handler of Base UI reads the state of the last render, also after an earlier handler of the
// same event wrote the value. A direct read of the ref gives the new value. A `watch` with the
// default flush writes these variables.
let renderedMounted = mounted.value;
let renderedIsActiveItem = isActiveItem.value;
watch([mounted, isActiveItem], ([isMounted, isActive]) => {
  renderedMounted = isMounted;
  renderedIsActiveItem = isActive;
});

function handleOpenChange(
  nextOpen: boolean,
  eventDetails: Omit<NavigationMenuRootChangeEventDetails, 'preventUnmountOnClose'>,
) {
  const isHover = eventDetails.reason === REASONS.triggerHover;

  if (!interactionsEnabled.value) {
    return;
  }

  if (pointerType.value === 'touch' && isHover) {
    return;
  }

  if (!nextOpen && value.value !== itemValue.value) {
    return;
  }

  if (isHover) {
    // Only a patient click closes a popup that hover opened. A click within the threshold keeps it
    // open.
    stickIfOpen.value = true;
    stickIfOpenTimeout.start(PATIENT_CLICK_THRESHOLD, () => {
      stickIfOpen.value = false;
    });
  }

  if (nextOpen) {
    setValue(itemValue.value, eventDetails);
  } else {
    setValue(null, eventDetails);
    pointerType.value = '';
  }
}

const floatingRootStore = useFloatingRootStore({
  open,
  onOpenChange: handleOpenChange,
  elements: {
    anchor: triggerElement,
    positionerElement: hoverPopupElement,
  },
});

const hoverIntent = () => getHoverIntent(floatingRootStore);

function restoreOutsidePointerEvents() {
  hoverIntent().restoreOutsidePointerEvents();
}

// A change of `open` and the unmount release the pointer events that the safe polygon blocked. A
// server render calls no `onBeforeUnmount` hook, so a server makes no hover intent.
watch(open, (isOpen) => {
  restoreOutsidePointerEvents();
  if (!isOpen) {
    stickIfOpenTimeout.clear();
    pointerType.value = '';
    floatingRootStore.context.openEvent = undefined;
    hoverIntent().reset();
    hoverIntent().cancelPendingOpen();
  }
});
onBeforeUnmount(restoreOutsidePointerEvents);

function getScope() {
  if (nested && positionerElement.value) {
    return null;
  }

  return closest(triggerElement.value, 'ul');
}

function getInlineHandleCloseContext() {
  const trigger = triggerElement.value;
  const popup = hoverPopupElement.value;
  if (!nested || positionerElement.value || !trigger || !popup) {
    return null;
  }

  return getHandleCloseContext(trigger, popup, nodeId);
}

const handleClose = computed(() =>
  safePolygon({ blockPointerEvents: shouldBlockSafePolygonPointerEvents.value, getScope }),
);

const hoverProps = useHoverTriggerInteraction(floatingRootStore, {
  enabled: hoverInteractionsEnabled,
  move: false,
  handleClose,
  restMs: () => (mounted.value && positionerElement.value ? 0 : delay.value),
  delay: () => ({ close: closeDelay.value }),
  triggerElement,
  getHandleCloseContext: getInlineHandleCloseContext,
});

// The handler of `useClick` runs after the handler of this part, which can already have changed the
// item. A press of another trigger would close the menu if `toggle` read the new item.
const click = useClick(floatingRootStore, {
  enabled: interactionsEnabled,
  stickIfOpen,
  toggle: () => renderedIsActiveItem,
});

watch(
  [isActiveItem, triggerElement],
  () => {
    if (isActiveItem.value) {
      setFloatingRootStore(floatingRootStore);
      prevTriggerElementRef.value = triggerElement.value;
    }
  },
  { immediate: true },
);

function handleActivation(event: MouseEvent | KeyboardEvent) {
  const currentTarget = event.currentTarget as HTMLElement;
  const previousValue = value.value;
  const prevTriggerRect = prevTriggerElementRef.value?.getBoundingClientRect();
  const trigger = triggerElement.value;

  if (renderedMounted && prevTriggerRect && trigger) {
    const nextTriggerRect = trigger.getBoundingClientRect();
    const isMovingRight = nextTriggerRect.left > prevTriggerRect.left;
    const isMovingDown = nextTriggerRect.top > prevTriggerRect.top;

    if (orientation.value === 'horizontal' && nextTriggerRect.left !== prevTriggerRect.left) {
      setActivationDirection(isMovingRight ? 'right' : 'left');
    } else if (orientation.value === 'vertical' && nextTriggerRect.top !== prevTriggerRect.top) {
      setActivationDirection(isMovingDown ? 'down' : 'up');
    }
  }

  // The open event is reset when the active item changes. Without it, a click, a hover of a new
  // trigger and a hover back to the old trigger leave the popup stuck open when the pointer leaves
  // the old trigger.
  if (event.type !== 'click' && previousValue != null) {
    floatingRootStore.context.openEvent = undefined;
  }

  if (pointerType.value === 'touch' && event.type !== 'click') {
    return;
  }

  // A keyboard open event reaches this path after `onKeydown` has already set the value with the
  // reason `list-navigation`.
  if (previousValue != null && event.type !== 'keydown') {
    setValue(
      itemValue.value,
      createChangeEventDetails(
        event.type === 'mouseenter' ? REASONS.triggerHover : REASONS.triggerPress,
        event,
      ),
    );
  }

  const popup = hoverPopupElement.value;
  if (
    event.type === 'mouseenter' &&
    shouldBlockSafePolygonPointerEvents.value &&
    (!nested || !positionerElement.value) &&
    popup
  ) {
    const applyPointerEventsMutation = () => {
      const scopeElement = getScope() ?? currentTarget.ownerDocument.body;

      hoverIntent().blockOutsidePointerEvents({
        scopeElement,
        triggerElement: currentTarget,
        positionerElement: popup,
      });
    };

    if (previousValue != null && previousValue !== itemValue.value) {
      queueMicrotask(applyPointerEventsMutation);
    } else {
      applyPointerEventsMutation();
    }
  }
}

function handleOpenEvent(event: MouseEvent | KeyboardEvent) {
  if (props.disabled) {
    return;
  }

  handleActivation(event);
}

function handleSetPointerType(event: PointerEvent) {
  pointerType.value = event.pointerType;
}

function handleTriggerPointerDown(event: PointerEvent) {
  handleSetPointerType(event);
  restoreOutsidePointerEvents();
}

function handleKeydown(event: KeyboardEvent) {
  // The parent content handles the arrow keys of a nested trigger, to move between its items.
  if (nested) {
    return;
  }

  const verticalOpenKey = direction.value === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
  const openHorizontal = orientation.value === 'horizontal' && event.key === 'ArrowDown';
  const openVertical = orientation.value === 'vertical' && event.key === verticalOpenKey;

  if (openHorizontal || openVertical) {
    setValue(itemValue.value, createChangeEventDetails(REASONS.listNavigation, event));
    handleOpenEvent(event);
    stopEvent(event);
  }
}

function handleFocusout(event: FocusEvent) {
  if (
    positionerElement.value &&
    popupElement.value &&
    isOutsideMenuEvent(
      {
        currentTarget: event.currentTarget as HTMLElement | null,
        relatedTarget: event.relatedTarget as HTMLElement | null,
      },
      {
        popupElement: popupElement.value,
        rootElement: rootRef.value,
        tree: tree.value,
        nodeId,
      },
    )
  ) {
    setValue(null, createChangeEventDetails(REASONS.focusOut, event));
  }
}

const state = computed<NavigationMenuTriggerState>(() => ({
  open: isActiveItem.value,
  disabled: props.disabled,
}));

const { getButtonProps, buttonRef } = useButton({
  disabled: () => props.disabled,
  focusableWhenDisabled: true,
  native: () => props.nativeButton,
});
const { compositeProps, compositeRef } = useCompositeItem();

const { element, elementProps } = useRenderElement('button', props, {
  state,
  stateAttributesMapping: pressableTriggerOpenStateMapping,
  ref: [
    compositeRef,
    (trigger) => {
      triggerElement.value = trigger;
    },
    buttonRef,
  ],
  props: (attrs) => [
    compositeProps.value,
    click.reference,
    hoverProps,
    {
      // The key wins over the roving `tabindex` of the composite, so each trigger is a tab stop.
      tabindex: 0,
      onMouseenter: handleOpenEvent,
      onClick: handleOpenEvent,
      onPointerenter: handleSetPointerType,
      onPointerdown: handleTriggerPointerDown,
      'aria-expanded': isActiveItem.value,
      'aria-controls': isActiveItem.value ? popupElement.value?.id : undefined,
      [NAVIGATION_MENU_TRIGGER_IDENTIFIER]: '',
      onFocusin() {
        if (isActiveItem.value) {
          setViewportInert(false);
        }
      },
      onMouseleave() {
        if (value.value == null) {
          restoreOutsidePointerEvents();
        }
      },
      onKeydown: handleKeydown,
      onFocusout: handleFocusout,
    },
    attrs,
    getButtonProps,
  ],
});

// The browser sends no enter event for a pointer that is already over the trigger when the
// hydration ends or when `KeepAlive` brings the trigger back. The hover interaction needs the
// enter, and then a move that starts its rest timer.
function openHoveredTrigger() {
  const trigger = triggerElement.value;
  if (!trigger?.matches(':hover') || !hoverInteractionsEnabled.value || value.value != null) {
    return;
  }

  hoverProps.onMouseenter?.(createHoverEvent('mouseenter', trigger));
  hoverProps.onMousemove?.(createHoverEvent('mousemove', trigger));
}

let isDeactivated = false;

onMounted(openHoveredTrigger);

onDeactivated(() => {
  isDeactivated = true;
  stickIfOpenTimeout.clear();
  restoreOutsidePointerEvents();
});

onActivated(() => {
  // `onActivated` also runs at the first mount inside `KeepAlive`.
  if (!isDeactivated) {
    return;
  }

  isDeactivated = false;
  openHoveredTrigger();
});

const setBeforeOutsideGuard = createElementSetter(beforeOutsideRef);
const setAfterOutsideGuard = createElementSetter(afterOutsideRef);

function handleBeforeOutsideFocusin(event: FocusEvent) {
  const referenceElement = hoverPopupElement.value;

  if (referenceElement && isOutsideEvent(event, referenceElement)) {
    beforeInsideRef.value?.focus();
  } else {
    getPreviousTabbable(triggerElement.value)?.focus();
  }
}

async function handleAfterOutsideFocusin(event: FocusEvent) {
  const referenceElement = hoverPopupElement.value;

  if (referenceElement && isOutsideEvent(event, referenceElement)) {
    // The viewport has `inert` while the focus is out of it, and a browser cannot focus an element
    // that is inert.
    setViewportInert(false);
    await nextTick();
    (afterInsideRef.value || triggerElement.value)?.focus();
    return;
  }

  let nextTabbable = getNextTabbable(triggerElement.value);

  if (
    nested &&
    !positionerElement.value &&
    referenceElement &&
    nextTabbable &&
    contains(referenceElement, nextTabbable)
  ) {
    nextTabbable = getTabbableNearElement(afterInsideRef.value, 1);
  }

  nextTabbable?.focus();

  if ((!nested || positionerElement.value) && !contains(rootRef.value, nextTabbable)) {
    setValue(null, createChangeEventDetails(REASONS.focusOut, event));
  }
}

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
  <template v-if="isActiveItem">
    <FocusGuard :ref="setBeforeOutsideGuard" @focusin="handleBeforeOutsideFocusin" />
    <span :aria-owns="viewportElement?.id" :style="ownerVisuallyHidden" />
    <FocusGuard :ref="setAfterOutsideGuard" @focusin="handleAfterOutsideFocusin" />
  </template>
</template>
