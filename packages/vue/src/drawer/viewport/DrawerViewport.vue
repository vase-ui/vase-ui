<script lang="ts">
import type { HTMLAttributes } from 'vue';
import { isElement } from '@floating-ui/utils/dom';
import { ownerWindow } from '../../common/owner';
import { activeElement, closest, contains } from '../../common/shadowDom';
import {
  VASE_UI_SWIPE_IGNORE_ATTRIBUTE,
  VASE_UI_SWIPE_IGNORE_SELECTOR,
} from '../../internals/constants';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { ScrollAxis } from '../../utils/scrollable';
import type { SwipeDirection } from '../../utils/useSwipeDismiss';
import { DRAWER_CONTENT_ATTRIBUTE } from '../content/drawerContentAttribute';
import * as DrawerPopupDataAttributes from '../popup/DrawerPopupDataAttributes';

export interface DrawerViewportState {
  /**
   * Whether the drawer is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether the drawer is nested within another drawer.
   */
  nested: boolean;
  /**
   * Whether the drawer has nested drawers open.
   */
  nestedDialogOpen: boolean;
}

export interface DrawerViewportProps
  extends
    VaseUIComponentProps<DrawerViewportState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}

const MIN_SWIPE_THRESHOLD = 10;
const FAST_SWIPE_VELOCITY = 0.5;
const SNAP_VELOCITY_THRESHOLD = 0.5;
const SNAP_VELOCITY_MULTIPLIER = 300;
const MAX_SNAP_VELOCITY = 4;
const MIN_SWIPE_RELEASE_VELOCITY = 0.2;
const MAX_SWIPE_RELEASE_VELOCITY = 4;
const MIN_SWIPE_RELEASE_DURATION_MS = 80;
const MAX_SWIPE_RELEASE_DURATION_MS = 360;
const MIN_SWIPE_RELEASE_SCALAR = 0.1;
const MAX_SWIPE_RELEASE_SCALAR = 1;
const AXIS_LOCK_SLOP = 6;
const AXIS_LOCK_BIAS = 2;
const DRAWER_CONTENT_SELECTOR = `[${DRAWER_CONTENT_ATTRIBUTE}]`;
const AXIS_SWIPE_IGNORE_SELECTORS: Record<ScrollAxis, string> = {
  horizontal: `[${VASE_UI_SWIPE_IGNORE_ATTRIBUTE}="x"]`,
  vertical: `[${VASE_UI_SWIPE_IGNORE_ATTRIBUTE}="y"]`,
};

interface TouchScrollState {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startedInPopup: boolean;
  scrollTarget: HTMLElement | null;
  hasCrossAxisGestureTarget: boolean;
  allowSwipe: boolean | null;
  preserveNativeCrossAxisScroll: boolean;
  drawerAxisAttributed: boolean;
}

function setBackdropSwipingAttribute(backdropElement: HTMLElement | null, swiping: boolean) {
  backdropElement?.toggleAttribute(DrawerPopupDataAttributes.swiping, swiping);
}

function isSwipeIgnoredTarget(target: Element | null): boolean {
  return Boolean(closest(target, VASE_UI_SWIPE_IGNORE_SELECTOR));
}

function isDrawerContentTarget(target: Element | null): boolean {
  return Boolean(closest(target, DRAWER_CONTENT_SELECTOR));
}

function getBaseSwipeSize(element: HTMLElement, direction: SwipeDirection): number {
  return direction === 'left' || direction === 'right' ? element.offsetWidth : element.offsetHeight;
}

function getBaseSwipeThreshold(element: HTMLElement, direction: SwipeDirection): number {
  return Math.max(getBaseSwipeSize(element, direction) * 0.5, MIN_SWIPE_THRESHOLD);
}

function resolveBaseSwipeThreshold(details: { element: HTMLElement; direction: SwipeDirection }) {
  return getBaseSwipeThreshold(details.element, details.direction);
}

function isRangeInput(
  target: EventTarget | null,
  win: ReturnType<typeof ownerWindow>,
): target is HTMLInputElement {
  return target instanceof win.HTMLInputElement && target.type === 'range';
}

function isTextSelectionControl(target: Element): target is HTMLInputElement | HTMLTextAreaElement {
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
}

function hasExpandedSelectionWithinTarget(selection: Selection, target: Element): boolean {
  const anchorElement = isElement(selection.anchorNode)
    ? selection.anchorNode
    : selection.anchorNode?.parentElement;
  const focusElement = isElement(selection.focusNode)
    ? selection.focusNode
    : selection.focusNode?.parentElement;

  return (
    selection.containsNode(target, true) ||
    contains(target, anchorElement) ||
    contains(target, focusElement)
  );
}

function shouldIgnoreSwipeForTextSelection(doc: Document, rootElement: HTMLElement): boolean {
  const activeEl = activeElement(doc);
  if (activeEl && contains(rootElement, activeEl) && isTextSelectionControl(activeEl)) {
    const { selectionStart, selectionEnd } = activeEl;
    if (selectionStart != null && selectionEnd != null && selectionStart < selectionEnd) {
      return true;
    }
  }

  const selection = doc.getSelection?.();
  if (!selection || selection.isCollapsed) {
    return false;
  }

  return hasExpandedSelectionWithinTarget(selection, rootElement);
}

function isTouchEventOnRangeInput(event: TouchEvent): boolean {
  const win = ownerWindow(event.currentTarget as Element);
  return event.composedPath().some((pathTarget) => isRangeInput(pathTarget, win));
}

function updateTouchScrollPosition(touchState: TouchScrollState, touch: Touch): void {
  touchState.lastX = touch.clientX;
  touchState.lastY = touch.clientY;
}

