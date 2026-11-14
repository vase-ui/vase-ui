<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { SwipeDirection } from '../../utils/useSwipeDismiss';
import type { DrawerSwipeDirection } from '../root/DrawerRootContext';
import * as DrawerSwipeAreaDataAttributes from './DrawerSwipeAreaDataAttributes';

export interface DrawerSwipeAreaProps
  extends
    VaseUIComponentProps<DrawerSwipeAreaState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<HTMLAttributes, 'id'>> {
  /**
   * Whether the swipe area is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The swipe direction that opens the drawer.
   * Defaults to the opposite of `Drawer.Root` `swipeDirection`.
   */
  swipeDirection?: DrawerSwipeDirection | undefined;
  /**
   * The id of the swipe area. The drawer registers the swipe area as a trigger with this id.
   */
  id?: string | undefined;
}

export interface DrawerSwipeAreaState {
  /**
   * Whether the drawer is currently open.
   */
  open: boolean;
  /**
   * Whether the swipe area is currently being swiped.
   */
  swiping: boolean;
  /**
   * The swipe direction that opens the drawer.
   */
  swipeDirection: SwipeDirection;
  /**
   * Whether the swipe area is disabled.
   */
  disabled: boolean;
}

const DEFAULT_SWIPE_OPEN_RATIO = 0.5;
const MIN_SWIPE_START_DISTANCE = 1;
const VELOCITY_THRESHOLD = 0.1;
const FALLBACK_SWIPE_OPEN_THRESHOLD = 40;

const SWIPE_AREA_OPEN_HOOK: Record<string, string> = {
  [DrawerSwipeAreaDataAttributes.open]: '',
};

const SWIPE_AREA_CLOSED_HOOK: Record<string, string> = {
  [DrawerSwipeAreaDataAttributes.closed]: '',
};

const SWIPE_AREA_SWIPING_HOOK: Record<string, string> = {
  [DrawerSwipeAreaDataAttributes.swiping]: '',
};

const SWIPE_AREA_DISABLED_HOOK: Record<string, string> = {
  [DrawerSwipeAreaDataAttributes.disabled]: '',
};

const stateAttributesMapping: StateAttributesMapping<DrawerSwipeAreaState> = {
  open(value) {
    return value ? SWIPE_AREA_OPEN_HOOK : SWIPE_AREA_CLOSED_HOOK;
  },
  swiping(value) {
    return value ? SWIPE_AREA_SWIPING_HOOK : null;
  },
  swipeDirection(value) {
    return { [DrawerSwipeAreaDataAttributes.swipeDirection]: value };
  },
  disabled(value) {
    return value ? SWIPE_AREA_DISABLED_HOOK : null;
  },
};

const oppositeSwipeDirection: Record<DrawerSwipeDirection, DrawerSwipeDirection> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

function resolveTouchAction(direction: DrawerSwipeDirection) {
  return direction === 'left' || direction === 'right' ? 'pan-y' : 'pan-x';
}
</script>

<script setup lang="ts">
import { computed, onDeactivated, onScopeDispose, onUpdated, shallowRef, watch } from 'vue';
import { clamp } from '../../common/clamp';
import { ownerDocument } from '../../common/owner';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { NOOP } from '../../internals/noop';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { getElementTransform } from '../../utils/getElementTransform';
import { isVirtualClick } from '../../utils/popups/event';
import { useTriggerRegistration } from '../../utils/popups/popupStoreUtils';
import { getDisplacement, useSwipeDismiss } from '../../utils/useSwipeDismiss';
import * as DrawerBackdropCssVars from '../backdrop/DrawerBackdropCssVars';
import * as DrawerPopupCssVars from '../popup/DrawerPopupCssVars';
import * as DrawerPopupDataAttributes from '../popup/DrawerPopupDataAttributes';
import { useDrawerProviderContext } from '../provider/DrawerProviderContext';
import { useDrawerRootContext } from '../root/DrawerRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DrawerSwipeAreaProps>(), {
  as: 'div',
  disabled: false,
  swipeDirection: undefined,
  id: undefined,
});

defineSlots<{
  default(props: { state: DrawerSwipeAreaState }): unknown;
  render: ComponentRenderFn<HTMLProps, DrawerSwipeAreaState>;
}>();

const store = useDialogRootContext();
const {
  swipeDirection: rootSwipeDirection,
  frontmostHeight,
  swipeAreaActiveRef,
} = useDrawerRootContext();
const providerContext = useDrawerProviderContext();

