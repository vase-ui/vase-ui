<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { SwipeDirection } from '../../utils/useSwipeDismiss';
import type { ToastObject as ToastObjectType } from '../useToastManager';
import * as ToastRootDataAttributes from './ToastRootDataAttributes';

export type ToastRootToastObject<Data extends object = any> = ToastObjectType<Data>;

export interface ToastRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether the toasts in the viewport are expanded.
   */
  expanded: boolean;
  /**
   * Whether the toast was limited because the toast limit was exceeded.
   */
  limited: boolean;
  /**
   * The type of the toast.
   */
  type: string | undefined;
  /**
   * Whether the toast is being swiped.
   */
  swiping: boolean;
  /**
   * The direction the toast is being swiped.
   */
  swipeDirection: SwipeDirection | undefined;
}

export interface ToastRootProps
  extends VaseUIComponentProps<ToastRootState>, /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The toast to render.
   */
  toast: ToastRootToastObject<any>;
  /**
   * Direction(s) in which the toast can be swiped to dismiss.
   * @default ['down', 'right']
   */
  swipeDirection?: SwipeDirection | SwipeDirection[] | undefined;
}

export const toastRootStateAttributesMapping: StateAttributesMapping<ToastRootState> = {
  ...transitionStatusMapping,
  swipeDirection(value) {
    return value ? { [ToastRootDataAttributes.swipeDirection]: value } : null;
  },
};
</script>

<script setup lang="ts">
import { computed, provide, shallowRef, watch } from 'vue';
import { addEventListener } from '../../common/addEventListener';
import { useListenerSession } from '../../common/useListenerSession';
import { ownerDocument } from '../../common/owner';
import { activeElement, closest, contains, getTarget } from '../../common/shadowDom';
import {
  LEGACY_SWIPE_IGNORE_SELECTOR,
  VASE_UI_SWIPE_IGNORE_SELECTOR,
} from '../../internals/constants';
import { createIdRegistry } from '../../internals/labelable-provider/createIdRegistry';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { useRenderElement } from '../../internals/useRenderElement';
import { getElementTransform } from '../../utils/getElementTransform';
import {
  applyDirectionalDamping,
  getDismissDirection,
  getDisplacement,
  shouldCancelReverseSwipe,
  updateSwipeCancelBaseline,
} from '../../utils/useSwipeDismiss';
import { useToastProviderContext } from '../provider/ToastProviderContext';
import { useToastEscape } from '../utils/useToastEscape';
import { ToastRootContext } from './ToastRootContext';
import * as ToastRootCssVars from './ToastRootCssVars';

const SWIPE_THRESHOLD = 40;
const MIN_DRAG_THRESHOLD = 1;
const TOAST_SWIPE_IGNORE_SELECTOR = `${VASE_UI_SWIPE_IGNORE_SELECTOR},${LEGACY_SWIPE_IGNORE_SELECTOR}`;

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToastRootProps>(), {
  as: 'div',
  swipeDirection: () => ['down', 'right'],
});

defineSlots<{
  default(props: { state: ToastRootState }): unknown;
  render: ComponentRenderFn<HTMLProps, ToastRootState>;
}>();

const store = useToastProviderContext();

const isAnchored = computed(() => props.toast.positionerProps?.anchor !== undefined);

const swipeDirections = computed<SwipeDirection[]>(() => {
  if (isAnchored.value) {
    return [];
  }
  return Array.isArray(props.swipeDirection) ? props.swipeDirection : [props.swipeDirection];
});

const currentSwipeDirection = shallowRef<SwipeDirection>();
const activePointerId = shallowRef<number | null>(null);
const isSwiping = computed(() => activePointerId.value !== null);
const dragOffset = shallowRef({ x: 0, y: 0 });
const initialTransform = shallowRef({ x: 0, y: 0, scale: 1 });
let lockedDirection: 'horizontal' | 'vertical' | null = null;
let isRealSwipe = false;