/**
 * Arbitrates a touchmove between the drawer swipe and a cross-axis gesture: a native scroll, or an
 * element marked with the cross-axis `data-vase-ui-swipe-ignore` value.
 * Returns `true` when the move must be left alone — either because the cross axis already won the
 * gesture, or because neither axis has passed the slop yet and the gesture cannot be attributed.
 */
function shouldYieldTouchMove(
  touchState: TouchScrollState,
  event: TouchEvent,
  touch: Touch,
  isVerticalScrollAxis: boolean,
): boolean {
  if (touchState.preserveNativeCrossAxisScroll) {
    return true;
  }

  // Attribution happens once per gesture. Re-arbitrating after the drawer axis has won would let
  // the pre-attribution branches below fire mid-drag (the slop is measured from the touch origin,
  // which is never re-baselined), freezing the popup and dropping `preventDefault()`.
  if (
    touchState.drawerAxisAttributed ||
    touchState.allowSwipe === true ||
    !touchState.hasCrossAxisGestureTarget
  ) {
    return false;
  }

  // A non-cancelable touchmove means the browser has already committed the gesture to a native
  // scroll; claiming it for the swipe would drag the popup alongside the scrolling content.
  if (!event.cancelable) {
    touchState.preserveNativeCrossAxisScroll = true;
    return true;
  }

  const drawerAxisGestureDelta = isVerticalScrollAxis
    ? touch.clientY - touchState.startY
    : touch.clientX - touchState.startX;
  const crossAxisGestureDelta = isVerticalScrollAxis
    ? touch.clientX - touchState.startX
    : touch.clientY - touchState.startY;
  const absDrawerAxisGestureDelta = Math.abs(drawerAxisGestureDelta);
  const absCrossAxisGestureDelta = Math.abs(crossAxisGestureDelta);

  if (
    absCrossAxisGestureDelta >= AXIS_LOCK_SLOP &&
    absCrossAxisGestureDelta > absDrawerAxisGestureDelta + AXIS_LOCK_BIAS
  ) {
    touchState.preserveNativeCrossAxisScroll = true;
    return true;
  }

  if (absDrawerAxisGestureDelta >= AXIS_LOCK_SLOP) {
    touchState.drawerAxisAttributed = true;
    return false;
  }

  // Neither axis has traveled past the slop yet, so the gesture cannot be attributed. Leave the
  // event alone: on iOS, `preventDefault()` on the first cancelable touchmove cancels native
  // scrolling for the entire gesture, which would lock a cross-axis scroll that only passes the
  // slop on a later move.
  return true;
}

function getScrollMetrics(scrollTarget: HTMLElement, axis: ScrollAxis) {
  if (axis === 'vertical') {
    const max = Math.max(0, scrollTarget.scrollHeight - scrollTarget.clientHeight);
    return { offset: scrollTarget.scrollTop, max };
  }

  const max = Math.max(0, scrollTarget.scrollWidth - scrollTarget.clientWidth);
  return { offset: scrollTarget.scrollLeft, max };
}

function hasScrollableContentOnAxis(scrollTarget: HTMLElement, axis: ScrollAxis): boolean {
  return getScrollMetrics(scrollTarget, axis).max > 0;
}

function shouldDismissFromStartEdge(direction: SwipeDirection, axis: ScrollAxis): boolean {
  return axis === 'vertical' ? direction === 'down' : direction === 'right';
}

function isAtSwipeStartEdge(
  scrollTarget: HTMLElement,
  axis: ScrollAxis,
  direction: SwipeDirection,
): boolean {
  const dismissFromStartEdge = shouldDismissFromStartEdge(direction, axis);
  const { offset, max } = getScrollMetrics(scrollTarget, axis);
  return dismissFromStartEdge ? offset <= 0 : offset >= max;
}

function canSwipeFromScrollEdgeOnMove(
  scrollTarget: HTMLElement,
  axis: ScrollAxis,
  direction: SwipeDirection,
  delta: number,
): boolean {
  const dismissFromStartEdge = shouldDismissFromStartEdge(direction, axis);
  const movingTowardDismiss = dismissFromStartEdge ? delta > 0 : delta < 0;
  if (!movingTowardDismiss) {
    return false;
  }

  return isAtSwipeStartEdge(scrollTarget, axis, direction);
}
</script>

<script setup lang="ts">
import {
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  onScopeDispose,
  provide,
  shallowRef,
  useAttrs,
  useTemplateRef,
  watch,
} from 'vue';
import { addEventListener } from '../../common/addEventListener';
import { clamp } from '../../common/clamp';
import { NOOP } from '../../common/empty';
import { ownerDocument } from '../../common/owner';
import { getTarget } from '../../common/shadowDom';
import { useAnimationFrame } from '../../common/useAnimationFrame';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import DialogViewport from '../../dialog/viewport/DialogViewport.vue';
import * as DialogViewportDataAttributes from '../../dialog/viewport/DialogViewportDataAttributes';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import * as TransitionStatusDataAttributes from '../../internals/TransitionStatusDataAttributes';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { mergeProps } from '../../merge-props';
import { getElementAtPoint } from '../../utils/getElementAtPoint';
import { findScrollableTouchTarget } from '../../utils/scrollable';
import { getDisplacement, useSwipeDismiss } from '../../utils/useSwipeDismiss';
import type { UseSwipeDismissProgressDetails } from '../../utils/useSwipeDismiss';
import * as DrawerBackdropCssVars from '../backdrop/DrawerBackdropCssVars';
import * as DrawerPopupCssVars from '../popup/DrawerPopupCssVars';
import { useDrawerProviderContext } from '../provider/DrawerProviderContext';
import { useDrawerRootContext } from '../root/DrawerRootContext';
import type { DrawerSnapPoint } from '../root/DrawerRootContext';
import {
  closestSnapPointIndex,
  getSnapPointSwipeMovement,
  useDrawerSnapPoints,
} from '../root/useDrawerSnapPoints';
import type { ResolvedDrawerSnapPoint } from '../root/useDrawerSnapPoints';
import { DrawerViewportContext } from './DrawerViewportContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DrawerViewportProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: DrawerViewportState }): unknown;
  render: ComponentRenderFn<HTMLProps, DrawerViewportState>;
}>();