const swipeActive = shallowRef(false);
const swipeAreaElement = shallowRef<HTMLElement | null>(null);

let swipeStartEvent: PointerEvent | TouchEvent | null = null;
let openedBySwipe = false;
const dragDelta = { x: 0, y: 0 };
let closedOffset: number | null = null;
let appliedSwipeStyles = false;
let swipePopupElement: HTMLElement | null = null;
let swipeBackdropElement: HTMLElement | null = null;
let popupTransition: string | null = null;
let releaseGuardCleanup: () => void = NOOP;

const swipeAreaId = useVaseUiId(() => props.id);
const { registerTrigger } = useTriggerRegistration(swipeAreaId, store);

const open = computed(() => store.select('open'));

function resetDragDelta() {
  dragDelta.x = 0;
  dragDelta.y = 0;
}

const resolvedSwipeDirection = computed(
  () => props.swipeDirection ?? oppositeSwipeDirection[rootSwipeDirection.value],
);
const dismissDirection = computed(() => oppositeSwipeDirection[resolvedSwipeDirection.value]);
const enabled = computed(() => !props.disabled && (!open.value || swipeActive.value));

function disableDismissForSwipe() {
  releaseGuardCleanup();
  store.context.outsidePressEnabledRef.value = false;
}

function enableDismissAfterRelease() {
  releaseGuardCleanup();

  const doc = ownerDocument(swipeAreaElement.value);

  function restore(event?: MouseEvent) {
    // The gesture's trailing release click is the one physical click with no `pointerdown` of
    // its own. Ignore it and keep waiting, so it cannot dismiss the drawer it just opened,
    // while a click-only activation (keyboard or assistive tech) still re-enables in time.
    if (event?.type === 'click' && event.detail !== 0 && !isVirtualClick(event)) {
      return;
    }

    releaseGuardCleanup = NOOP;
    doc.removeEventListener('pointerdown', restore, true);
    doc.removeEventListener('click', restore, true);
    store.context.outsidePressEnabledRef.value = true;
  }

  // The pointerup that ends a swipe-open gesture synthesizes a `click`. When the drag released
  // outside the popup (e.g. it was dragged past the popup's size), that click would be treated as
  // an outside press and immediately dismiss the drawer that was just opened. Keep outside-press
  // dismissal disabled until the next interaction that isn't that release click: a deliberate
  // outside press starts with a `pointerdown`, and a click-only activation (keyboard or
  // assistive tech) is distinguishable from a physical release. This is deterministic, unlike
  // re-enabling on a timer that can race the synthesized click and dismiss at random.
  //
  // `restore` runs in document capture, ahead of the outside-press check of `useDismiss` (which
  // happens on the event target, after capture), so the triggering press still dismisses.
  releaseGuardCleanup = restore;
  doc.addEventListener('pointerdown', restore, true);
  doc.addEventListener('click', restore, true);
}

function getPopupSize(popupElement: HTMLElement) {
  const isHorizontal = dismissDirection.value === 'left' || dismissDirection.value === 'right';
  const size = isHorizontal ? popupElement.offsetWidth : popupElement.offsetHeight;
  if (size <= 0) {
    return null;
  }

  return size;
}

function resolvePopupSize() {
  const popupElement = store.context.popupRef.value;
  return popupElement ? getPopupSize(popupElement) : null;
}

function resolveClosedOffset(popupElement: HTMLElement) {
  const offset = getPopupSize(popupElement);
  if (offset == null) {
    return null;
  }

  const isHorizontal = dismissDirection.value === 'left' || dismissDirection.value === 'right';
  const transform = getElementTransform(popupElement);
  const transformOffset = isHorizontal ? transform.x : transform.y;
  if (Number.isFinite(transformOffset) && Math.abs(transformOffset) > 0.5) {
    return Math.min(offset, Math.abs(transformOffset));
  }

  return offset;
}

function resolveSwipeOpenThreshold() {
  const popupSize = resolvePopupSize();
  if (popupSize == null) {
    return FALLBACK_SWIPE_OPEN_THRESHOLD;
  }

  return popupSize * DEFAULT_SWIPE_OPEN_RATIO;
}

