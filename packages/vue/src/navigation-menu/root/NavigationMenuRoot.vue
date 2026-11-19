<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { Orientation, VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

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
  modelValue?: Value | null | undefined;
  /**
   * The uncontrolled value of the item that should be initially selected.
   *
   * To render a controlled navigation menu, use the `modelValue` prop instead.
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
</script>

<script setup lang="ts" generic="Value = any">
import { computed, provide, shallowRef, watch } from 'vue';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { ownerDocument } from '../../common/owner';
import { activeElement, contains } from '../../common/shadowDom';
import { useControlled } from '../../common/useControlled';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { useUnmountAfterClose } from '../../internals/useUnmountAfterClose';
import type { FloatingRootStore } from '../../utils/popups/floating-root/FloatingRootStore';
import { useElementId } from '../../utils/popups/useElementId';
import {
  provideFloatingNode,
  provideFloatingTree,
  useFloatingNodeId,
  useFloatingParentNodeId,
} from '../../utils/popups/tree/FloatingTree';
import {
  NavigationMenuRootContext,
  useNavigationMenuRootContext,
} from './NavigationMenuRootContext';
import type {
  NavigationMenuActivationDirection,
  NavigationMenuSizes,
} from './NavigationMenuRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavigationMenuRootProps<Value>>(), {
  modelValue: undefined,
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
  /**
   * Event handler called after `valueChange` with the new value, unless a listener cancels the
   * change. `v-model` uses it.
   */
  'update:modelValue': [value: Value | null];
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

const currentValue = useControlled<Value | null>({
  controlled: () => props.modelValue,
  default: () => props.defaultValue,
  name: 'NavigationMenu',
  state: 'value',
});

const open = computed(() => currentValue.value != null);

let closeReason: NavigationMenuRootChangeEventReason | undefined;
const rootRef = shallowRef<HTMLElement | null>(null);

const positionerElement = shallowRef<HTMLElement | null>(null);
const sizes = shallowRef<NavigationMenuSizes>({ popup: null, positioner: null });
const popupElement = shallowRef<HTMLElement | null>(null);
const backdropElement = shallowRef<HTMLElement | null>(null);
const viewportElement = shallowRef<HTMLElement | null>(null);
const shownViewportElement = shallowRef<HTMLElement | null>(null);
const viewportTargetElement = shallowRef<HTMLElement | null>(null);
const activationDirection = shallowRef<NavigationMenuActivationDirection>(null);
const floatingRootStore = shallowRef<FloatingRootStore | undefined>(undefined);
const viewportInert = shallowRef(false);

const popupElementId = useElementId(popupElement);
const viewportElementId = useElementId(shownViewportElement);

const prevTriggerElementRef = shallowRef<Element | null | undefined>(null);
const currentContentRef = shallowRef<HTMLElement | null>(null);
const beforeInsideRef = shallowRef<HTMLElement | null>(null);
const afterInsideRef = shallowRef<HTMLElement | null>(null);
const beforeOutsideRef = shallowRef<HTMLElement | null>(null);
const afterOutsideRef = shallowRef<HTMLElement | null>(null);
const preventUnmountOnClose = shallowRef(false);
// With no popup part, the positioner is the part that shows, and with no positioner, the backdrop.
const transitionElement = () =>
  popupElement.value ?? positionerElement.value ?? backdropElement.value;
const {
  mounted,
  transitionStatus,
  preventUnmountingOnClose,
  forceUnmount: unmount,
} = useUnmountAfterClose({
  open,
  ref: transitionElement,
  preventUnmountOnClose,
  setPreventUnmountOnClose(next) {
    preventUnmountOnClose.value = next;
  },
  onUnmount() {
    const doc = ownerDocument(rootRef.value);
    const activeEl = activeElement(doc);
    // A root with an inline viewport has no popup, positioner or backdrop part. Its content is in
    // the viewport.
    const element = transitionElement() ?? viewportElement.value;

    const isReturnFocusBlocked = closeReason ? blockedReturnFocusReasons.has(closeReason) : false;

    // A `v-if` of the consumer can remove the portal part while the focus is in it. The element is
    // then gone, and the focus is on the body.
    if (
      !isReturnFocusBlocked &&
      isHTMLElement(prevTriggerElementRef.value) &&
      (activeEl === doc.body || contains(element, activeEl))
    ) {
      prevTriggerElementRef.value.focus({ preventScroll: true });
      prevTriggerElementRef.value = undefined;
    }

    emit('openChangeComplete', false);
    sizes.value = { popup: null, positioner: null };
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

watch(open, (isOpen) => {
  if (isOpen) return;
  activationDirection.value = null;
  floatingRootStore.value = undefined;
  // The exit can already have a zero box. Keep the last target for that frame.
  const target = sizes.value.positioner;
  if (target && target.width > 0 && target.height > 0) {
    sizes.value = { popup: target, positioner: target };
  }
});

watch(currentValue, () => {
  viewportInert.value = false;
});

function setValue(
  nextValue: Value | null,
  eventDetails: Omit<NavigationMenuRootChangeEventDetails, 'preventUnmountOnClose'>,
) {
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
    closeReason = eventDetails.reason;
    // A redundant close (for example the trigger's blur after an imperative close) skips
    // `valueChange`, so it can't opt out again and must not discard the recorded opt-out.
    if (previousValue != null) {
      preventUnmountOnClose.value = unmountPrevented;
    }
  }

  if (changed) {
    emit('update:modelValue', nextValue);
  }
  currentValue.value = nextValue;

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

const tree = nested ? undefined : provideFloatingTree();
const nodeId = useFloatingNodeId(tree);
provideFloatingNode(nodeId);

provide(NavigationMenuRootContext, {
  nodeId,
  open,
  value: currentValue,
  setValue,
  mounted,
  transitionStatus,
  positionerElement,
  popupElement,
  popupElementId,
  backdropElement,
  viewportElement,
  shownViewportElement,
  viewportElementId,
  viewportTargetElement,
  activationDirection: computed(() => (open.value ? activationDirection.value : null)),
  setActivationDirection(direction) {
    activationDirection.value = direction;
  },
  floatingRootStore,
  setActiveTrigger(store, trigger) {
    floatingRootStore.value = store;
    prevTriggerElementRef.value = trigger;
  },
  currentContentRef,
  registerContent(content) {
    currentContentRef.value = content;
    return () => {
      if (currentContentRef.value === content) currentContentRef.value = null;
    };
  },
  prevTriggerElementRef,
  nested,
  rootRef,
  beforeInsideRef,
  afterInsideRef,
  beforeOutsideRef,
  afterOutsideRef,
  sizes,
  setSizes(next) {
    sizes.value = next;
  },
  delay: computed(() => props.delay),
  closeDelay: computed(() => props.closeDelay),
  orientation: computed(() => props.orientation),
  viewportInert,
  setViewportInert(inert) {
    viewportInert.value = inert;
  },
});

const state = computed<NavigationMenuRootState>(() => ({ open: open.value, nested }));

const defaultTag = nested ? 'div' : 'nav';

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement(defaultTag, props, {
  state,
  elementRef: rootRef,
});

defineExpose({ element, close, unmount });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as ?? defaultTag" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