const attrs = useAttrs();
const store = useDialogRootContext();
const popupRef = store.context.popupRef;
const backdropRef = store.context.backdropRef;

const {
  swipeDirection,
  notifyParentSwipingChange,
  notifyParentSwipeProgressChange,
  frontmostHeight,
  snapToSequentialPoints,
  swipeAreaActiveRef,
} = useDrawerRootContext();
const providerContext = useDrawerProviderContext();
const {
  snapPoints,
  resolvedSnapPoints,
  activeSnapPoint,
  activeSnapPointOffset,
  setActiveSnapPoint,
  popupHeight,
} = useDrawerSnapPoints();

const open = computed(() => store.select('open'));
const mounted = computed(() => store.select('mounted'));
const nested = computed(() => store.select('nested'));
const nestedDrawerOpen = computed(() => store.select('nestedOpenDrawerCount') > 0);

const visualStateStore = providerContext?.visualStateStore;
const scrollAxis = computed<ScrollAxis>(() =>
  swipeDirection.value === 'left' || swipeDirection.value === 'right' ? 'horizontal' : 'vertical',
);
const isVerticalScrollAxis = computed(() => scrollAxis.value === 'vertical');
const crossScrollAxis = computed<ScrollAxis>(() =>
  isVerticalScrollAxis.value ? 'horizontal' : 'vertical',
);

const swipeRelease = shallowRef<number | null>(null);

let pendingSwipeCloseSnapPoint: DrawerSnapPoint | null | undefined;
const controlledDismissFrame = useAnimationFrame();

let swiping = false;
let nestedSwipeActive = false;
let lastPointerType = '';
let ignoreNextTouchStartFromPen = false;
let ignoreTouchSwipe = false;
let touchScrollState: TouchScrollState | null = null;

const snapPointRange = computed(() => {
  const points = snapPoints.value;
  if (
    !points ||
    points.length < 2 ||
    resolvedSnapPoints.value.length < 2 ||
    (swipeDirection.value !== 'down' && swipeDirection.value !== 'up')
  ) {
    return null;
  }

  const offsets = resolvedSnapPoints.value.map((point) => point.offset).sort((a, b) => a - b);

  const minOffset = offsets[0];
  const nextOffset = offsets[1];
  const range = nextOffset - minOffset;

  return { minOffset, range };
});

const snapPointProgress = computed(() => {
  const range = snapPointRange.value;
  if (!range || activeSnapPointOffset.value === null) {
    return null;
  }

  return clamp((activeSnapPointOffset.value - range.minOffset) / range.range, 0, 1);
});

const swipeDirections = computed<SwipeDirection[]>(() => {
  const points = snapPoints.value;
  if (
    points &&
    points.length > 0 &&
    (swipeDirection.value === 'down' || swipeDirection.value === 'up')
  ) {
    return swipeDirection.value === 'down' ? ['down', 'up'] : ['up', 'down'];
  }

  return [swipeDirection.value];
});

function hasSnapPoints() {
  return Boolean(snapPoints.value && snapPoints.value.length > 0);
}

function setSwipeDismissed(dismissed: boolean) {
  popupRef.value?.toggleAttribute(DrawerPopupDataAttributes.swipeDismiss, dismissed);
  backdropRef.value?.toggleAttribute(DrawerPopupDataAttributes.swipeDismiss, dismissed);
}

function clearSwipeRelease() {
  setSwipeDismissed(false);
  popupRef.value?.removeAttribute(TransitionStatusDataAttributes.endingStyle);
  swipeRelease.value = null;
}

function finishNestedSwipe() {
  if (!nestedSwipeActive) {
    return;
  }

  nestedSwipeActive = false;
  notifyParentSwipingChange?.(false);
}

function applySwipeProgress(
  resolvedProgress: number,
  shouldTrackProgress: boolean,
  notifyParent: boolean,
) {
  const isActive = open.value && !nested.value && shouldTrackProgress;
  const swipeProgress = isActive ? resolvedProgress : 0;
  const nestedSwipeProgress = open.value && shouldTrackProgress ? resolvedProgress : 0;

  if (notifyParent && notifyParentSwipeProgressChange) {
    notifyParentSwipeProgressChange(nestedSwipeProgress);

    if (nestedSwipeProgress <= 0) {
      finishNestedSwipe();
    }
  }

  visualStateStore?.set({
    swipeProgress,
    frontmostHeight: swipeProgress > 0 ? frontmostHeight.value : 0,
  });

  const backdropElement = backdropRef.value;
  if (!backdropElement) {
    return;
  }

  const showProgress = isActive && swipeProgress > 0;
  backdropElement.style.setProperty(
    DrawerBackdropCssVars.swipeProgress,
    showProgress ? `${swipeProgress}` : '0',
  );
  if (showProgress && frontmostHeight.value > 0) {
    backdropElement.style.setProperty(DrawerPopupCssVars.height, `${frontmostHeight.value}px`);
  } else {
    backdropElement.style.removeProperty(DrawerPopupCssVars.height);
  }
}

