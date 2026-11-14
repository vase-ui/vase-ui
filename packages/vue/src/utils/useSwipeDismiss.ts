import { computed, onDeactivated, shallowRef, toValue } from 'vue';
import type { CSSProperties, MaybeRefOrGetter, Ref } from 'vue';
import { clamp } from '../common/clamp';
import { ownerDocument } from '../common/owner';
import { closest, contains, getTarget } from '../common/shadowDom';
import { findScrollableAncestor, findScrollableTouchTarget } from './scrollable';
import type { ScrollAxis } from './scrollable';
import { getElementAtPoint } from './getElementAtPoint';
import { getElementTransform } from './getElementTransform';

export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

type SwipeDismissEvent = PointerEvent | TouchEvent;
type Point = { x: number; y: number };
type SwipeProgressDetailsInternal = {
  deltaX: number;
  deltaY: number;
  direction: SwipeDirection | undefined;
};

const DEFAULT_SWIPE_THRESHOLD = 40;
const REVERSE_CANCEL_THRESHOLD = 10;
const MIN_VELOCITY_DURATION_MS = 50;
// Less than one frame at 240 Hz, so it changes only samples that are almost simultaneous.
const MIN_RELEASE_VELOCITY_DURATION_MS = 4;
const MAX_RELEASE_VELOCITY_AGE_MS = 80;
const MIN_VELOCITY_SAMPLE_DISTANCE = 1;
const DEFAULT_IGNORE_SELECTOR = 'button,a,input,select,textarea,label,[role="button"]';

export function getDisplacement(direction: SwipeDirection, deltaX: number, deltaY: number) {
  switch (direction) {
    case 'up':
      return -deltaY;
    case 'down':
      return deltaY;
    case 'left':
      return -deltaX;
    case 'right':
      return deltaX;
    default:
      return 0;
  }
}

function getValidTimeStamp(timeStamp: number): number | null {
  return Number.isFinite(timeStamp) && timeStamp > 0 ? timeStamp : null;
}

function getDragTransform(dragOffset: Point, scale: number): string {
  return `translate3d(${dragOffset.x}px,${dragOffset.y}px,0) scale(${scale})`;
}

function hasPrimaryMouseButton(buttons: number): boolean {
  return buttons % 2 === 1;
}

function safelyChangePointerCapture(
  element: HTMLElement,
  pointerId: number,
  method: 'setPointerCapture' | 'releasePointerCapture',
) {
  const pointerCaptureMethod = element[method];
  if (typeof pointerCaptureMethod !== 'function') {
    return;
  }

  try {
    pointerCaptureMethod.call(element, pointerId);
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFoundError') {
      return;
    }
    throw error;
  }
}

