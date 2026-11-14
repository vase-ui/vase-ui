<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { Orientation, VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import * as NavigationMenuPositionerCssVars from '../positioner/NavigationMenuPositionerCssVars';

export interface NavigationMenuRootState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
  /**
   * Whether the navigation menu is nested.
   */
  nested: boolean;
}

export interface NavigationMenuRootProps<Value = any>
  extends
    VaseUIComponentProps<NavigationMenuRootState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The controlled value of the navigation menu item that should be currently open.
   * When non-nullish, the menu will be open. When nullish, the menu will be closed.
   *
   * To render an uncontrolled navigation menu, use the `defaultValue` prop instead.
   */
  value?: Value | null | undefined;
  /**
   * The uncontrolled value of the item that should be initially selected.
   *
   * To render a controlled navigation menu, use the `value` prop instead.
   * @default null
   */
  defaultValue?: Value | null | undefined;
  /**
   * How long to wait before opening the navigation popup. Specified in milliseconds.
   * @default 50
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing the navigation popup. Specified in milliseconds.
   * @default 50
   */
  closeDelay?: number | undefined;
  /**
   * The orientation of the navigation menu.
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
}

export interface NavigationMenuRootActions {
  /**
   * Ends the closing phase of the navigation menu popup after an externally controlled closing animation finishes.
   * Call `details.preventUnmountOnClose()` in `valueChange` first, otherwise the navigation menu popup completes closing on its own.
   * Whether it leaves the DOM is decided by `keepMounted` on the portal.
   */
  unmount: () => void;
  /**
   * Closes the navigation menu imperatively when called.
   */
  close: () => void;
}

export type NavigationMenuRootChangeEventReason =
  | typeof REASONS.triggerPress
  | typeof REASONS.triggerHover
  | typeof REASONS.outsidePress
  | typeof REASONS.listNavigation
  | typeof REASONS.focusOut
  | typeof REASONS.escapeKey
  | typeof REASONS.linkPress
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type NavigationMenuRootChangeEventDetails =
  VaseUIChangeEventDetails<NavigationMenuRootChangeEventReason> & {
    /** Prevents the popup from unmounting until the `unmount` action is called. */
    preventUnmountOnClose: () => void;
  };

const blockedReturnFocusReasons = new Set<string>([
  REASONS.triggerHover,
  REASONS.outsidePress,
  REASONS.focusOut,
]);

function getPositionerFixedSize(positionerElement: HTMLElement) {
  // Read the last fixed positioner size rather than measuring the popup now:
  // during a controlled close, the popup can already be in its exit render and
  // report 0 before the closing transition gets a stable size to animate from.
  const width =
    parseFloat(
      positionerElement.style.getPropertyValue(NavigationMenuPositionerCssVars.positionerWidth),
    ) || 0;
  const height =
    parseFloat(
      positionerElement.style.getPropertyValue(NavigationMenuPositionerCssVars.positionerHeight),
    ) || 0;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
}
</script>

<script setup lang="ts" generic="Value = any">
import { computed, onMounted, provide, shallowRef, watch } from 'vue';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { ownerDocument } from '../../common/owner';
import { activeElement, contains } from '../../common/shadowDom';
import { useControlled } from '../../common/useControlled';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { useUnmountAfterClose } from '../../internals/useUnmountAfterClose';
import type { FloatingRootStore } from '../../utils/popups/floating-root/FloatingRootStore';
import {
  provideFloatingNode,
  provideFloatingTree,
  useFloatingNodeId,
  useFloatingParentNodeId,
} from '../../utils/popups/tree/FloatingTree';
import { setSharedFixedSize } from '../utils/setSharedFixedSize';
import {
  NavigationMenuRootContext,
  NavigationMenuTreeContext,
  useNavigationMenuRootContext,
} from './NavigationMenuRootContext';
import type {
  NavigationMenuActivationDirection,
  NavigationMenuPopupAutoSizeResetState,
} from './NavigationMenuRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavigationMenuRootProps<Value>>(), {
  value: undefined,
  defaultValue: null,
  delay: 50,
  closeDelay: 50,
  orientation: 'horizontal',
});

const emit = defineEmits<{
  /**
   * Callback fired when the value changes.
   */
  valueChange: [value: Value | null, eventDetails: NavigationMenuRootChangeEventDetails];
  'update:value': [value: Value | null];
  /**
   * Event handler called after any animations complete when the navigation menu is closed.
   */
  openChangeComplete: [open: boolean];
}>();

defineSlots<{
  default(props: { state: NavigationMenuRootState }): unknown;
  render: ComponentRenderFn<HTMLProps, NavigationMenuRootState>;
}>();

// A component keeps its provider chain from the moment that Vue makes it, so the root decides
// one time whether another popup is above it.
const nested = useFloatingParentNodeId().value != null;
const parentRootContext = useNavigationMenuRootContext(true);

const [currentValue, setValueUnwrapped] = useControlled<Value | null>({
  controlled: () => props.value,
  default: () => props.defaultValue,
  name: 'NavigationMenu',
  state: 'value',
});

const open = computed(() => currentValue.value != null);

let closeReason: NavigationMenuRootChangeEventReason | undefined;
const rootRef = shallowRef<HTMLElement | null>(null);

const positionerElement = shallowRef<HTMLElement | null>(null);
const popupElement = shallowRef<HTMLElement | null>(null);
const viewportElement = shallowRef<HTMLElement | null>(null);
const viewportTargetElement = shallowRef<HTMLElement | null>(null);
const activationDirection = shallowRef<NavigationMenuActivationDirection>(null);
const floatingRootStore = shallowRef<FloatingRootStore | undefined>(undefined);
const viewportInert = shallowRef(false);