function resolveSwipeRelease(
  popupElement: HTMLElement,
  direction: SwipeDirection,
  deltaX: number,
  deltaY: number,
  velocityX: number,
  velocityY: number,
  releaseVelocityX: number,
  releaseVelocityY: number,
): number | null {
  const size = getBaseSwipeSize(popupElement, direction);
  if (size <= 0) {
    return null;
  }

  // The snap point base offset shifts the popup along the dismiss direction for both
  // `down` (+offset) and `up` (-offset), so it always adds to the directional translation.
  const snapPointBaseOffset =
    (direction === 'down' || direction === 'up') && hasSnapPoints()
      ? (activeSnapPointOffset.value ?? 0)
      : 0;
  const translationAlongDirection =
    snapPointBaseOffset + getDisplacement(direction, deltaX, deltaY);
  const remainingDistance = Math.max(0, size - translationAlongDirection);
  if (remainingDistance <= 0) {
    return null;
  }

  const releaseVelocity = getDisplacement(direction, releaseVelocityX, releaseVelocityY);
  const directionalVelocity =
    Math.abs(releaseVelocity) > 0
      ? releaseVelocity
      : getDisplacement(direction, velocityX, velocityY);
  if (directionalVelocity <= MIN_SWIPE_RELEASE_VELOCITY) {
    return null;
  }

  const clampedVelocity = clamp(
    directionalVelocity,
    MIN_SWIPE_RELEASE_VELOCITY,
    MAX_SWIPE_RELEASE_VELOCITY,
  );
  // The gesture hook supplies finite deltas and velocities. The guards above keep the remaining
  // distance and divisor positive, so the duration stays within [MIN, MAX] and the resulting
  // scalar within (0, 1].
  const durationMs = clamp(
    remainingDistance / clampedVelocity,
    MIN_SWIPE_RELEASE_DURATION_MS,
    MAX_SWIPE_RELEASE_DURATION_MS,
  );
  const normalizedDuration =
    (durationMs - MIN_SWIPE_RELEASE_DURATION_MS) /
    (MAX_SWIPE_RELEASE_DURATION_MS - MIN_SWIPE_RELEASE_DURATION_MS);
  return (
    MIN_SWIPE_RELEASE_SCALAR +
    normalizedDuration * (MAX_SWIPE_RELEASE_SCALAR - MIN_SWIPE_RELEASE_SCALAR)
  );
}

function updateNestedSwipeActive(details?: UseSwipeDismissProgressDetails) {
  if (nestedSwipeActive || !details) {
    return;
  }

  const direction = details.direction ?? swipeDirection.value;
  const delta = getDisplacement(direction, details.deltaX, details.deltaY);
  if (Math.abs(delta) < MIN_SWIPE_THRESHOLD) {
    return;
  }

  nestedSwipeActive = true;
  notifyParentSwipingChange?.(true);
}