function applySwipeMovement() {
  const popupElement = store.context.popupRef.value;
  if (!popupElement) {
    return;
  }

  if (!store.select('open') || !store.select('mounted')) {
    return;
  }

  closedOffset ??= resolveClosedOffset(popupElement);
  if (closedOffset === null) {
    return;
  }

  const displacement = getDisplacement(resolvedSwipeDirection.value, dragDelta.x, dragDelta.y);
  const clampedDisplacement = Math.max(0, displacement);
  const dampedDisplacement =
    clampedDisplacement > closedOffset
      ? closedOffset + Math.sqrt(clampedDisplacement - closedOffset)
      : clampedDisplacement;
  const remaining = closedOffset - dampedDisplacement;
  const directionSign =
    dismissDirection.value === 'left' || dismissDirection.value === 'up' ? -1 : 1;
  const movement = remaining * directionSign;
  const isHorizontal = dismissDirection.value === 'left' || dismissDirection.value === 'right';
  const movementX = isHorizontal ? movement : 0;
  const movementY = isHorizontal ? 0 : movement;
  const openProgress = clamp(clampedDisplacement / closedOffset, 0, 1);
  const backdropProgress = clamp(1 - openProgress, 0, 1);

  popupElement.style.setProperty(DrawerPopupCssVars.swipeMovementX, `${movementX}px`);
  popupElement.style.setProperty(DrawerPopupCssVars.swipeMovementY, `${movementY}px`);
  popupElement.setAttribute(DrawerPopupDataAttributes.swiping, '');
  swipePopupElement = popupElement;
  popupTransition ??= popupElement.style.transition;
  popupElement.style.transition = 'none';

  const backdropElement = store.context.backdropRef.value;
  if (backdropElement) {
    backdropElement.setAttribute(DrawerPopupDataAttributes.swiping, '');
    swipeBackdropElement = backdropElement;
    backdropElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, `${backdropProgress}`);
    if (openProgress > 0 && frontmostHeight.value > 0) {
      backdropElement.style.setProperty(DrawerPopupCssVars.height, `${frontmostHeight.value}px`);
    } else {
      backdropElement.style.removeProperty(DrawerPopupCssVars.height);
    }
  }

  providerContext?.visualStateStore.set({
    swipeProgress: openProgress,
    frontmostHeight: openProgress > 0 ? frontmostHeight.value : 0,
  });
  appliedSwipeStyles = true;
  swipeAreaActiveRef.value = true;
}

function clearSwipeStyles() {
  const popupElement = swipePopupElement;
  if (popupElement) {
    popupElement.style.removeProperty(DrawerPopupCssVars.swipeMovementX);
    popupElement.style.removeProperty(DrawerPopupCssVars.swipeMovementY);
    popupElement.removeAttribute(DrawerPopupDataAttributes.swiping);
  }

  if (popupElement && popupTransition !== null) {
    popupElement.style.transition = popupTransition;
    popupTransition = null;
  }

  const backdropElement = swipeBackdropElement;
  if (backdropElement) {
    backdropElement.removeAttribute(DrawerPopupDataAttributes.swiping);
    backdropElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
    backdropElement.style.removeProperty(DrawerPopupCssVars.height);
  }

  providerContext?.visualStateStore.set({ swipeProgress: 0, frontmostHeight: 0 });
  appliedSwipeStyles = false;
  swipePopupElement = null;
  swipeBackdropElement = null;
  swipeAreaActiveRef.value = false;
}

function openDrawer(event?: PointerEvent | TouchEvent) {
  openedBySwipe = true;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- A swipe on the swipe area calls this function, so the element is set.
  store.setOpen(true, createChangeEventDetails(REASONS.swipe, event, swipeAreaElement.value!));
}

function closeDrawer(event?: PointerEvent | TouchEvent) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- A swipe on the swipe area calls this function, so the element is set.
  store.setOpen(false, createChangeEventDetails(REASONS.swipe, event, swipeAreaElement.value!));
}

function resetSwipeInteractionState() {
  swipeStartEvent = null;
  openedBySwipe = false;
  closedOffset = null;
  swipeActive.value = false;
}

function finishSwipeInteraction() {
  resetSwipeInteractionState();
  enableDismissAfterRelease();
  resetDragDelta();
  clearSwipeStyles();
}