const prevTriggerElementRef = shallowRef<Element | null | undefined>(null);
const currentContentRef = shallowRef<HTMLElement | null>(null);
const beforeInsideRef = shallowRef<HTMLElement | null>(null);
const afterInsideRef = shallowRef<HTMLElement | null>(null);
const beforeOutsideRef = shallowRef<HTMLElement | null>(null);
const afterOutsideRef = shallowRef<HTMLElement | null>(null);
const popupAutoSizeResetRef: NavigationMenuPopupAutoSizeResetState = {
  abortController: null,
  owner: null,
};

const preventUnmountOnClose = shallowRef(false);
const {
  mounted,
  transitionStatus,
  preventUnmountingOnClose,
  forceUnmount: unmount,
} = useUnmountAfterClose({
  open,
  ref: popupElement,
  preventUnmountOnClose,
  setPreventUnmountOnClose(next) {
    preventUnmountOnClose.value = next;
  },
  onUnmount() {
    const doc = ownerDocument(rootRef.value);
    const activeEl = activeElement(doc);
    const popup = popupElement.value;

    const isReturnFocusBlocked = closeReason ? blockedReturnFocusReasons.has(closeReason) : false;

    if (
      !isReturnFocusBlocked &&
      isHTMLElement(prevTriggerElementRef.value) &&
      (activeEl === ownerDocument(popup).body || contains(popup, activeEl)) &&
      popup
    ) {
      prevTriggerElementRef.value.focus({ preventScroll: true });
      prevTriggerElementRef.value = undefined;
    }

    emit('openChangeComplete', false);
    activationDirection.value = null;
    floatingRootStore.value = undefined;

    currentContentRef.value = null;
    closeReason = undefined;
  },
});

// The viewport target may be the animated element instead of the popup.
useOpenChangeComplete({
  enabled: () => mounted.value && !open.value && !preventUnmountingOnClose.value,
  open,
  ref: viewportTargetElement,
  onComplete() {
    if (!open.value) {
      unmount();
    }
  },
});

function setClosedPopupFixedSize() {
  if (open.value) {
    return;
  }

  const positioner = positionerElement.value;
  const popup = popupElement.value;
  if (!positioner || !popup) {
    return;
  }

  const closeTransitionSize = getPositionerFixedSize(positioner);

  if (!closeTransitionSize) {
    return;
  }

  // No cleanup is needed for this fixed size: the inline styles leave the DOM with the popup, and
  // the next open sizes the popup again.
  setSharedFixedSize(popup, positioner, closeTransitionSize.width, closeTransitionSize.height);
}

onMounted(setClosedPopupFixedSize);
watch([open, popupElement, positionerElement], setClosedPopupFixedSize, { flush: 'post' });

watch(currentValue, () => {
  viewportInert.value = false;
});

function setValue(
  nextValue: Value | null,
  eventDetails: Omit<NavigationMenuRootChangeEventDetails, 'preventUnmountOnClose'>,
) {
  if (nextValue == null) {
    closeReason = eventDetails.reason;
  }

  const previousValue = currentValue.value;
  const changeEventDetails = eventDetails as NavigationMenuRootChangeEventDetails;
  // Navigation Menu only takes the request from `valueChange` itself, not after an `await`.
  let unmountPrevented = false;
  changeEventDetails.preventUnmountOnClose = () => {
    unmountPrevented = true;
  };

  const changed = nextValue !== previousValue;
  if (changed) {
    emit('valueChange', nextValue, changeEventDetails);
  }

  if (eventDetails.isCanceled) {
    return;
  }

  if (nextValue == null) {
    // A redundant close (for example the trigger's blur after an imperative close) skips
    // `valueChange`, so it can't opt out again and must not discard the recorded opt-out.
    if (previousValue != null) {
      preventUnmountOnClose.value = unmountPrevented;
    }
    activationDirection.value = null;
    floatingRootStore.value = undefined;
  }

  if (changed) {
    emit('update:value', nextValue);
  }
  setValueUnwrapped(nextValue);

  if (
    nested &&
    nextValue == null &&
    eventDetails.reason === REASONS.linkPress &&
    parentRootContext
  ) {
    parentRootContext.setValue(null, eventDetails);
  }
}

function close() {
  setValue(null, createChangeEventDetails(REASONS.imperativeAction));
}

provide(NavigationMenuRootContext, {
  open,
  value: currentValue,
  setValue,
  mounted,
  transitionStatus,
  positionerElement,
  popupElement,
  viewportElement,
  viewportTargetElement,
  activationDirection: computed(() => (open.value ? activationDirection.value : null)),
  setActivationDirection(direction) {
    activationDirection.value = direction;
  },
  floatingRootStore,
  setFloatingRootStore(store) {
    floatingRootStore.value = store;
  },
  currentContentRef,
  prevTriggerElementRef,
  nested,
  rootRef,
  beforeInsideRef,
  afterInsideRef,
  beforeOutsideRef,
  afterOutsideRef,
  popupAutoSizeResetRef,
  delay: computed(() => props.delay),
  closeDelay: computed(() => props.closeDelay),
  orientation: computed(() => props.orientation),
  viewportInert,
  setViewportInert(inert) {
    viewportInert.value = inert;
  },
});

const tree = nested ? undefined : provideFloatingTree();
const nodeId = useFloatingNodeId(tree);
provideFloatingNode(nodeId);
provide(NavigationMenuTreeContext, nodeId);

const state = computed<NavigationMenuRootState>(() => ({ open: open.value, nested }));

const defaultTag = nested ? 'div' : 'nav';

const { element, elementProps } = useRenderElement(defaultTag, props, {
  state,
  ref: [
    (rootElement) => {
      rootRef.value = rootElement;
    },
  ],
});

defineExpose({ element, close, unmount });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as ?? defaultTag" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