const swipe = useSwipeDismiss({
  enabled: () => mounted.value && !nestedDrawerOpen.value,
  directions: swipeDirections,
  elementRef: popupRef,
  ignoreSelectorWhenTouch: false,
  ignoreScrollableAncestors: true,
  movementCssVars: {
    x: DrawerPopupCssVars.swipeMovementX,
    y: DrawerPopupCssVars.swipeMovementY,
  },
  onSwipeStart(event) {
    if ('touches' in event || event.pointerType === 'touch') {
      return;
    }

    const popupElement = popupRef.value;

    const doc = ownerDocument(popupElement);
    const selection = doc.getSelection?.();
    if (!selection || selection.isCollapsed) {
      return;
    }

    const anchorElement = isElement(selection.anchorNode)
      ? selection.anchorNode
      : selection.anchorNode?.parentElement;
    const focusElement = isElement(selection.focusNode)
      ? selection.focusNode
      : selection.focusNode?.parentElement;

    if (!contains(popupElement, anchorElement) && !contains(popupElement, focusElement)) {
      return;
    }

    selection.removeAllRanges();
  },
  onSwipingChange(nextSwiping) {
    swiping = nextSwiping;
    setBackdropSwipingAttribute(backdropRef.value, nextSwiping);

    if (!nextSwiping && !notifyParentSwipeProgressChange) {
      finishNestedSwipe();
    }
  },
  swipeThreshold: () => resolveBaseSwipeThreshold,
  canStart(position, details) {
    const popupElement = popupRef.value;
    if (!popupElement) {
      return false;
    }

    const nativeEvent = details.nativeEvent;
    const touchLike = 'touches' in nativeEvent || nativeEvent.pointerType === 'touch';
    const touchState = touchLike ? touchScrollState : null;

    const doc = popupElement.ownerDocument;
    const elementAtPoint = getElementAtPoint(popupElement.getRootNode(), position.x, position.y);
    // Activation can be deferred until after a touch that started inside has left the popup.
    if (!touchState?.startedInPopup && !contains(popupElement, elementAtPoint)) {
      return false;
    }

    if (touchLike && shouldIgnoreSwipeForTextSelection(doc, popupElement)) {
      return false;
    }

    // Over a cross-axis gesture target, stay pending until the drawer axis wins the gesture.
    // Starting on touchstart would leave the drawer swiping (and settling on release) while the
    // cross-axis target handles the drag.
    if (
      touchState?.hasCrossAxisGestureTarget &&
      !touchState.drawerAxisAttributed &&
      touchState.allowSwipe !== true
    ) {
      return false;
    }

    return true;
  },
  onProgress(progress, details) {
    if (swiping) {
      updateNestedSwipeActive(details);
    }

    if (swiping && swipeDirection.value === 'down' && hasSnapPoints() && details) {
      const popupElement = popupRef.value;
      if (popupElement) {
        popupElement.style.removeProperty('transform');
        popupElement.style.setProperty(
          DrawerPopupCssVars.swipeMovementY,
          `${getSnapPointSwipeMovement(activeSnapPointOffset.value ?? 0, details.deltaY)}px`,
        );
      }
    }

    let resolvedProgress = progress;
    const range = snapPointRange.value;
    if (range && popupHeight.value > 0) {
      const baseOffset = activeSnapPointOffset.value ?? range.minOffset;
      const offsetToProgress = (nextOffset: number) =>
        clamp((nextOffset - range.minOffset) / range.range, 0, 1);

      // Outside a drag the hook still reports the last drag deltas, both after a release and
      // on a gesture that never started (e.g. a press inside `Drawer.Content`). Recomputing
      // from them would re-apply drag progress to a drawer that rests on its snap point.
      if (swiping && details && Number.isFinite(details.deltaY)) {
        resolvedProgress = offsetToProgress(
          clamp(baseOffset + details.deltaY, 0, popupHeight.value),
        );
      } else if (snapPointProgress.value !== null) {
        resolvedProgress = snapPointProgress.value;
      }
    }

    // A parent drawer follows an active drag only, so drop it back to zero once the drag ends.
    if (!swiping) {
      notifyParentSwipeProgressChange?.(0);
      finishNestedSwipe();
    }

    applySwipeProgress(resolvedProgress, true, swiping);
  },
  onRelease({
    event,
    deltaX,
    deltaY,
    direction,
    velocityX,
    velocityY,
    releaseVelocityX,
    releaseVelocityY,
  }) {
    const popupElement = popupRef.value;
    if (!popupElement) {
      clearSwipeRelease();
      return undefined;
    }
    const releasePopupElement = popupElement;

    function startSwipeRelease(resolvedDirection: SwipeDirection) {
      // Start ending transition styles earlier and synchronously to prevent a period where
      // the popup appears stuck on release before the actual closing animation starts.
      finishNestedSwipe();
      setSwipeDismissed(true);

      releasePopupElement.style.removeProperty('transition');
      releasePopupElement.setAttribute(TransitionStatusDataAttributes.endingStyle, '');
      swipeRelease.value = resolveSwipeRelease(
        releasePopupElement,
        resolvedDirection,
        deltaX,
        deltaY,
        velocityX,
        velocityY,
        releaseVelocityX,
        releaseVelocityY,
      );
    }

    if (!hasSnapPoints()) {
      if (!direction) {
        clearSwipeRelease();
        return undefined;
      }

      const directionalDelta = getDisplacement(direction, deltaX, deltaY);
      if (directionalDelta <= 0) {
        clearSwipeRelease();
        return false;
      }

      if (getDisplacement(direction, velocityX, velocityY) >= FAST_SWIPE_VELOCITY) {
        startSwipeRelease(direction);
        return true;
      }

      const shouldClose = directionalDelta > getBaseSwipeThreshold(releasePopupElement, direction);
      if (shouldClose) {
        startSwipeRelease(direction);
      } else {
        clearSwipeRelease();
      }
      return shouldClose;
    }

    if (swipeDirection.value !== 'down' && swipeDirection.value !== 'up') {
      clearSwipeRelease();
      return undefined;
    }

    if (!popupHeight.value) {
      clearSwipeRelease();
      return false;
    }

    if (resolvedSnapPoints.value.length === 0) {
      clearSwipeRelease();
      return undefined;
    }

    const isDown = swipeDirection.value === 'down';
    const dragDelta = isDown ? deltaY : -deltaY;
    const dragDirection = Math.sign(dragDelta);
    const releaseDirectionalVelocity = isDown ? releaseVelocityY : -releaseVelocityY;
    const fallbackDirectionalVelocity = isDown ? velocityY : -velocityY;
    let resolvedDirectionalVelocity = releaseDirectionalVelocity;
    if (dragDirection !== 0 && Math.abs(dragDelta) >= MIN_SWIPE_THRESHOLD) {
      const velocityDirection = Math.sign(resolvedDirectionalVelocity);
      if (velocityDirection !== 0 && velocityDirection !== dragDirection) {
        // Ignore touch reversals that would otherwise flip the snap decision.
        resolvedDirectionalVelocity = fallbackDirectionalVelocity;
      }
    }

    const currentOffset = activeSnapPointOffset.value ?? 0;
    const dragTargetOffset = clamp(currentOffset + dragDelta, 0, popupHeight.value);
    const velocityOffset =
      Math.abs(resolvedDirectionalVelocity) >= SNAP_VELOCITY_THRESHOLD
        ? clamp(resolvedDirectionalVelocity, -MAX_SNAP_VELOCITY, MAX_SNAP_VELOCITY) *
          SNAP_VELOCITY_MULTIPLIER
        : 0;
    const targetOffset = snapToSequentialPoints.value
      ? dragTargetOffset
      : clamp(dragTargetOffset + velocityOffset, 0, popupHeight.value);
    const snapPointEventDetails = createChangeEventDetails(REASONS.swipe, event);

    const settleInPlace = () => {
      // Reset nested swipe state now: the hook's trailing progress update is deduped
      // when the drag never produced dismissal progress, so it may not fire.
      applySwipeProgress(0, true, true);
      clearSwipeRelease();
      return false;
    };

    const settleOnSnapPoint = (snapPoint: ResolvedDrawerSnapPoint) => {
      setActiveSnapPoint(snapPoint.value, snapPointEventDetails);
      return settleInPlace();
    };

    const closeFromSnapPoints = (fallbackSnapPoint: ResolvedDrawerSnapPoint) => {
      // An unattributed gesture (e.g. a mostly horizontal flick) may settle on a snap
      // point but must not dismiss: `useSwipeDismiss` drops a directionless dismissal,
      // stranding the popup visually closed while `open` stays `true`.
      if (!direction) {
        return settleOnSnapPoint(fallbackSnapPoint);
      }
      setActiveSnapPoint(null, snapPointEventDetails);
      if (snapPointEventDetails.isCanceled) {
        // A canceled null snap point rejects dismissal before exit styles start.
        return settleInPlace();
      }
      pendingSwipeCloseSnapPoint = activeSnapPoint.value;
      startSwipeRelease(swipeDirection.value);
      return true;
    };

    if (snapToSequentialPoints.value) {
      const orderedSnapPoints = [...resolvedSnapPoints.value].sort(
        (first, second) => first.offset - second.offset,
      );
      const orderedOffsets = orderedSnapPoints.map((point) => point.offset);
      const currentIndex = closestSnapPointIndex(orderedOffsets, currentOffset);
      let targetSnapPoint = orderedSnapPoints[closestSnapPointIndex(orderedOffsets, targetOffset)];

      const velocityDirection = Math.sign(resolvedDirectionalVelocity);
      const shouldAdvance =
        dragDirection !== 0 &&
        velocityDirection !== 0 &&
        velocityDirection === dragDirection &&
        Math.abs(resolvedDirectionalVelocity) >= SNAP_VELOCITY_THRESHOLD;
      let effectiveTargetOffset = targetOffset;

      if (shouldAdvance) {
        const adjacentIndex = clamp(currentIndex + dragDirection, 0, orderedSnapPoints.length - 1);
        if (adjacentIndex !== currentIndex) {
          const adjacentPoint = orderedSnapPoints[adjacentIndex];
          const shouldForceAdjacent =
            dragDirection > 0
              ? targetOffset < adjacentPoint.offset
              : targetOffset > adjacentPoint.offset;
          if (shouldForceAdjacent) {
            targetSnapPoint = adjacentPoint;
            effectiveTargetOffset = adjacentPoint.offset;
          }
        } else if (dragDirection > 0) {
          return closeFromSnapPoints(targetSnapPoint);
        }
      }

      const closeDistance = Math.abs(effectiveTargetOffset - popupHeight.value);
      const snapDistance = Math.abs(effectiveTargetOffset - targetSnapPoint.offset);
      if (closeDistance < snapDistance) {
        return closeFromSnapPoints(targetSnapPoint);
      }

      return settleOnSnapPoint(targetSnapPoint);
    }

    const closestSnapPoint =
      resolvedSnapPoints.value[
        closestSnapPointIndex(
          resolvedSnapPoints.value.map((point) => point.offset),
          targetOffset,
        )
      ];

    if (resolvedDirectionalVelocity >= FAST_SWIPE_VELOCITY && dragDelta > 0) {
      return closeFromSnapPoints(closestSnapPoint);
    }

    const closeDistance = Math.abs(targetOffset - popupHeight.value);
    if (closeDistance < Math.abs(targetOffset - closestSnapPoint.offset)) {
      return closeFromSnapPoints(closestSnapPoint);
    }

    return settleOnSnapPoint(closestSnapPoint);
  },
  onDismiss(event) {
    visualStateStore?.set({ swipeProgress: 0, frontmostHeight: 0 });

    const backdropElement = backdropRef.value;
    if (backdropElement) {
      backdropElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
      backdropElement.style.removeProperty(DrawerPopupCssVars.height);
    }

    const dismissEventDetails: Parameters<typeof store.setOpen>[1] = createChangeEventDetails(
      REASONS.swipe,
      event,
    );
    store.setOpen(false, dismissEventDetails);

    if (dismissEventDetails.isCanceled) {
      const pendingSnapPoint = pendingSwipeCloseSnapPoint;
      if (pendingSnapPoint !== undefined) {
        setActiveSnapPoint(pendingSnapPoint, createChangeEventDetails(REASONS.swipe, event));
      }

      pendingSwipeCloseSnapPoint = undefined;
      swipe.reset();
      clearSwipeRelease();
      return;
    }

    // In controlled mode, the effective open state may not have changed yet
    // (openProp takes precedence over state.open). Proceed optimistically with the
    // dismiss animation — Vue flushes the parent's update before the next animation frame, so we
    // can reliably check whether the parent accepted or rejected the close.
    // Note: if openChange is asynchronous (e.g., closes the drawer after a network
    // call), the frame check will see open === true, revert the animation, and the
    // drawer will close without animation when the parent eventually sets open to false.
    if (store.select('open')) {
      const savedEvent = event;
      controlledDismissFrame.request(() => {
        if (store.select('open')) {
          // Parent rejected: revert animation and restore snap point.
          const pendingSnapPoint = pendingSwipeCloseSnapPoint;
          if (pendingSnapPoint !== undefined) {
            setActiveSnapPoint(
              pendingSnapPoint,
              createChangeEventDetails(REASONS.swipe, savedEvent),
            );
          }
          pendingSwipeCloseSnapPoint = undefined;
          clearSwipeRelease();
          swipe.reset();
        } else {
          // Parent accepted: clean up the ref.
          pendingSwipeCloseSnapPoint = undefined;
        }
      });
      return;
    }

    pendingSwipeCloseSnapPoint = undefined;
    setSwipeDismissed(true);
  },
});