const { ids: titleIds, registerId: registerTitleId } = createIdRegistry();
const { ids: descriptionIds, registerId: registerDescriptionId } = createIdRegistry();
const titleId = computed(() => titleIds.value.at(-1));
const descriptionId = computed(() => descriptionIds.value.at(-1));

let dragStartPos = { x: 0, y: 0 };
let intendedSwipeDirection: SwipeDirection | undefined;
let maxSwipeDisplacement = 0;
let cancelledSwipe = false;
let swipeCancelBaseline = { x: 0, y: 0 };
let isFirstPointerMove = false;

const domIndex = computed(() => store.select('toastIndex', props.toast.id));
const visibleIndex = computed(() => store.select('toastVisibleIndex', props.toast.id));
const offsetY = computed(() => store.select('toastOffsetY', props.toast.id));
const expanded = computed(() => store.select('expanded'));

const state = computed<ToastRootState>(() => ({
  transitionStatus: props.toast.transitionStatus,
  expanded: expanded.value,
  limited: props.toast.limited || false,
  type: props.toast.type,
  swiping: isSwiping.value,
  swipeDirection: currentSwipeDirection.value,
}));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: toastRootStateAttributesMapping,
  props: (attrs) => {
    const swiping = swipeDirections.value.length > 0;
    const highPriority = props.toast.priority === 'high';
    // WAI-ARIA requires a name for a `dialog` and an `alertdialog`. A toast with no title and no
    // name from the consumer thus takes its name from its description (VUE-99).
    const namedByDescription = titleId.value === undefined && !hasConsumerName(attrs);

    return [
      {
        role: highPriority ? 'alertdialog' : 'dialog',
        tabindex: 0,
        'aria-modal': false,
        'aria-labelledby': namedByDescription ? descriptionId.value : titleId.value,
        'aria-describedby': namedByDescription ? undefined : descriptionId.value,
        'aria-hidden': highPriority && !store.select('focused') ? true : undefined,
        onPointerdown: swiping ? handlePointerdown : undefined,
        onPointermove: swiping ? handlePointermove : undefined,
        onPointerup: swiping ? handleSwipeEnd : undefined,
        onPointercancel: swiping ? handleSwipeEnd : undefined,
        onTouchmove: swiping ? handleTouchmove : undefined,
        onKeydown: handleKeydown,
        inert: props.toast.limited ? true : undefined,
        style: {
          ...getDragStyles(),
          [ToastRootCssVars.index]:
            props.toast.transitionStatus === 'ending' ? domIndex.value : visibleIndex.value,
          [ToastRootCssVars.offsetY]: `${offsetY.value}px`,
          [ToastRootCssVars.height]: props.toast.height ? `${props.toast.height}px` : undefined,
        },
      },
      attrs,
    ];
  },
});

function hasConsumerName(attrs: Record<string, unknown>) {
  // `attrs` has no key for an attribute whose value is `undefined` (VUE-103), and none for a blank
  // `aria-label` or `aria-labelledby` (VUE-106). An `aria-labelledby` of `null` removes the value
  // of the root. The consumer chose to remove the name, so the description does not take its place.
  return Object.hasOwn(attrs, 'aria-labelledby') || typeof attrs['aria-label'] === 'string';
}

useOpenChangeComplete({
  open: () => props.toast.transitionStatus !== 'ending',
  ref: element,
  onComplete() {
    if (props.toast.transitionStatus === 'ending') {
      store.removeToast(props.toast.id);
    }
  },
});

const { isHeld } = useKeepAliveState();
const isToastEscape = useToastEscape(() => element.value, isHeld);
const press = useListenerSession(isHeld);
watch([element, () => props.toast.id], press.stop, { flush: 'sync' });

function recalculateHeight() {
  const rootElement = element.value;
  if (!rootElement || isHeld.value) {
    return;
  }

  const previousHeight = rootElement.style.height;
  rootElement.style.height = 'auto';

  const height = rootElement.offsetHeight;

  rootElement.style.height = previousHeight;

  store.updateToastInternal(props.toast.id, {
    ref: element,
    height,
    transitionStatus: undefined,
  });
}