function getPrimaryPointerPosition(event: SwipeDismissEvent): Point | null {
  if ('touches' in event) {
    const touch = event.touches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  return { x: event.clientX, y: event.clientY };
}

function isTouchLikeEvent(event: SwipeDismissEvent) {
  if ('touches' in event) {
    return true;
  }
  return event.pointerType === 'touch';
}

export function useSwipeDismiss(options: UseSwipeDismissOptions): UseSwipeDismissReturnValue {
  const {
    movementCssVars,
    canStart,
    onDismiss,
    onProgress,
    onCancel,
    onSwipeStart,
    onRelease,
    onSwipingChange,
  } = options;

  const directionState = computed(() => {
    const directions = toValue(options.directions);
    const allowLeft = directions.includes('left');
    const allowRight = directions.includes('right');
    const allowUp = directions.includes('up');
    const allowDown = directions.includes('down');
    const hasHorizontal = allowLeft || allowRight;
    // The callers give directions on one axis only.
    const scrollAxis: ScrollAxis = hasHorizontal ? 'horizontal' : 'vertical';

    return {
      directions,
      primaryDirection: directions.length === 1 ? directions[0] : undefined,
      allowLeft,
      allowRight,
      allowUp,
      allowDown,
      hasHorizontal,
      hasVertical: allowUp || allowDown,
      scrollAxis,
    };
  });

  const currentSwipeDirection = shallowRef<SwipeDirection | undefined>(undefined);
  const swiping = shallowRef(false);
  const dragDismissed = shallowRef(false);

  let dragStartPos: Point = { x: 0, y: 0 };
  let dragOffset: Point = { x: 0, y: 0 };
  let lastMovePos: Point | null = null;
  let initialTransform = { x: 0, y: 0, scale: 1 };
  let intendedSwipeDirection: SwipeDirection | undefined;
  let maxSwipeDisplacement = 0;
  let cancelledSwipe = false;
  let swipeCancelBaseline: Point = { x: 0, y: 0 };
  let isFirstPointerMove = false;
  let pendingSwipe = false;
  let pendingSwipeStartPos: Point | null = null;
  let swipeFromScrollable = false;
  let sawPrimaryButtonsOnMove = false;
  let elementSize = { width: 0, height: 0 };
  let swipeProgress = 0;
  let swipeThreshold = DEFAULT_SWIPE_THRESHOLD;
  let swipeThresholdFunction: SwipeThresholdFunction | null = null;
  let swipeStartTime: number | null = null;
  let lastDragSample: { x: number; y: number; time: number } | null = null;
  let hasStationarySample = false;
  let lastDragVelocity: Point = { x: 0, y: 0 };
  let lastProgressDetails: SwipeProgressDetailsInternal | null = null;
  let dragStyleSnapshot: [string, string] | null = null;

  function readSwipeThresholdDefault() {
    const value = toValue(options.swipeThreshold);
    return Math.max(0, typeof value === 'number' ? value : DEFAULT_SWIPE_THRESHOLD);
  }

  function getElement() {
    return toValue(options.elementRef) ?? null;
  }

  function isEnabled() {
    return toValue(options.enabled);
  }

  function setSwiping(nextSwiping: boolean) {
    if (swiping.value === nextSwiping) {
      return;
    }

    swiping.value = nextSwiping;
    onSwipingChange?.(nextSwiping);
  }

  function resolveSwipeThreshold(direction: SwipeDirection | undefined) {
    if (!direction) {
      return;
    }

    const element = getElement();
    if (!element || !swipeThresholdFunction) {
      return;
    }

    swipeThreshold = Math.max(0, swipeThresholdFunction({ element, direction }));
  }

  function updateSwipeProgress(progress: number, details?: SwipeProgressDetailsInternal) {
    const nextProgress = Number.isFinite(progress) ? clamp(progress, 0, 1) : 0;
    const progressChanged = nextProgress !== swipeProgress;
    let detailsChanged = false;

    if (details) {
      detailsChanged =
        !lastProgressDetails ||
        lastProgressDetails.deltaX !== details.deltaX ||
        lastProgressDetails.deltaY !== details.deltaY ||
        lastProgressDetails.direction !== details.direction;
    }

    if (!progressChanged && !detailsChanged) {
      return;
    }

    swipeProgress = nextProgress;
    if (details) {
      lastProgressDetails = details;
    } else if (progressChanged) {
      lastProgressDetails = null;
    }
    onProgress?.(nextProgress, details);
  }

  function syncDragStyles(nextSwiping: boolean) {
    const element = getElement();
    if (!(toValue(options.trackDrag) ?? true) || !element) {
      if (!nextSwiping) {
        dragStyleSnapshot = null;
      }
      return;
    }

    const style = element.style;
    if (nextSwiping) {
      if (!dragStyleSnapshot) {
        dragStyleSnapshot = [style.transition, style.transform];
      }

      style.transition = 'none';
    } else if (dragStyleSnapshot) {
      [style.transition, style.transform] = dragStyleSnapshot;
      dragStyleSnapshot = null;
    }

    if (nextSwiping) {
      style.transform = getDragTransform(dragOffset, initialTransform.scale);
    }

    style.setProperty(movementCssVars.x, `${dragOffset.x - initialTransform.x}px`);
    style.setProperty(movementCssVars.y, `${dragOffset.y - initialTransform.y}px`);
  }

  function recordDragSample(offset: Point, timeStamp: number | null) {
    if (timeStamp === null) {
      return;
    }

    if (lastDragSample && timeStamp > lastDragSample.time) {
      // Some Android devices send one move that is almost stationary immediately before the
      // release. Keep the last sample that moved, with its time. A second stationary move clears
      // the velocity, and a release after a hold makes the last sample too old.
      const stationary =
        Math.abs(offset.x - lastDragSample.x) < MIN_VELOCITY_SAMPLE_DISTANCE &&
        Math.abs(offset.y - lastDragSample.y) < MIN_VELOCITY_SAMPLE_DISTANCE;
      const skipSample = stationary && !hasStationarySample;
      hasStationarySample = stationary;
      if (skipSample) {
        return;
      }

      const durationMs = Math.max(
        timeStamp - lastDragSample.time,
        MIN_RELEASE_VELOCITY_DURATION_MS,
      );
      lastDragVelocity = {
        x: (offset.x - lastDragSample.x) / durationMs,
        y: (offset.y - lastDragSample.y) / durationMs,
      };
    }

    lastDragSample = { x: offset.x, y: offset.y, time: timeStamp };
  }

  function reset() {
    currentSwipeDirection.value = undefined;
    setSwiping(false);
    dragDismissed.value = false;
    updateSwipeProgress(0);

    swipeThreshold = readSwipeThresholdDefault();
    swipeThresholdFunction = null;
    dragStartPos = { x: 0, y: 0 };
    dragOffset = { x: 0, y: 0 };
    initialTransform = { x: 0, y: 0, scale: 1 };
    intendedSwipeDirection = undefined;
    maxSwipeDisplacement = 0;
    cancelledSwipe = false;
    swipeCancelBaseline = { x: 0, y: 0 };
    isFirstPointerMove = false;
    lastMovePos = null;
    pendingSwipe = false;
    pendingSwipeStartPos = null;
    swipeFromScrollable = false;
    sawPrimaryButtonsOnMove = false;
    elementSize = { width: 0, height: 0 };
    swipeStartTime = null;
    lastDragSample = null;
    hasStationarySample = false;
    lastDragVelocity = { x: 0, y: 0 };
    lastProgressDetails = null;
    syncDragStyles(false);
  }

  function getTargetAtPoint(position: Point, event: Event) {
    const root = getElement()?.getRootNode();
    const elementAtPoint = getElementAtPoint(root, position.x, position.y);
    const target = elementAtPoint ?? getTarget(event);
    return target as HTMLElement | null;
  }

  function findGestureScrollableTouchTarget(
    target: EventTarget | null,
    root: HTMLElement,
  ): HTMLElement | null {
    // The swiped element has its position relative to the viewport, so the scroller of the page
    // must not stop the gesture. A reset such as `html, body { height: 100%; overflow: auto }`
    // makes `body` a scroll container.
    const scrollTarget = findScrollableTouchTarget(target, root, directionState.value.scrollAxis);
    const doc = ownerDocument(scrollTarget);
    return scrollTarget === doc.body || scrollTarget === doc.documentElement ? null : scrollTarget;
  }

  function startSwipeAtPosition(
    event: SwipeDismissEvent,
    position: Point,
    startOptions?: {
      ignoreScrollableTarget?: boolean | undefined;
      ignoreScrollableAncestors?: boolean | undefined;
    },
  ) {
    swipeFromScrollable = false;
    const touchLike = isTouchLikeEvent(event);
    const target = getTargetAtPoint(position, event);
    const element = getElement();

    const body = ownerDocument(element).body;

    const scrollableTarget =
      touchLike && body ? findGestureScrollableTouchTarget(target, body) : null;
    const ignoreScrollableTarget = startOptions?.ignoreScrollableTarget ?? false;
    if (scrollableTarget && !ignoreScrollableTarget) {
      return false;
    }
    swipeFromScrollable = Boolean(scrollableTarget && ignoreScrollableTarget);

    const isInteractiveElement = closest(target, DEFAULT_IGNORE_SELECTOR);
    if (
      isInteractiveElement &&
      (!touchLike || (toValue(options.ignoreSelectorWhenTouch) ?? true))
    ) {
      return false;
    }

    if ((toValue(options.ignoreScrollableAncestors) ?? false) && element && target) {
      const ignoreAncestors = startOptions?.ignoreScrollableAncestors ?? false;
      if (
        !ignoreAncestors &&
        findScrollableAncestor(target, element, directionState.value.scrollAxis) != null
      ) {
        return false;
      }
    }

    cancelledSwipe = false;
    intendedSwipeDirection = undefined;
    maxSwipeDisplacement = 0;

    dragStartPos = position;
    swipeStartTime = getValidTimeStamp(event.timeStamp);
    lastDragSample = null;
    hasStationarySample = false;
    lastDragVelocity = { x: 0, y: 0 };
    swipeCancelBaseline = position;
    lastMovePos = position;
    // The gesture keeps the threshold that it starts with.
    const thresholdOption = toValue(options.swipeThreshold);
    swipeThreshold = readSwipeThresholdDefault();
    swipeThresholdFunction = typeof thresholdOption === 'function' ? thresholdOption : null;

    if (element) {
      elementSize = { width: element.offsetWidth, height: element.offsetHeight };
      resolveSwipeThreshold(directionState.value.primaryDirection);
      const transform = getElementTransform(element);

      initialTransform = transform;
      dragOffset = { x: transform.x, y: transform.y };
      recordDragSample({ x: transform.x, y: transform.y }, swipeStartTime);

      if (!('touches' in event)) {
        safelyChangePointerCapture(element, event.pointerId, 'setPointerCapture');
      }
    }

    onSwipeStart?.(event);

    setSwiping(true);
    isFirstPointerMove = true;
    updateSwipeProgress(0);
    syncDragStyles(true);

    return true;
  }

  function clearPendingSwipeStartState() {
    pendingSwipe = false;
    pendingSwipeStartPos = null;
  }

  function resetPendingSwipeState() {
    clearPendingSwipeStartState();
    swipeFromScrollable = false;
    lastMovePos = null;
  }

  function cancelSwipeInteraction(event: PointerEvent) {
    resetPendingSwipeState();

    if (!swiping.value) {
      return;
    }

    setSwiping(false);

    dragOffset = { x: initialTransform.x, y: initialTransform.y };
    currentSwipeDirection.value = undefined;
    sawPrimaryButtonsOnMove = false;
    syncDragStyles(false);

    const element = getElement();
    if (element) {
      safelyChangePointerCapture(element, event.pointerId, 'releasePointerCapture');
    }

    updateSwipeProgress(0, { deltaX: 0, deltaY: 0, direction: undefined });

    onCancel?.(event);
  }

  function applyDirectionalDamping(deltaX: number, deltaY: number) {
    const { allowLeft, allowRight, allowUp, allowDown, hasHorizontal, hasVertical } =
      directionState.value;
    const exponent = (value: number) => Math.sign(value) * Math.abs(value) ** 0.5;
    const dampAxis = (delta: number, allowNegative: boolean, allowPositive: boolean) => {
      if ((!allowNegative && delta < 0) || (!allowPositive && delta > 0)) {
        return exponent(delta);
      }
      return delta;
    };

    return {
      x: hasHorizontal ? dampAxis(deltaX, allowLeft, allowRight) : exponent(deltaX),
      y: hasVertical ? dampAxis(deltaY, allowUp, allowDown) : exponent(deltaY),
    };
  }

  function canSwipeFromScrollEdgeOnPendingMove(
    scrollTarget: HTMLElement,
    deltaX: number,
    deltaY: number,
  ): boolean | null {
    const { allowLeft, allowRight, allowUp, allowDown, hasHorizontal, hasVertical } =
      directionState.value;
    // A swipe to the start edge of the axis (down or right) can start when the scroll offset is at
    // the start. A swipe to the end edge (up or left) can start when the scroll offset is at the
    // end.
    const canSwipeOnAxis = (
      delta: number,
      scrollOffset: number,
      maxScrollOffset: number,
      allowTowardStart: boolean,
      allowTowardEnd: boolean,
    ) =>
      (delta > 0 && scrollOffset <= 0 && allowTowardStart) ||
      (delta < 0 && scrollOffset >= Math.max(0, maxScrollOffset) && allowTowardEnd);

    if (hasVertical && deltaY !== 0) {
      return canSwipeOnAxis(
        deltaY,
        scrollTarget.scrollTop,
        scrollTarget.scrollHeight - scrollTarget.clientHeight,
        allowDown,
        allowUp,
      );
    }

    if (hasHorizontal && deltaX !== 0) {
      return canSwipeOnAxis(
        deltaX,
        scrollTarget.scrollLeft,
        scrollTarget.scrollWidth - scrollTarget.clientWidth,
        allowRight,
        allowLeft,
      );
    }

    return null;
  }

  function handleStart(event: SwipeDismissEvent) {
    if (!isEnabled()) {
      return;
    }

    if (event.defaultPrevented) {
      return;
    }

    if (!('touches' in event) && event.button !== 0) {
      return;
    }

    const startPos = getPrimaryPointerPosition(event);
    if (!startPos) {
      return;
    }

    pendingSwipe = true;
    pendingSwipeStartPos = startPos;
    swipeFromScrollable = false;
    sawPrimaryButtonsOnMove = !('touches' in event);

    const allowedToStart = canStart
      ? canStart(startPos, {
          nativeEvent: event,
          direction: directionState.value.primaryDirection,
        })
      : true;
    if (!allowedToStart) {
      return;
    }

    if (startSwipeAtPosition(event, startPos)) {
      clearPendingSwipeStartState();
    }
  }

  function handleMoveCore(
    event: SwipeDismissEvent,
    currentTarget: HTMLElement,
    position: Point,
    movement: Point,
  ) {
    if (!isEnabled() || !swiping.value) {
      return;
    }

    const {
      primaryDirection,
      allowLeft,
      allowRight,
      allowUp,
      allowDown,
      hasHorizontal,
      hasVertical,
    } = directionState.value;
    const trackDrag = toValue(options.trackDrag) ?? true;

    const target = getTarget(event) as HTMLElement | null;
    if (isTouchLikeEvent(event) && !swipeFromScrollable) {
      if (findGestureScrollableTouchTarget(target, currentTarget)) {
        return;
      }
    }

    if (!('touches' in event)) {
      // Without this call, Safari selects text during the drag.
      event.preventDefault();
    }

    if (isFirstPointerMove) {
      isFirstPointerMove = false;
      // The first move can be at a distance from the press. On iOS, the first `touchmove` comes
      // with an offset from the `touchstart`. An element that follows the pointer would then jump,
      // so the origin of the drag becomes the position of the first move. Without `trackDrag`, no
      // element follows the pointer, and the origin stays at the press. On a display with a low
      // refresh rate, the full travel of a quick flick can be in this one move.
      if (trackDrag) {
        dragStartPos = position;
        const moveTime = getValidTimeStamp(event.timeStamp);
        if (moveTime !== null) {
          swipeStartTime = moveTime;
        }
        lastDragSample = null;
        hasStationarySample = false;
      }
    }

    const clientX = position.x;
    const clientY = position.y;

    if (
      (movement.y < 0 && clientY > swipeCancelBaseline.y) ||
      (movement.y > 0 && clientY < swipeCancelBaseline.y)
    ) {
      swipeCancelBaseline = { x: swipeCancelBaseline.x, y: clientY };
    }

    if (
      (movement.x < 0 && clientX > swipeCancelBaseline.x) ||
      (movement.x > 0 && clientX < swipeCancelBaseline.x)
    ) {
      swipeCancelBaseline = { x: clientX, y: swipeCancelBaseline.y };
    }

    const deltaX = clientX - dragStartPos.x;
    const deltaY = clientY - dragStartPos.y;
    const cancelDeltaY = clientY - swipeCancelBaseline.y;
    const cancelDeltaX = clientX - swipeCancelBaseline.x;

    if (!intendedSwipeDirection) {
      let candidate: SwipeDirection;
      if (Math.abs(deltaX) >= Math.abs(deltaY)) {
        candidate = deltaX > 0 ? 'right' : 'left';
      } else {
        candidate = deltaY > 0 ? 'down' : 'up';
      }

      const isAllowed =
        (candidate === 'left' && allowLeft) ||
        (candidate === 'right' && allowRight) ||
        (candidate === 'up' && allowUp) ||
        (candidate === 'down' && allowDown);
      if (isAllowed) {
        intendedSwipeDirection = candidate;
        maxSwipeDisplacement = getDisplacement(candidate, deltaX, deltaY);
        currentSwipeDirection.value = candidate;
        resolveSwipeThreshold(candidate);
      }
    } else {
      const direction = intendedSwipeDirection;
      const currentDisplacement = getDisplacement(direction, cancelDeltaX, cancelDeltaY);
      if (currentDisplacement > swipeThreshold) {
        cancelledSwipe = false;
        currentSwipeDirection.value = direction;
      } else if (
        !(allowLeft && allowRight) &&
        !(allowUp && allowDown) &&
        maxSwipeDisplacement - currentDisplacement >= REVERSE_CANCEL_THRESHOLD
      ) {
        cancelledSwipe = true;
      }
    }

    const dampedDelta = applyDirectionalDamping(deltaX, deltaY);
    let newOffsetX = initialTransform.x;
    let newOffsetY = initialTransform.y;

    if (hasHorizontal) {
      newOffsetX += dampedDelta.x;
    }
    if (hasVertical) {
      newOffsetY += dampedDelta.y;
    }

    // Write the drag styles only when the offset changed. `syncDragStyles` writes the frozen
    // transform and the movement variables with no damping, and `onProgress` of the caller writes
    // the damped styles after it. `updateSwipeProgress` does not call `onProgress` for equal
    // deltas. A move that does not change the offset would then put the element at the position
    // with no damping. An example is a pointer at the edge of the screen that moves only on the
    // other axis.
    const offsetChanged = newOffsetX !== dragOffset.x || newOffsetY !== dragOffset.y;

    dragOffset = { x: newOffsetX, y: newOffsetY };
    if (offsetChanged) {
      syncDragStyles(true);
    }
    recordDragSample({ x: newOffsetX, y: newOffsetY }, getValidTimeStamp(event.timeStamp));
    const dragDeltaX = newOffsetX - initialTransform.x;
    const dragDeltaY = newOffsetY - initialTransform.y;
    const progressDetails: SwipeProgressDetailsInternal = {
      deltaX: dragDeltaX,
      deltaY: dragDeltaY,
      direction: intendedSwipeDirection,
    };

    let progress = 0;
    const progressDirection = primaryDirection ?? intendedSwipeDirection;
    if (progressDirection) {
      const size =
        progressDirection === 'left' || progressDirection === 'right'
          ? elementSize.width
          : elementSize.height;
      const scale = initialTransform.scale || 1;
      const progressDisplacement = getDisplacement(progressDirection, dragDeltaX, dragDeltaY);
      if (size > 0 && scale > 0 && progressDisplacement > 0) {
        progress = progressDisplacement / (size * scale);
      }
    }

    updateSwipeProgress(progress, progressDetails);
  }

  function handleEnd(event: SwipeDismissEvent) {
    if (!isEnabled()) {
      return;
    }

    const releaseDeltaX = dragOffset.x - initialTransform.x;
    const releaseDeltaY = dragOffset.y - initialTransform.y;
    const progressDetails: SwipeProgressDetailsInternal = {
      deltaX: releaseDeltaX,
      deltaY: releaseDeltaY,
      direction: intendedSwipeDirection,
    };

    if (!swiping.value) {
      resetPendingSwipeState();
      updateSwipeProgress(0, progressDetails);
      return;
    }

    setSwiping(false);
    resetPendingSwipeState();
    sawPrimaryButtonsOnMove = false;

    const element = getElement();
    if (element && !('touches' in event)) {
      safelyChangePointerCapture(element, event.pointerId, 'releasePointerCapture');
    }

    const resolvedDragOffset = dragOffset;
    const resolvedInitialTransform = initialTransform;
    const endTime = getValidTimeStamp(event.timeStamp);
    const durationMs =
      swipeStartTime !== null && endTime !== null && endTime > swipeStartTime
        ? endTime - swipeStartTime
        : 0;
    const velocityDurationMs = durationMs > 0 ? Math.max(durationMs, MIN_VELOCITY_DURATION_MS) : 0;
    const velocityX = velocityDurationMs > 0 ? releaseDeltaX / velocityDurationMs : 0;
    const velocityY = velocityDurationMs > 0 ? releaseDeltaY / velocityDurationMs : 0;
    let releaseVelocityX = lastDragVelocity.x;
    let releaseVelocityY = lastDragVelocity.y;
    if (lastDragSample && endTime !== null && endTime >= lastDragSample.time) {
      const ageMs = endTime - lastDragSample.time;
      if (ageMs <= MAX_RELEASE_VELOCITY_AGE_MS) {
        const sampleDurationMs = Math.max(ageMs, MIN_RELEASE_VELOCITY_DURATION_MS);
        const deltaFromLastSampleX = resolvedDragOffset.x - lastDragSample.x;
        const deltaFromLastSampleY = resolvedDragOffset.y - lastDragSample.y;
        if (Math.abs(deltaFromLastSampleX) >= MIN_VELOCITY_SAMPLE_DISTANCE) {
          releaseVelocityX = deltaFromLastSampleX / sampleDurationMs;
        }
        if (Math.abs(deltaFromLastSampleY) >= MIN_VELOCITY_SAMPLE_DISTANCE) {
          releaseVelocityY = deltaFromLastSampleY / sampleDurationMs;
        }
      } else {
        releaseVelocityX = 0;
        releaseVelocityY = 0;
      }
    }

    const releaseDecision = onRelease?.({
      event,
      direction: intendedSwipeDirection,
      deltaX: releaseDeltaX,
      deltaY: releaseDeltaY,
      velocityX,
      velocityY,
      releaseVelocityX,
      releaseVelocityY,
    });
    const hasReleaseDecision = typeof releaseDecision === 'boolean';

    function settle() {
      dragOffset = { x: resolvedInitialTransform.x, y: resolvedInitialTransform.y };
      currentSwipeDirection.value = undefined;
      syncDragStyles(false);
      updateSwipeProgress(0, progressDetails);
    }

    if (cancelledSwipe && !hasReleaseDecision) {
      settle();
      return;
    }

    let shouldClose = false;
    let dismissDirection: SwipeDirection | undefined;

    if (hasReleaseDecision) {
      shouldClose = releaseDecision;
      dismissDirection = intendedSwipeDirection ?? directionState.value.primaryDirection;
    } else {
      for (const direction of directionState.value.directions) {
        if (getDisplacement(direction, releaseDeltaX, releaseDeltaY) > swipeThreshold) {
          shouldClose = true;
          dismissDirection = direction;
          break;
        }
      }
    }

    if (shouldClose && dismissDirection) {
      currentSwipeDirection.value = dismissDirection;
      dragDismissed.value = true;
      syncDragStyles(false);
      onDismiss?.(event, { direction: dismissDirection });
    } else {
      settle();
    }
  }

  function handleMove(event: SwipeDismissEvent, currentTarget: HTMLElement) {
    if (!isEnabled()) {
      return;
    }

    const currentPos = getPrimaryPointerPosition(event);
    if (!currentPos) {
      return;
    }

    let endAfterMove = false;

    if (!('touches' in event)) {
      const hasPrimaryButton = hasPrimaryMouseButton(event.buttons);
      if (hasPrimaryButton) {
        sawPrimaryButtonsOnMove = true;
      }

      // A button that is not the primary button took the interaction, such as a right click
      // during the drag.
      if (event.buttons !== 0 && !hasPrimaryButton) {
        cancelSwipeInteraction(event);
        return;
      }

      // A `pointermove` with `buttons: 0` shows that the primary button is released, also when no
      // `pointerup` came. A fast flick on a trackpad sends this move immediately before the
      // `pointerup`. Use it as the release, as `touchend` is.
      if (event.buttons === 0 && sawPrimaryButtonsOnMove) {
        if (!swiping.value) {
          handleEnd(event);
          return;
        }
        // This move can hold the displacement that passes the threshold, and the highest release
        // velocity. `handleMoveCore` reads it first, and the release comes after.
        endAfterMove = true;
      }
    }

    if (!swiping.value && pendingSwipe) {
      if (!isTouchLikeEvent(event) && event.defaultPrevented) {
        resetPendingSwipeState();
        return;
      }

      const allowedToStart = canStart
        ? canStart(currentPos, {
            nativeEvent: event,
            direction: directionState.value.primaryDirection,
          })
        : true;

      if (allowedToStart) {
        const pendingStartPos = pendingSwipeStartPos;
        let ignoreScrollableOnStart = false;
        if (isTouchLikeEvent(event)) {
          const element = getElement();
          if (pendingStartPos && element) {
            const target = getTargetAtPoint(currentPos, event);
            const body = ownerDocument(element).body;
            const scrollTarget = body ? findGestureScrollableTouchTarget(target, body) : null;

            if (
              scrollTarget &&
              (contains(element, scrollTarget) || contains(scrollTarget, element))
            ) {
              const canSwipeFromEdge = canSwipeFromScrollEdgeOnPendingMove(
                scrollTarget,
                currentPos.x - pendingStartPos.x,
                currentPos.y - pendingStartPos.y,
              );

              if (canSwipeFromEdge === false) {
                return;
              }

              if (canSwipeFromEdge === true) {
                ignoreScrollableOnStart = true;
              }
            }
          }
        }

        const started = startSwipeAtPosition(event, currentPos, {
          ignoreScrollableTarget: ignoreScrollableOnStart,
          ignoreScrollableAncestors: ignoreScrollableOnStart,
        });
        if (started) {
          clearPendingSwipeStartState();
          if (pendingStartPos && ignoreScrollableOnStart) {
            // Keep the displacement between the `touchstart` and the move that starts the swipe
            // from a scroll edge. A quick flick can then dismiss.
            dragStartPos = pendingStartPos;
            swipeCancelBaseline = pendingStartPos;
            lastMovePos = pendingStartPos;
            isFirstPointerMove = false;
          } else {
            // Start from the current position. A pointer that comes from outside the element
            // then causes no jump, and the next move is not lost.
            swipeFromScrollable = false;
          }
        }
      }
    }

    const movement =
      lastMovePos === null
        ? { x: 0, y: 0 }
        : { x: currentPos.x - lastMovePos.x, y: currentPos.y - lastMovePos.y };

    lastMovePos = currentPos;
    handleMoveCore(event, currentTarget, currentPos, movement);

    if (endAfterMove) {
      handleEnd(event);
    }
  }

  function handleElementMove(event: SwipeDismissEvent) {
    handleMove(event, event.currentTarget as HTMLElement);
  }

  function getDragStyles(): CSSProperties {
    const deltaX = dragOffset.x - initialTransform.x;
    const deltaY = dragOffset.y - initialTransform.y;

    if (!swiping.value && deltaX === 0 && deltaY === 0 && !dragDismissed.value) {
      return {
        [movementCssVars.x]: '0px',
        [movementCssVars.y]: '0px',
      };
    }

    return {
      transition: swiping.value ? 'none' : undefined,
      // During the swipe, the element stays at the transform that it has, so that it does not go
      // to the end position.
      transform: swiping.value ? getDragTransform(dragOffset, initialTransform.scale) : undefined,
      [movementCssVars.x]: `${deltaX}px`,
      [movementCssVars.y]: `${deltaY}px`,
    };
  }

  // `KeepAlive` removes the element from the document, and the browser then releases the pointer
  // capture. No `pointerup` comes to the element after that.
  onDeactivated(() => {
    if (swiping.value) {
      reset();
    }
  });

  return {
    swiping,
    swipeDirection: currentSwipeDirection,
    dragDismissed,
    pointerProps: {
      onPointerdown: handleStart,
      onPointermove: handleElementMove,
      onPointerup: handleEnd,
      onPointercancel: handleEnd,
    },
    touchProps: {
      onTouchstartPassive: handleStart,
      onTouchmovePassive: handleElementMove,
      onTouchend: handleEnd,
      onTouchcancel: handleEnd,
    },
    moveNative: handleMove,
    getDragStyles,
    reset,
  };
}

export interface UseSwipeDismissDetails {
  nativeEvent: PointerEvent | TouchEvent;
  direction: SwipeDirection | undefined;
}

export type UseSwipeDismissProgressDetails = SwipeProgressDetailsInternal;

export type SwipeThresholdFunction = (details: {
  element: HTMLElement;
  direction: SwipeDirection;
}) => number;

export interface UseSwipeDismissOptions {
  enabled: MaybeRefOrGetter<boolean>;
  directions: MaybeRefOrGetter<SwipeDirection[]>;
  elementRef: MaybeRefOrGetter<HTMLElement | null | undefined>;
  movementCssVars: { x: string; y: string };
  /**
   * The distance in pixels that the pointer must travel from the start of the swipe before a
   * release dismisses. A function gets the element and the direction. Give it as the value of a
   * ref or of a getter.
   * @default 40
   */
  swipeThreshold?:
    | number
    | Readonly<Ref<number | SwipeThresholdFunction | undefined>>
    | (() => number | SwipeThresholdFunction | undefined)
    | undefined;
  /**
   * When you give this function, a swipe starts only when it returns `true`. It runs at the start
   * and at each move while the pointer is down.
   */
  canStart?:
    ((position: { x: number; y: number }, details: UseSwipeDismissDetails) => boolean) | undefined;
  /**
   * If `true`, a gesture that starts in a scrollable element starts no swipe. The scroll of the
   * content then does not conflict with the swipe.
   * @default false
   */
  ignoreScrollableAncestors?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * If `false`, a touch can start a swipe on an interactive element, such as a button. A pointer
   * cannot start a swipe on such an element.
   * @default true
   */
  ignoreSelectorWhenTouch?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Whether the composable writes the drag transform and the movement variables to the element
   * during a swipe. Set it to `false` when the caller writes the styles from the events.
   * @default true
   */
  trackDrag?: MaybeRefOrGetter<boolean | undefined>;
  onSwipeStart?: ((event: PointerEvent | TouchEvent) => void) | undefined;
  onProgress?: ((progress: number, details?: UseSwipeDismissProgressDetails) => void) | undefined;
  onCancel?: ((event: PointerEvent | TouchEvent) => void) | undefined;
  /**
   * The composable calls it when a swipe starts and when it ends.
   */
  onSwipingChange?: ((swiping: boolean) => void) | undefined;
  /**
   * The composable calls it at the release. A return value of `true` or `false` replaces the
   * default decision to dismiss.
   */
  onRelease?:
    | ((details: {
        event: PointerEvent | TouchEvent;
        direction: SwipeDirection | undefined;
        deltaX: number;
        deltaY: number;
        velocityX: number;
        velocityY: number;
        releaseVelocityX: number;
        releaseVelocityY: number;
      }) => boolean | void)
    | undefined;
  onDismiss?:
    | ((event: PointerEvent | TouchEvent, details: { direction: SwipeDirection }) => void)
    | undefined;
}

export interface UseSwipeDismissReturnValue {
  swiping: Readonly<Ref<boolean>>;
  swipeDirection: Readonly<Ref<SwipeDirection | undefined>>;
  dragDismissed: Readonly<Ref<boolean>>;
  pointerProps: {
    onPointerdown: (event: PointerEvent) => void;
    onPointermove: (event: PointerEvent) => void;
    onPointerup: (event: PointerEvent) => void;
    onPointercancel: (event: PointerEvent) => void;
  };
  touchProps: {
    onTouchstartPassive: (event: TouchEvent) => void;
    onTouchmovePassive: (event: TouchEvent) => void;
    onTouchend: (event: TouchEvent) => void;
    onTouchcancel: (event: TouchEvent) => void;
  };
  /**
   * The move handler for a caller that gets `touchmove` in a capture listener and stops the
   * event. The listener of the element then does not get the event.
   */
  moveNative: (nativeEvent: TouchEvent, currentTarget: HTMLElement) => void;
  getDragStyles: () => CSSProperties;
  reset: () => void;
}