function processTouchMove(
  event: TouchEvent,
  touchState: TouchScrollState,
  touch: Touch,
  rootElement: HTMLElement,
  doc: Document,
) {
  const drawerAxisDelta = isVerticalScrollAxis.value
    ? touch.clientY - touchState.lastY
    : touch.clientX - touchState.lastX;

  // Avoid blocking pinch zoom or text selection adjustments on iOS Safari.
  if (event.touches.length === 2) {
    return;
  }

  const allowTouchMove = shouldIgnoreSwipeForTextSelection(doc, rootElement);

  if (allowTouchMove || nestedDrawerOpen.value) {
    return;
  }

  if (shouldYieldTouchMove(touchState, event, touch, isVerticalScrollAxis.value)) {
    return;
  }

  const scrollTarget = touchState.scrollTarget;
  if (!scrollTarget || scrollTarget === doc.documentElement || scrollTarget === doc.body) {
    if (event.cancelable) {
      event.preventDefault();
    }
    // Claim the gesture before the touch listeners of the elements see it; a move that reaches
    // the popup through them re-rasterizes the popup content on every frame.
    event.stopPropagation();
    swipe.moveNative(event, rootElement);
    return;
  }

  if (!hasScrollableContentOnAxis(scrollTarget, scrollAxis.value)) {
    // If the scroll container doesn't overflow on the drawer axis, prevent the window from
    // scrolling instead.
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
    return;
  }

  if (drawerAxisDelta !== 0) {
    const canSwipeFromScrollEdge = canSwipeFromScrollEdgeOnMove(
      scrollTarget,
      scrollAxis.value,
      swipeDirection.value,
      drawerAxisDelta,
    );

    if (!touchState.allowSwipe) {
      if (event.cancelable && canSwipeFromScrollEdge) {
        touchState.allowSwipe = true;
        event.preventDefault();
      } else {
        touchState.allowSwipe = false;
      }
    } else if (event.cancelable) {
      event.preventDefault();
    }
  }

  if (touchState.allowSwipe === true) {
    event.stopPropagation();
    swipe.moveNative(event, rootElement);
  }
}

