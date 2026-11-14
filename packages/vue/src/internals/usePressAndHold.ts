import { onDeactivated, onScopeDispose, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { NOOP } from '../common/empty';
import { ownerWindow } from '../common/owner';
import { useInterval } from '../common/useInterval';
import { useTimeout } from '../common/useTimeout';

const DEFAULT_TICK_DELAY = 60;
const DEFAULT_START_DELAY = 400;
const DEFAULT_SCROLL_DISTANCE = 8;
const TOUCH_TIMEOUT = 50;
const MAX_POINTER_MOVES_AFTER_TOUCH = 3;

// A pen is touch-like, so a tap of a stylus does not force the software keyboard.
// Chrome on Linux can send `pen` for a mouse. The touch path still works for it, with small
// differences.
export function isTouchLikePointerType(pointerType: string) {
  return pointerType === 'touch' || pointerType === 'pen';
}

export interface UsePressAndHoldParameters {
  disabled: MaybeRefOrGetter<boolean>;
  /**
   * Called on each tick during a hold. Return `false` to stop the auto-change sequence.
   */
  tick: (triggerEvent?: Event) => boolean;
  /**
   * Called when the hold ends via the global `pointerup` event.
   */
  onStop?: ((nativeEvent: PointerEvent) => void) | undefined;
  /**
   * Interval between ticks once the hold is active.
   * @default 60
   */
  tickDelay?: MaybeRefOrGetter<number | undefined> | undefined;
  /**
   * Delay before the repeating ticks start after the initial hold.
   * @default 400
   */
  startDelay?: MaybeRefOrGetter<number | undefined> | undefined;
  /**
   * Pointer movement distance (px) that cancels the hold and is treated as scrolling.
   * @default 8
   */
  scrollDistance?: MaybeRefOrGetter<number | undefined> | undefined;
  /**
   * The anchor element that gives the window for the global listeners.
   */
  elementRef: Readonly<Ref<HTMLElement | null>>;
}

export interface UsePressAndHoldReturnValue {
  pointerHandlers: {
    onTouchstartPassive: (event: TouchEvent) => void;
    onTouchend: (event: TouchEvent) => void;
    onPointerdown: (event: PointerEvent) => void;
    onPointerup: (event: PointerEvent) => void;
    onPointermove: (event: PointerEvent) => void;
    onMouseenter: (event: MouseEvent) => void;
    onMouseleave: (event: MouseEvent) => void;
    onMouseup: (event: MouseEvent) => void;
  };
  /**
   * Returns `true` if the `onClick` handler should be skipped.
   * Use this in the element's `onClick` to prevent double-firing on mouse clicks
   * (already handled by `onPointerdown`) and to suppress the synthesized click
   * that browsers fire after a touch hold.
   */
  shouldSkipClick: (event: MouseEvent) => boolean;
}

/**
 * Adds press-and-hold behavior to a button element.
 * A mouse press calls `tick` at once. A touch press calls `tick` when the touch settles, after
 * 50 ms. The first repeat comes `startDelay` plus `tickDelay` after that call, and each next
 * repeat comes `tickDelay` later.
 * Call it in `setup`.
 */
export function usePressAndHold(parameters: UsePressAndHoldParameters): UsePressAndHoldReturnValue {
  const { tick, onStop, elementRef } = parameters;

  const startTickTimeout = useTimeout();
  const tickInterval = useInterval();
  const intentionalTouchCheckTimeout = useTimeout();

  let isPressed = false;
  let movesAfterTouch = 0;
  let downCoords = { x: 0, y: 0 };
  let isTouchingButton = false;
  let ignoreClick = false;
  let pointerType = '';
  let unsubscribeFromGlobalContextMenu: () => void = NOOP;
  let unsubscribeFromGlobalPointerUp: () => void = NOOP;

  function isDisabled() {
    return toValue(parameters.disabled);
  }

  function stopAutoChange() {
    intentionalTouchCheckTimeout.clear();
    startTickTimeout.clear();
    tickInterval.clear();
    unsubscribeFromGlobalContextMenu();
    movesAfterTouch = 0;
  }

  function startAutoChange(triggerNativeEvent?: Event) {
    stopAutoChange();

    const element = elementRef.value;
    if (!element) {
      return;
    }

    const win = ownerWindow(element);

    // A touch that is slightly outside the element can still open the context menu.
    unsubscribeFromGlobalContextMenu = addEventListener(win, 'contextmenu', (event) => {
      event.preventDefault();
    });

    // `stopAutoChange` keeps this listener. A hold that stops at a boundary, when a tick returns
    // `false`, then still calls `onStop` on release. A new listener replaces the old one, so a
    // `mouseleave` and `mouseenter` during a hold do not call `onStop` more than once.
    unsubscribeFromGlobalPointerUp();
    unsubscribeFromGlobalPointerUp = addEventListener(
      win,
      'pointerup',
      (event) => {
        isPressed = false;
        stopAutoChange();
        onStop?.(event);
      },
      { once: true },
    );

    if (!tick(triggerNativeEvent)) {
      stopAutoChange();
      return;
    }

    startTickTimeout.start(toValue(parameters.startDelay) ?? DEFAULT_START_DELAY, () => {
      tickInterval.start(toValue(parameters.tickDelay) ?? DEFAULT_TICK_DELAY, () => {
        if (!tick(triggerNativeEvent)) {
          stopAutoChange();
        }
      });
    });
  }

  function release() {
    isPressed = false;
    stopAutoChange();
    unsubscribeFromGlobalPointerUp();
  }

  onScopeDispose(release);
  // `KeepAlive` takes the button out of the document and sends no `pointerup`.
  onDeactivated(release);

  watch(isDisabled, (disabled) => {
    if (disabled) {
      isPressed = false;
      isTouchingButton = false;
      pointerType = '';
      stopAutoChange();
    }
  });

  const pointerHandlers: UsePressAndHoldReturnValue['pointerHandlers'] = {
    // The handler never calls `preventDefault`, so the listener is passive and does not delay a
    // scroll.
    onTouchstartPassive() {
      isTouchingButton = true;
    },
    onTouchend() {
      isTouchingButton = false;
    },
    onPointerdown(event) {
      if (event.defaultPrevented || event.button || isDisabled()) {
        return;
      }

      pointerType = event.pointerType;
      ignoreClick = false;
      isPressed = true;
      downCoords = { x: event.clientX, y: event.clientY };

      if (!isTouchLikePointerType(event.pointerType)) {
        event.preventDefault();
        startAutoChange(event);
      } else {
        // A scroll or a pinch zoom also starts with a `pointerdown`. A hold starts only when the
        // touch is still there after a short time and has moved little.
        intentionalTouchCheckTimeout.start(TOUCH_TIMEOUT, () => {
          const moves = movesAfterTouch;
          movesAfterTouch = 0;
          // A quick tap can end before this timeout. Only a touch that is still pressed holds.
          if (isPressed && moves < MAX_POINTER_MOVES_AFTER_TOUCH) {
            startAutoChange(event);
            // The browser sends a click after the hold. That click must not step again.
            ignoreClick = true;
          } else {
            // A tap or a scroll starts no hold. The click handler does the one step.
            ignoreClick = false;
            stopAutoChange();
          }
        });
      }
    },
    onPointerup(event) {
      // The press of a touch ends here also when no hold started, so a quick tap does not start
      // one after the timeout.
      if (isTouchLikePointerType(event.pointerType)) {
        isPressed = false;
      }
    },
    onPointermove(event) {
      if (isDisabled() || !isTouchLikePointerType(event.pointerType) || !isPressed) {
        return;
      }

      movesAfterTouch += 1;

      const dx = downCoords.x - event.clientX;
      const dy = downCoords.y - event.clientY;
      const scrollDistance = toValue(parameters.scrollDistance) ?? DEFAULT_SCROLL_DISTANCE;

      if (dx ** 2 + dy ** 2 > scrollDistance ** 2) {
        stopAutoChange();
      }
    },
    onMouseenter(event) {
      if (
        event.defaultPrevented ||
        isDisabled() ||
        !isPressed ||
        isTouchingButton ||
        isTouchLikePointerType(pointerType)
      ) {
        return;
      }

      startAutoChange(event);
    },
    onMouseleave() {
      if (isTouchingButton) {
        return;
      }

      stopAutoChange();
    },
    // An ancestor can stop `pointerup` before it reaches the window, so this is a local fallback
    // for the release listener of the window.
    onMouseup() {
      if (isTouchingButton) {
        return;
      }

      stopAutoChange();
    },
  };

  function shouldSkipClick(event: MouseEvent): boolean {
    if (event.defaultPrevented) {
      return true;
    }
    if (isTouchLikePointerType(pointerType)) {
      return ignoreClick;
    }
    return event.detail !== 0;
  }

  return { pointerHandlers, shouldSkipClick };
}