provide(ToastRootContext, {
  toast: computed(() => props.toast),
  registerTitleId,
  registerDescriptionId,
  recalculateHeight,
  visibleIndex,
  expanded,
});

watch(
  [element, () => props.toast.id, () => props.toast.transitionStatus, isHeld],
  ([node, id, status, held], [oldNode, oldId, , wasHeld]) => {
    if (!node || held) return;
    if (node === oldNode && id === oldId && status !== 'starting' && !wasHeld) return;

    // A new toast can reuse a root whose last swipe still supplies the exit styles.
    if (oldId !== id || status === 'starting') {
      currentSwipeDirection.value = undefined;
      initialTransform.value = { x: 0, y: 0, scale: 1 };
      dragOffset.value = { x: 0, y: 0 };
    }
    recalculateHeight();
  },
  { flush: 'post' },
);

function handleSwipeEnd(event: PointerEvent) {
  if (event.pointerId !== activePointerId.value) return;

  const offset = dragOffset.value;
  const direction =
    event.type !== 'pointercancel' && !cancelledSwipe
      ? getDismissDirection(
          swipeDirections.value,
          offset.x - initialTransform.value.x,
          offset.y - initialTransform.value.y,
          SWIPE_THRESHOLD,
        )
      : undefined;

  press.stop();
  if (direction) {
    dragOffset.value = offset;
    currentSwipeDirection.value = direction;
    store.closeToast(props.toast.id);
  }
}

function handlePointerdown(event: PointerEvent) {
  if (event.button !== 0 || isHeld.value) {
    return;
  }

  if (event.pointerType === 'touch') {
    store.pauseTimers();
  }

  const target = getTarget(event) as HTMLElement | null;

  const isInteractiveElement = closest(
    target,
    `button,a,input,textarea,[role="button"],${TOAST_SWIPE_IGNORE_SELECTOR}`,
  );

  if (isInteractiveElement) {
    return;
  }

  const rootElement = event.currentTarget as HTMLElement;
  const doc = ownerDocument(rootElement);
  press.start((onCleanup) => {
    activePointerId.value = event.pointerId;
    cancelledSwipe = false;
    intendedSwipeDirection = undefined;
    maxSwipeDisplacement = 0;
    dragStartPos = { x: event.clientX, y: event.clientY };
    swipeCancelBaseline = dragStartPos;
    initialTransform.value = getElementTransform(rootElement);
    dragOffset.value = { x: initialTransform.value.x, y: initialTransform.value.y };
    store.set('hovering', true);
    isRealSwipe = false;
    lockedDirection = null;
    isFirstPointerMove = true;

    onCleanup(addEventListener(doc, 'pointerup', handleSwipeEnd));
    onCleanup(addEventListener(doc, 'pointercancel', handleSwipeEnd));
    onCleanup(() => {
      activePointerId.value = null;
      dragOffset.value = { x: initialTransform.value.x, y: initialTransform.value.y };
      currentSwipeDirection.value = undefined;
    });
  });

  try {
    rootElement.setPointerCapture(event.pointerId);
  } catch {
    // Firefox throws `NotFoundError` for a pointer that is not active, such as the pointer id of a
    // dispatched event. The swipe goes on with no capture, and the listeners of the document end it.
  }
}