// `KeepAlive` takes the viewport out of the document. The listener on the document then stops
// until the activation.
let deactivated = false;
let removeTouchMoveListener = NOOP;

function listenToTouchMove() {
  removeTouchMoveListener();
  removeTouchMoveListener = NOOP;

  const rootElement = store.select('viewportElement') ?? store.select('popupElement');
  // A non-passive document listener makes all touch scrolling wait on the main thread.
  if (!rootElement || !open.value || !mounted.value || deactivated) {
    return;
  }

  const resolvedRootElement: HTMLElement = rootElement;
  const doc = ownerDocument(resolvedRootElement);

  function handleNativeTouchMove(event: TouchEvent) {
    if (ignoreTouchSwipe) {
      return;
    }

    const touchState = touchScrollState;
    const touch = event.touches[0];
    if (!touch || !touchState) {
      return;
    }

    processTouchMove(event, touchState, touch, resolvedRootElement, doc);
    updateTouchScrollPosition(touchState, touch);
  }

  removeTouchMoveListener = addEventListener(doc, 'touchmove', handleNativeTouchMove, {
    passive: false,
    capture: true,
  });
}

onMounted(listenToTouchMove);
watch(
  [() => store.select('viewportElement') ?? store.select('popupElement'), open, mounted],
  listenToTouchMove,
  { flush: 'post' },
);

onDeactivated(() => {
  deactivated = true;
  listenToTouchMove();
});

onActivated(() => {
  if (!deactivated) {
    return;
  }
  deactivated = false;
  listenToTouchMove();
});

function applyRestingSnapPointProgress() {
  if (!snapPointRange.value || swipe.swiping.value) {
    return;
  }

  applySwipeProgress(!open.value || nested.value ? 0 : (snapPointProgress.value ?? 0), true, false);
}

onMounted(applyRestingSnapPointProgress);
watch(
  [frontmostHeight, nested, open, snapPointProgress, snapPointRange, swipe.swiping],
  applyRestingSnapPointProgress,
  { flush: 'post' },
);

if (notifyParentSwipeProgressChange) {
  watch(open, () => notifyParentSwipeProgressChange(0), { flush: 'post' });
}

function resetOnOpen() {
  if (!open.value) {
    return;
  }

  // Skip `reset` while `Drawer.SwipeArea` is driving the open: it zeroes the popup's
  // `--swipe-movement-*` (via `syncDragStyles(false)`), flashing it fully open for a frame.
  // `clearSwipeRelease` doesn't touch those vars, so always run it to clear any leftover
  // release state from a prior dismiss (e.g. when the popup is kept mounted).
  if (!swipeAreaActiveRef.value) {
    swipe.reset();
  }
  clearSwipeRelease();
}

onMounted(resetOnOpen);
watch(open, resetOnOpen, { flush: 'post' });

let mountedBackdrop: HTMLElement | null = null;
onMounted(() => {
  mountedBackdrop = backdropRef.value;
});

onScopeDispose(() => {
  removeTouchMoveListener();
  notifyParentSwipeProgressChange?.(0);
  visualStateStore?.set({ swipeProgress: 0, frontmostHeight: 0 });
  setBackdropSwipingAttribute(mountedBackdrop, false);
  // `data-swiping` is set on whichever backdrop is current when a swipe starts, which can
  // differ from the captured element if the backdrop mounted late or changed identity.
  // Reading the live ref here is intentional so the current backdrop is cleared too.
  if (backdropRef.value !== mountedBackdrop) {
    setBackdropSwipingAttribute(backdropRef.value, false);
  }
  finishNestedSwipe();
});