const swipe = useSwipeDismiss({
  enabled,
  directions: () => [resolvedSwipeDirection.value],
  elementRef: swipeAreaElement,
  trackDrag: false,
  movementCssVars: {
    x: DrawerPopupCssVars.swipeMovementX,
    y: DrawerPopupCssVars.swipeMovementY,
  },
  onSwipeStart(event) {
    disableDismissForSwipe();
    swipeStartEvent = event;
    openedBySwipe = false;
    swipeActive.value = true;
    resetDragDelta();
  },
  onProgress(_progress, details) {
    if (!details) {
      return;
    }

    if (!swipeStartEvent) {
      return;
    }

    dragDelta.x = details.deltaX;
    dragDelta.y = details.deltaY;

    if (details.direction !== resolvedSwipeDirection.value) {
      return;
    }

    const displacement = getDisplacement(
      resolvedSwipeDirection.value,
      details.deltaX,
      details.deltaY,
    );
    if (!openedBySwipe && displacement < MIN_SWIPE_START_DISTANCE) {
      return;
    }

    if (!openedBySwipe && !store.select('open')) {
      openDrawer(swipeStartEvent);
    }

    applySwipeMovement();
  },
  onRelease({ event, direction, deltaX, deltaY, releaseVelocityX, releaseVelocityY }) {
    const displacement = getDisplacement(resolvedSwipeDirection.value, deltaX, deltaY);
    const releaseVelocity = getDisplacement(
      resolvedSwipeDirection.value,
      releaseVelocityX,
      releaseVelocityY,
    );
    const threshold = resolveSwipeOpenThreshold();
    const hasEnoughDistance = displacement >= threshold;
    const hasEnoughVelocity = releaseVelocity >= VELOCITY_THRESHOLD;
    const shouldOpen =
      direction === resolvedSwipeDirection.value &&
      (hasEnoughDistance || hasEnoughVelocity) &&
      !props.disabled;

    if (shouldOpen) {
      if (!store.select('open')) {
        openDrawer(event);
      }
    } else if (openedBySwipe && store.select('open')) {
      closeDrawer(event);
    }

    finishSwipeInteraction();

    return false;
  },
  onCancel: finishSwipeInteraction,
});

// The commit that opens the drawer re-renders the popup, resetting `--swipe-movement-*` to `0px`
// (the viewport isn't swiping). Re-assert after the DOM mutation but before paint. It must run
// after each render of the swipe area.
onUpdated(() => {
  if (swipeActive.value && appliedSwipeStyles) {
    applySwipeMovement();
  }
});

watch(enabled, (isEnabled) => {
  if (isEnabled) {
    return;
  }

  if (swipeActive.value) {
    enableDismissAfterRelease();
  }
  swipe.reset();
  resetDragDelta();
  clearSwipeStyles();
  resetSwipeInteractionState();
});

function restoreDismiss() {
  releaseGuardCleanup();
  store.context.outsidePressEnabledRef.value = true;
}

// `useSwipeDismiss` ends its own swipe when `KeepAlive` deactivates the element, and it calls no
// `onCancel` then. The swipe area thus ends its gesture here, and it removes the listeners that
// wait for the release click from the document.
onDeactivated(() => {
  if (swipeActive.value) {
    resetSwipeInteractionState();
    resetDragDelta();
    clearSwipeStyles();
  }
  restoreDismiss();
});

onScopeDispose(restoreDismiss);

const state = computed<DrawerSwipeAreaState>(() => ({
  open: open.value,
  swiping: swipe.swiping.value,
  swipeDirection: resolvedSwipeDirection.value,
  disabled: props.disabled,
}));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [
    registerTrigger,
    (swipeArea: HTMLElement | null) => {
      swipeAreaElement.value = swipeArea;
    },
  ],
  stateAttributesMapping,
  props: (attrs) => [
    {
      role: 'presentation',
      'aria-hidden': true,
      style: {
        'pointer-events': enabled.value ? undefined : 'none',
        'touch-action': resolveTouchAction(resolvedSwipeDirection.value),
      },
      onPointerdown(event: PointerEvent) {
        if (event.pointerType === 'touch') {
          return;
        }
        swipe.pointerProps.onPointerdown(event);

        // Prevent native text selection/drag gestures from competing with swipe-open dragging.
        if (event.cancelable) {
          event.preventDefault();
        }
      },
      onPointermove(event: PointerEvent) {
        if (event.pointerType === 'touch') {
          return;
        }
        swipe.pointerProps.onPointermove(event);
      },
      onPointerup(event: PointerEvent) {
        if (event.pointerType === 'touch') {
          return;
        }
        swipe.pointerProps.onPointerup(event);
      },
      onPointercancel(event: PointerEvent) {
        if (event.pointerType === 'touch') {
          return;
        }
        swipe.pointerProps.onPointercancel(event);
      },
    },
    swipe.touchProps,
    { id: swipeAreaId.value },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