function handlePointermove(event: PointerEvent) {
  if (event.pointerId !== activePointerId.value) {
    return;
  }

  // Prevent text selection on Safari
  event.preventDefault();

  if (isFirstPointerMove) {
    // Adjust the starting position to the current position on the first move
    // to account for the delay between pointerdown and the first pointermove on iOS.
    dragStartPos = { x: event.clientX, y: event.clientY };
    isFirstPointerMove = false;
  }

  const { clientY, clientX, movementX, movementY } = event;
  const directions = swipeDirections.value;

  swipeCancelBaseline = updateSwipeCancelBaseline(
    swipeCancelBaseline,
    { x: clientX, y: clientY },
    { x: movementX, y: movementY },
  );

  const deltaX = clientX - dragStartPos.x;
  const deltaY = clientY - dragStartPos.y;
  const cancelDeltaY = clientY - swipeCancelBaseline.y;
  const cancelDeltaX = clientX - swipeCancelBaseline.x;

  const hasHorizontal = directions.includes('left') || directions.includes('right');
  const hasVertical = directions.includes('up') || directions.includes('down');

  if (!isRealSwipe && Math.hypot(deltaX, deltaY) >= MIN_DRAG_THRESHOLD) {
    isRealSwipe = true;
    if (hasHorizontal && hasVertical) {
      lockedDirection = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
    }
  }

  if (!intendedSwipeDirection) {
    let candidate: SwipeDirection | undefined;
    if (lockedDirection === 'vertical') {
      if (deltaY !== 0) {
        candidate = deltaY > 0 ? 'down' : 'up';
      }
    } else if (lockedDirection === 'horizontal') {
      if (deltaX !== 0) {
        candidate = deltaX > 0 ? 'right' : 'left';
      }
    } else if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      candidate = deltaX > 0 ? 'right' : 'left';
    } else {
      candidate = deltaY > 0 ? 'down' : 'up';
    }

    if (candidate && directions.includes(candidate)) {
      intendedSwipeDirection = candidate;
      maxSwipeDisplacement = getDisplacement(candidate, deltaX, deltaY);
      currentSwipeDirection.value = candidate;
    }
  } else {
    const direction = intendedSwipeDirection;
    const currentDisplacement = getDisplacement(direction, cancelDeltaX, cancelDeltaY);

    if (currentDisplacement > SWIPE_THRESHOLD) {
      cancelledSwipe = false;
      currentSwipeDirection.value = direction;
    } else if (shouldCancelReverseSwipe(directions, maxSwipeDisplacement, currentDisplacement)) {
      cancelledSwipe = true;
    }
  }

  const dampedDelta = applyDirectionalDamping(deltaX, deltaY, directions);
  let newOffsetX = initialTransform.value.x;
  let newOffsetY = initialTransform.value.y;

  if (lockedDirection !== 'vertical' && hasHorizontal) {
    newOffsetX += dampedDelta.x;
  }

  if (lockedDirection !== 'horizontal' && hasVertical) {
    newOffsetY += dampedDelta.y;
  }

  dragOffset.value = { x: newOffsetX, y: newOffsetY };
}

function handleKeydown(event: KeyboardEvent) {
  const root = element.value;
  if (!isToastEscape(event) || !root || !contains(root, activeElement(ownerDocument(root)))) return;

  const isEnding = props.toast.transitionStatus === 'ending';
  store.closeToast(props.toast.id);
  // Only the toast that closes can claim Escape from a popup below it.
  if (!isEnding) event.stopPropagation();
}

function handleTouchmove(event: TouchEvent) {
  if (
    activePointerId.value === null ||
    !contains(element.value, getTarget(event) as HTMLElement | null)
  ) {
    return;
  }

  // The `preventDefault` of `pointermove` is not enough on iOS. This `touchmove` listener, which
  // is not passive, blocks native scrolling while dragging.
  event.preventDefault();
}

function getDragStyles() {
  const deltaX = dragOffset.value.x - initialTransform.value.x;
  const deltaY = dragOffset.value.y - initialTransform.value.y;

  return {
    transition: isSwiping.value ? 'none' : undefined,
    // While swiping, freeze the element at its current visual transform so it doesn't snap to the
    // end position.
    transform: isSwiping.value
      ? `translateX(${dragOffset.value.x}px) translateY(${dragOffset.value.y}px) scale(${initialTransform.value.scale})`
      : undefined,
    [ToastRootCssVars.swipeMovementX]: `${deltaX}px`,
    [ToastRootCssVars.swipeMovementY]: `${deltaY}px`,
  };
}

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
