<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { HandleCloseContextBase } from '../../utils/popups/interactions/usePopupHover';

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
import { useElementRegistration } from '../../internals/useElementRegistration';
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onScopeDispose,
  shallowRef,
  watch,
  type ShallowRef,
} from 'vue';
import { closest, contains } from '../../common/shadowDom';
import { useTimeout } from '../../common/useTimeout';
import { useFieldsetDisabled } from '../../fieldset/root/useFieldsetDisabled';
import { useCompositeItem } from '../../internals/composite/root/useCompositeRoot';
import { ownerVisuallyHidden, PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button/useButton';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { stopEvent } from '../../utils/popups/event';
import { useFloatingRootStore } from '../../utils/popups/floating-root/useFloatingRootStore';
import { createFocusGuardElement } from '../../utils/popups/focus/createFocusGuardElement';
import {
  getNextTabbable,
  getPreviousTabbable,
  getTabbableNearElement,
  isOutsideEvent,
} from '../../utils/popups/focus/tabbable';
import type { FocusableElement } from '../../utils/popups/focus/tabbable';
import { useElementSiblings } from '../../utils/popups/focus/useElementSiblings';
import type { ElementSiblings } from '../../utils/popups/focus/useElementSiblings';
import { usePopupHover, useHoverPointerStyle } from '../../utils/popups/interactions/usePopupHover';
import { useTriggerPress } from '../../utils/popups/usePopupTrigger';
import { pressableTriggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { useFloatingTree } from '../../utils/popups/tree/FloatingTree';
import { useNavigationMenuItemContext } from '../item/NavigationMenuItemContext';
import { useNavigationMenuDismissContext } from '../list/NavigationMenuDismissContext';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import type { NavigationMenuRootChangeEventDetails } from '../root/NavigationMenuRoot.vue';
import { navigationTriggers, NAVIGATION_MENU_TRIGGER_IDENTIFIER } from '../utils/constants';
import { isOutsideMenuEvent } from '../utils/isOutsideMenuEvent';
import { useNavigationMenuPopupSize } from './useNavigationMenuPopupSize';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavigationMenuTriggerProps>(), {
  as: 'button',
  nativeButton: true,
  disabled: false,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('NavigationMenu.Trigger');
}

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
  popupElementId,
  viewportElement,
  viewportElementId,
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
const dismissProps = useNavigationMenuDismissContext();
const direction = useDirection();

const stickIfOpenTimeout = useTimeout();

const triggerId = useVaseUiId();
const triggerElement: ShallowRef<HTMLElement | null> = shallowRef(null);
const stickIfOpen = shallowRef(true);
const pointerType = shallowRef('');
const fieldsetDisabled = useFieldsetDisabled(() => element.value);
const isDisabled = computed(() => props.disabled || (props.nativeButton && fieldsetDisabled.value));

const isActiveItem = computed(() => open.value && value.value === itemValue.value);
const interactionsEnabled = computed(
  () => (positionerElement.value != null || value.value == null) && !isDisabled.value,
);
const hoverPopupElement = computed(() => positionerElement.value || viewportElement.value);
const hoverInteractionsEnabled = computed(
  () => (hoverPopupElement.value != null || value.value == null) && !isDisabled.value,
);
const shouldBlockSafePolygonPointerEvents = computed(() => pointerType.value !== 'touch');

// A handler of Base UI reads the state of the last render, also after an earlier handler of the
// same event wrote the value. A direct read of the ref gives the new value. A `watch` with the
// default flush writes these variables.
let renderedMounted = mounted.value;
let renderedIsActiveItem = isActiveItem.value;
let renderedValue = value.value;
watch([mounted, isActiveItem, value], ([isMounted, isActive, currentValue]) => {
  renderedMounted = isMounted;
  renderedIsActiveItem = isActive;
  renderedValue = currentValue;
});

const { isHeld } = useKeepAliveState();
useNavigationMenuPopupSize(computed(() => isActiveItem.value && !isHeld.value));

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

const hover = usePopupHover(floatingRootStore);

function restoreOutsidePointerEvents() {
  hover.session.value.restoreOutsidePointerEvents();
}

// A change of `open` and the unmount release the pointer events that the safe polygon blocked. A
// server render calls no `onBeforeUnmount` hook, so a server makes no hover intent.
watch(open, (isOpen) => {
  restoreOutsidePointerEvents();
  if (!isOpen) {
    stickIfOpenTimeout.clear();
    pointerType.value = '';
    floatingRootStore.context.openEvent = undefined;
    hover.session.value.reset();
    hover.session.value.cancelPendingOpen();
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

const hoverStyle = useHoverPointerStyle(triggerElement);
const hoverProps = hover.trigger({
  enabled: hoverInteractionsEnabled,
  move: false,
  safePolygon: () => ({ blockPointerEvents: shouldBlockSafePolygonPointerEvents.value, getScope }),
  restMs: () => (mounted.value && positionerElement.value ? 0 : delay.value),
  delay: () => ({ close: closeDelay.value }),
  triggerElement,
  getHandleCloseContext: getInlineHandleCloseContext,
});

// The handler of `useTriggerPress` runs after the handler of this part, which can already have changed the
// item. A press of another trigger would close the menu if `toggle` read the new item.
const click = useTriggerPress(floatingRootStore, {
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
  if (isDisabled.value) {
    return;
  }
  const currentTarget = event.currentTarget as HTMLElement;
  // The `keydown` handler writes the value before this function runs.
  const previousValue = renderedValue;
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

      hover.session.value.blockOutsidePointerEvents({
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
    handleActivation(event);
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
  disabled: isDisabled.value,
}));

const compositeItem = useCompositeItem(triggerElement);

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('button', props, {
  elementRef: triggerElement,
  button: (element) =>
    useButton(element, {
      disabled: isDisabled,
      focusableWhenDisabled: true,
      native: () => props.nativeButton,
    }),
  state,
  stateAttributesMapping: pressableTriggerOpenStateMapping,
  props: (attrs) => [
    compositeItem.attributes.value,
    compositeItem.events,
    click,
    hoverProps,
    { style: hoverStyle.value },
    dismissProps?.value?.reference,
    {
      // The popup reads this id from the element for its name.
      id: triggerId.value,
      // The key wins over the roving `tabindex` of the composite, so each trigger is a tab stop.
      tabindex: 0,
      onMouseenter: handleActivation,
      onClick: handleActivation,
      onPointerenter: handleSetPointerType,
      onPointerdown: handleTriggerPointerDown,
      'aria-expanded': isActiveItem.value,
      'aria-controls': (isActiveItem.value && popupElementId.value) || undefined,
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

onMounted(openHoveredTrigger);

watch(
  isHeld,
  (held) => {
    if (held) {
      stickIfOpenTimeout.clear();
      restoreOutsidePointerEvents();
    } else {
      openHoveredTrigger();
    }
  },
  { flush: 'sync' },
);

// Script makes the two guards and the owner element after the trigger, so the trigger has one root
// node.
let outsideNodes: {
  before: HTMLSpanElement;
  owner: HTMLSpanElement;
  after: HTMLSpanElement;
  siblings: ElementSiblings;
} | null = null;

const outsideSiblings = computed(() => {
  const trigger = triggerElement.value;
  if (!isActiveItem.value || !trigger) {
    return null;
  }
  if (!outsideNodes) {
    const before = createFocusGuardElement(trigger.ownerDocument);
    const owner = trigger.ownerDocument.createElement('span');
    const after = createFocusGuardElement(trigger.ownerDocument);
    Object.assign(owner.style, ownerVisuallyHidden);
    before.addEventListener('focusin', handleBeforeOutsideFocusin);
    after.addEventListener('focusin', (event) => void handleAfterOutsideFocusin(event));
    outsideNodes = { before, owner, after, siblings: { after: [before, owner, after] } };
  }
  return outsideNodes.siblings;
});

useElementSiblings(triggerElement, outsideSiblings);

// Another trigger of the root can write the refs in the same DOM update, so a trigger clears a ref
// only while the ref holds its own guard.
function releaseOutsideGuards() {
  if (beforeOutsideRef.value === outsideNodes?.before) {
    beforeOutsideRef.value = null;
  }
  if (afterOutsideRef.value === outsideNodes?.after) {
    afterOutsideRef.value = null;
  }
}

watch(
  [outsideSiblings, viewportElementId],
  ([siblings, viewportId]) => {
    if (!outsideNodes) {
      return;
    }
    if (!siblings) {
      releaseOutsideGuards();
      return;
    }
    beforeOutsideRef.value = outsideNodes.before;
    afterOutsideRef.value = outsideNodes.after;
    if (viewportId) {
      outsideNodes.owner.setAttribute('aria-owns', viewportId);
    } else {
      outsideNodes.owner.removeAttribute('aria-owns');
    }
  },
  { flush: 'post' },
);

onScopeDispose(releaseOutsideGuards);

function isOutsideGuard(element: Element) {
  return element === outsideNodes?.before || element === outsideNodes?.after;
}

// `KeepAlive` takes the inside guards out of the document with the viewport, and a root with no
// viewport has none. The Tab key then skips the popup, as it skips a popup with no tabbable
// element.
function handleBeforeOutsideFocusin(event: FocusEvent) {
  const referenceElement = hoverPopupElement.value;
  const beforeInside = beforeInsideRef.value;

  if (referenceElement && !isOutsideEvent(event, referenceElement)) {
    getPreviousTabbable(triggerElement.value)?.focus();
  } else if (beforeInside?.isConnected) {
    beforeInside.focus();
  } else {
    exitForward(event, getTabbableNearElement(triggerElement.value, 1, isOutsideGuard));
  }
}

async function handleAfterOutsideFocusin(event: FocusEvent) {
  const referenceElement = hoverPopupElement.value;

  if (!referenceElement || isOutsideEvent(event, referenceElement)) {
    // The viewport has `inert` while the focus is out of it, and a browser cannot focus an element
    // that is inert.
    setViewportInert(false);
    await nextTick();
    const afterInside = afterInsideRef.value;
    (afterInside?.isConnected ? afterInside : triggerElement.value)?.focus();
    return;
  }

  exitForward(event, getNextTabbable(triggerElement.value));
}

function exitForward(event: FocusEvent, next: FocusableElement | null) {
  const referenceElement = hoverPopupElement.value;
  let nextTabbable = next;

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

useElementRegistration(navigationTriggers, element, () => true);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
