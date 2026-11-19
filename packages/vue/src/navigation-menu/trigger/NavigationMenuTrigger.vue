<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { Dimensions } from '@floating-ui/utils';
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

const EMPTY_SIZE: Dimensions = { width: 0, height: 0 };

// The listeners of the hover interaction read `currentTarget`, and an event that no one
// dispatched has none.
function createHoverEvent(type: 'mouseenter' | 'mousemove', currentTarget: HTMLElement) {
  const event = new MouseEvent(type);
  Object.defineProperty(event, 'currentTarget', { value: currentTarget });
  return event;
}
</script>

<script setup lang="ts">
import { dismissTriggerBindings } from '../../utils/popups/interactions/useDismissLayer';
import { useElementRegistration } from '../../internals/useElementRegistration';
import { computed, inject, nextTick, watchPostEffect, shallowRef, watch } from 'vue';
import { closest, contains } from '../../common/shadowDom';
import { addEventListener } from '../../common/addEventListener';
import { ownerWindow } from '../../common/owner';
import { useAnimationFrame } from '../../common/useAnimationFrame';
import { useMutationObserver } from '../../common/useMutationObserver';
import { useResizeObserver } from '../../common/useResizeObserver';
import * as TransitionStatusDataAttributes from '../../internals/TransitionStatusDataAttributes';
import { useAnimationsFinished } from '../../internals/useAnimationsFinished';
import { getCssDimensions } from '../../utils/getCssDimensions';
import { createElementSetter } from '../../utils/popups/createElementSetter';
import { useDomEffect } from '../../utils/popups/useDomEffect';
import type { NavigationMenuSizes } from '../root/NavigationMenuRootContext';
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
import { usePopupHover, useHoverPointerStyle } from '../../utils/popups/interactions/usePopupHover';
import { useTriggerPress } from '../../utils/popups/usePopupTrigger';
import { pressableTriggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { useNavigationMenuItemContext } from '../item/NavigationMenuItemContext';
import {
  useNavigationMenuRootContext,
  NavigationMenuDismissContext,
  useNavigationMenuFocusout,
  navigationTriggers,
  NAVIGATION_MENU_TRIGGER_IDENTIFIER,
} from '../root/NavigationMenuRootContext';
import type { NavigationMenuRootChangeEventDetails } from '../root/NavigationMenuRoot.vue';

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

const root = useNavigationMenuRootContext();
const {
  nodeId,
  value,
  setValue,
  sizes,
  setSizes,
  currentContentRef,
  transitionStatus,
  mounted,
  open,
  positionerElement,
  setActivationDirection,
  setActiveTrigger,
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
} = root;
const { value: itemValue } = useNavigationMenuItemContext();
const handleFocusout = useNavigationMenuFocusout(root);
const dismissProps = inject(NavigationMenuDismissContext, undefined);
const direction = useDirection();

const stickIfOpenTimeout = useTimeout();

const triggerId = useVaseUiId();
const triggerElement = shallowRef<HTMLElement | null>(null);
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

// Press and key handlers share an event. Each needs the item from before the first handler ran.
let renderedMounted = mounted.value;
let renderedIsActiveItem = isActiveItem.value;
let renderedValue = value.value;
watch([mounted, isActiveItem, value], ([isMounted, isActive, currentValue]) => {
  renderedMounted = isMounted;
  renderedIsActiveItem = isActive;
  renderedValue = currentValue;
});

const { isHeld } = useKeepAliveState();
const starting = computed(() => transitionStatus.value === 'starting');
const canMeasure = computed(() => isActiveItem.value && !isHeld.value);
const mutationFrame = useAnimationFrame();
const resizeFrame = useAnimationFrame();
const sizeFrame = useAnimationFrame();
const runOnceAnimationsFinish = useAnimationsFinished(popupElement);
let previousSize = EMPTY_SIZE;
let switchFrom: Dimensions | undefined;
let pendingMeasurement: NavigationMenuSizes | undefined;
let autoSizeReset: AbortController | undefined;

watch(
  canMeasure,
  (active, _, onCleanup) => {
    if (!active) return;

    // The old item still determines the popup size before Vue patches the content.
    const popup = popupElement.value;
    if (popup?.isConnected) {
      switchFrom = getCssDimensions(popup);
      if (switchFrom.width && switchFrom.height) previousSize = switchFrom;
    }

    onCleanup(() => {
      if (pendingMeasurement && sizes.value === pendingMeasurement) {
        setSizes({ popup: pendingMeasurement.popup, positioner: pendingMeasurement.positioner });
      }
      pendingMeasurement = undefined;
      switchFrom = undefined;
      mutationFrame.cancel();
      resizeFrame.cancel();
      sizeFrame.cancel();
      autoSizeReset?.abort();
    });
  },
  { immediate: true, flush: 'sync' },
);

function ownsPopup(popup: HTMLElement, positioner: HTMLElement) {
  return (
    canMeasure.value &&
    popupElement.value === popup &&
    positionerElement.value === positioner &&
    popup.isConnected
  );
}

function measure(popup: HTMLElement, positioner: HTMLElement, commit: (size: Dimensions) => void) {
  if (!ownsPopup(popup, positioner)) return;
  autoSizeReset?.abort();
  const previous = sizes.value;
  const measurement = { ...previous, measuring: true };
  setSizes(measurement);
  pendingMeasurement = measurement;
  void nextTick(() => {
    if (sizes.value !== measurement) return;
    pendingMeasurement = undefined;
    setSizes({ popup: previous.popup, positioner: previous.positioner });
    if (ownsPopup(popup, positioner)) commit(getCssDimensions(popup));
  });
}

function commitTarget(popup: HTMLElement, positioner: HTMLElement, target: Dimensions) {
  if (!ownsPopup(popup, positioner)) return;
  autoSizeReset?.abort();
  setSizes({ popup: target, positioner: target });
  const reset = new AbortController();
  autoSizeReset = reset;
  void nextTick(() => {
    if (reset.signal.aborted) return;
    runOnceAnimationsFinish(() => {
      if (ownsPopup(popup, positioner)) setSizes({ popup: 'auto', positioner: target });
    }, reset.signal);
  });
}

function animateSize(popup: HTMLElement, positioner: HTMLElement, from: Dimensions) {
  measure(popup, positioner, ({ width, height }) => {
    const target = { width: width || previousSize.width, height: height || previousSize.height };
    setSizes({ popup: from.width && from.height ? from : target, positioner: target });
    sizeFrame.request(() => commitTarget(popup, positioner, target));
  });
}

function syncSize(popup: HTMLElement, positioner: HTMLElement) {
  sizeFrame.cancel();
  measure(popup, positioner, (size) => {
    if (!size.width || !size.height) return;
    previousSize = size;
    if (sizes.value.positioner === null) commitTarget(popup, positioner, size);
    else setSizes({ popup: 'auto', positioner: size });
  });
}

watch(mounted, (isMounted) => {
  if (!isMounted) previousSize = EMPTY_SIZE;
});

useResizeObserver(
  () => (canMeasure.value ? popupElement.value : null),
  () => {
    const popup = popupElement.value;
    if (popup) previousSize = { width: popup.offsetWidth, height: popup.offsetHeight };
  },
);

useDomEffect(
  [canMeasure, popupElement, positionerElement],
  () => {
    const popup = popupElement.value;
    const positioner = positionerElement.value;
    if (!canMeasure.value || !popup || !positioner) return;
    const unsubscribe = addEventListener(ownerWindow(positioner), 'resize', () => {
      resizeFrame.request(() => syncSize(popup, positioner));
    });
    return () => {
      resizeFrame.cancel();
      unsubscribe();
    };
  },
  isHeld,
);

useMutationObserver(
  () =>
    canMeasure.value && popupElement.value && positionerElement.value
      ? currentContentRef.value
      : null,
  {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['hidden'],
  },
  () => {
    const popup = popupElement.value;
    const positioner = positionerElement.value;
    if (!popup || !positioner) return;
    // A render slot can retain the marker after the root finishes its enter phase.
    if (starting.value || popup.hasAttribute(TransitionStatusDataAttributes.startingStyle)) {
      syncSize(popup, positioner);
    } else if (sizes.value.popup && sizes.value.popup !== 'auto') {
      const current = {
        width: popup.offsetWidth || previousSize.width,
        height: popup.offsetHeight || previousSize.height,
      };
      sizeFrame.cancel();
      mutationFrame.cancel();
      autoSizeReset?.abort();
      if (!current.width || !current.height || !ownsPopup(popup, positioner)) return;
      setSizes({ popup: current, positioner: current });
      // Paint the interrupted size before the next transition starts.
      mutationFrame.request(() =>
        mutationFrame.request(() => {
          measure(popup, positioner, ({ width, height }) => {
            const target = { width: width || current.width, height: height || current.height };
            sizeFrame.request(() => commitTarget(popup, positioner, target));
          });
        }),
      );
    } else {
      animateSize(popup, positioner, previousSize);
    }
  },
);

useDomEffect(
  [canMeasure, popupElement, positionerElement, starting],
  () => {
    const popup = popupElement.value;
    const positioner = positionerElement.value;
    if (!canMeasure.value || !popup || !positioner) return;
    const from = switchFrom ?? getCssDimensions(popup);
    switchFrom = undefined;
    animateSize(popup, positioner, from);
  },
  isHeld,
);

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

function getScope() {
  if (nested && positionerElement.value) {
    return null;
  }

  return closest(triggerElement.value, 'ul');
}

function getInlineHandleCloseContext(): HandleCloseContextBase | null {
  const trigger = triggerElement.value;
  const popup = hoverPopupElement.value;
  if (!nested || positionerElement.value || !trigger || !popup) {
    return null;
  }

  const anchor = trigger.getBoundingClientRect();
  const panel = popup.getBoundingClientRect();
  const dx = panel.left + panel.width / 2 - (anchor.left + anchor.width / 2);
  const dy = panel.top + panel.height / 2 - (anchor.top + anchor.height / 2);
  const horizontal = dx >= 0 ? 'right' : 'left';
  const vertical = dy >= 0 ? 'bottom' : 'top';
  return {
    placement: Math.abs(dx) >= Math.abs(dy) ? horizontal : vertical,
    elements: { domReference: trigger, floating: popup },
    nodeId,
  };
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
      setActiveTrigger(floatingRootStore, triggerElement.value);
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
    dismissProps?.value && dismissTriggerBindings(dismissProps.value),
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

useDomEffect(
  [],
  () => {
    // A stationary pointer gets no enter event after hydration or activation.
    const trigger = triggerElement.value;
    if (trigger?.matches(':hover') && hoverInteractionsEnabled.value && value.value == null) {
      hoverProps.onMouseenter?.(createHoverEvent('mouseenter', trigger));
      hoverProps.onMousemove?.(createHoverEvent('mousemove', trigger));
    }
    return () => {
      stickIfOpenTimeout.clear();
      restoreOutsidePointerEvents();
    };
  },
  isHeld,
);

// Siblings preserve the single root for directives, transitions and scoped styles.
const outsideNodes = computed(() => {
  const doc = triggerElement.value?.ownerDocument;
  if (!doc) return null;
  const before = createFocusGuardElement(doc);
  const owner = doc.createElement('span');
  const after = createFocusGuardElement(doc);
  Object.assign(owner.style, ownerVisuallyHidden);
  before.addEventListener('focusin', handleBeforeOutsideFocusin);
  after.addEventListener('focusin', (event) => void handleAfterOutsideFocusin(event));
  return { after: [before, owner, after] as const };
});
const outsideSiblings = computed(() => (isActiveItem.value ? outsideNodes.value : null));
useElementSiblings(triggerElement, outsideSiblings);

const setBeforeOutside = createElementSetter(beforeOutsideRef, { keepWhileHeld: true });
const setAfterOutside = createElementSetter(afterOutsideRef, { keepWhileHeld: true });
watchPostEffect(() => {
  const nodes = outsideSiblings.value?.after;
  setBeforeOutside(nodes?.[0] ?? null);
  setAfterOutside(nodes?.[2] ?? null);
  if (!nodes) return;
  const owner = nodes[1];
  const id = viewportElementId.value;
  if (id) owner.setAttribute('aria-owns', id);
  else owner.removeAttribute('aria-owns');
});

function isOutsideGuard(element: Element) {
  const nodes = outsideNodes.value?.after;
  return element === nodes?.[0] || element === nodes?.[2];
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