provide(DrawerViewportContext, {
  swiping: swipe.swiping,
  getDragStyles: swipe.getDragStyles,
  swipeStrength: swipeRelease,
});

function resetTouchSwipeState(ignoreSwipe: boolean) {
  ignoreTouchSwipe = ignoreSwipe;
  touchScrollState = null;
}

function resetTouchTrackingState() {
  resetTouchSwipeState(false);
  lastPointerType = '';
  ignoreNextTouchStartFromPen = false;
}

function handlePointerEnd(event: PointerEvent): boolean {
  lastPointerType = '';
  return event.pointerType !== 'touch';
}

const viewportHandlers = {
  onPointerdown(event: PointerEvent) {
    lastPointerType = event.pointerType;
    ignoreNextTouchStartFromPen = event.pointerType === 'pen';

    if (!open.value || !mounted.value || nestedDrawerOpen.value) {
      return;
    }

    const currentTarget = event.currentTarget as HTMLElement;
    const elementAtPoint = getElementAtPoint(
      currentTarget.getRootNode(),
      event.clientX,
      event.clientY,
    );
    // Pointer drags capture the pointer on press, so they can't wait to see which axis the
    // gesture takes; any `data-vase-ui-swipe-ignore` value ignores them.
    if (isSwipeIgnoredTarget(elementAtPoint) || isDrawerContentTarget(elementAtPoint)) {
      return;
    }

    if (event.pointerType === 'touch') {
      return;
    }

    swipe.pointerProps.onPointerdown(event);
  },
  onPointermove(event: PointerEvent) {
    if (event.pointerType === 'touch') {
      return;
    }

    swipe.pointerProps.onPointermove(event);
  },
  onPointerup(event: PointerEvent) {
    if (handlePointerEnd(event)) {
      swipe.pointerProps.onPointerup(event);
    }
  },
  onPointercancel(event: PointerEvent) {
    if (handlePointerEnd(event)) {
      swipe.pointerProps.onPointercancel(event);
    }
  },
  onTouchstartPassive(event: TouchEvent) {
    const startedFromPenPointerDown = lastPointerType === 'pen' && ignoreNextTouchStartFromPen;
    if (startedFromPenPointerDown) {
      ignoreNextTouchStartFromPen = false;
      resetTouchSwipeState(false);
      return;
    }

    if (!open.value || !mounted.value || nestedDrawerOpen.value) {
      resetTouchSwipeState(false);
      return;
    }

    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    if (isTouchEventOnRangeInput(event)) {
      resetTouchSwipeState(false);
      return;
    }

    const rootElement = event.currentTarget as HTMLElement;
    const elementAtPoint = getElementAtPoint(
      rootElement.getRootNode(),
      touch.clientX,
      touch.clientY,
    );
    const eventTarget = getTarget(event);
    const target = isElement(eventTarget) ? eventTarget : rootElement;
    if (!contains(rootElement, target)) {
      resetTouchSwipeState(true);
      return;
    }

    // `x`/`y` hand touch drags along that axis to the element. Any value other than the
    // cross-axis one ignores the swipe outright; a cross-axis element is arbitrated like a
    // native cross-axis scroller below.
    if (
      closest(
        elementAtPoint,
        `${VASE_UI_SWIPE_IGNORE_SELECTOR}:not(${AXIS_SWIPE_IGNORE_SELECTORS[crossScrollAxis.value]})`,
      )
    ) {
      resetTouchSwipeState(true);
      return;
    }
    ignoreTouchSwipe = false;

    const scrollTarget = findScrollableTouchTarget(target, rootElement, scrollAxis.value);
    const hasCrossAxisGestureTarget =
      findScrollableTouchTarget(target, rootElement, crossScrollAxis.value) != null ||
      closest(elementAtPoint, AXIS_SWIPE_IGNORE_SELECTORS[crossScrollAxis.value]) != null;

    let allowSwipe: boolean | null = null;
    if (scrollTarget) {
      const canSwipeFromEdge = isAtSwipeStartEdge(
        scrollTarget,
        scrollAxis.value,
        swipeDirection.value,
      );

      allowSwipe = canSwipeFromEdge ? null : false;
    }

    touchScrollState = {
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      lastY: touch.clientY,
      startedInPopup: contains(popupRef.value, elementAtPoint),
      scrollTarget,
      hasCrossAxisGestureTarget,
      allowSwipe,
      preserveNativeCrossAxisScroll: false,
      drawerAxisAttributed: false,
    };

    swipe.touchProps.onTouchstartPassive(event);
  },
  onTouchend(event: TouchEvent) {
    resetTouchTrackingState();
    swipe.touchProps.onTouchend(event);
  },
  onTouchcancel(event: TouchEvent) {
    resetTouchTrackingState();
    swipe.touchProps.onTouchcancel(event);
  },
  // Drawer popups use drawer-specific nested state attributes.
  // Suppress DialogViewport's generic nested dialog attribute.
  [DialogViewportDataAttributes.nestedDialogOpen]: undefined,
};

function viewportProps() {
  return { ...mergeProps(viewportHandlers, attrs), ...props };
}

// As in Base UI, this part renders `Dialog.Viewport` and makes no element of its own.
const viewport = useTemplateRef('viewport');
const element = computed(() => viewport.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <DialogViewport ref="viewport" v-bind="viewportProps()">
    <template v-if="$slots.render" #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
    <template v-if="$slots.default" #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </DialogViewport>
</template>
