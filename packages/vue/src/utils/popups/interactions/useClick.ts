import { onDeactivated, toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { getTarget } from '../../../common/shadowDom';
import { useAnimationFrame } from '../../../common/useAnimationFrame';
import { useTimeout } from '../../../common/useTimeout';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { isTypeableElement } from '../element';
import { isMouseLikePointerType, isVirtualPointerEvent } from '../event';
import type { ClickElementProps, PopupInteractionStore } from '../types';

export interface UseClickProps {
  /**
   * Whether the composable is enabled, including all internal event handlers.
   * @default true
   */
  enabled?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * The type of event to use to determine a “click” with mouse input.
   * Keyboard clicks work as normal.
   * @default 'click'
   */
  event?: MaybeRefOrGetter<'click' | 'mousedown' | 'mousedown-only' | undefined>;
  /**
   * Whether to toggle the open state with repeated clicks.
   * @default true
   */
  toggle?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Whether to ignore the logic for mouse input (for example, if a hover interaction is also being
   * used).
   * @default false
   */
  ignoreMouse?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * If already open from another event such as hover, determines whether to keep the floating
   * element open when clicking the reference element for the first time. A getter is read at each
   * press.
   * @default true
   */
  stickIfOpen?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Touch-only delay (ms) before opening. Useful to allow mobile viewport/keyboard to settle.
   * @default 0
   */
  touchOpenDelay?: MaybeRefOrGetter<number | undefined>;
  /**
   * The reason for the click.
   * @default REASONS.triggerPress
   */
  reason?: MaybeRefOrGetter<typeof REASONS.triggerPress | typeof REASONS.inputPress | undefined>;
}

/**
 * Opens or closes the floating element when clicking the reference element.
 *
 * Call it in the `setup` of the trigger. The handlers read each option and the store when an event
 * comes, so a value, a ref or a getter follows a change. The frame and the touch timer stop when
 * the part unmounts and when `KeepAlive` deactivates it.
 * @see https://floating-ui.com/docs/useClick
 */
export function useClick(
  store: MaybeRefOrGetter<PopupInteractionStore>,
  props: UseClickProps = {},
): ClickElementProps {
  const {
    enabled,
    event: eventOption,
    toggle,
    ignoreMouse,
    stickIfOpen,
    touchOpenDelay,
    reason,
  } = props;

  let lastPointerType: string | undefined;
  const frame = useAnimationFrame();
  const touchOpenTimeout = useTimeout();

  const isEnabled = () => toValue(enabled) ?? true;

  function setOpenWithTouchDelay(
    currentStore: PopupInteractionStore,
    nextOpen: boolean,
    nativeEvent: MouseEvent,
    target: HTMLElement,
    pointerType: string | undefined,
  ) {
    const details = createChangeEventDetails(
      toValue(reason) ?? REASONS.triggerPress,
      nativeEvent,
      target,
    );
    const delay = toValue(touchOpenDelay) ?? 0;

    if (nextOpen && pointerType === 'touch' && delay > 0) {
      touchOpenTimeout.start(delay, () => {
        currentStore.setOpen(true, details);
      });
    } else {
      currentStore.setOpen(nextOpen, details);
    }
  }

  function getNextOpen(
    currentStore: PopupInteractionStore,
    open: boolean,
    currentTarget: EventTarget | null,
    isClickLikeOpenEvent: (eventType: string | undefined) => boolean,
  ) {
    const openEvent = currentStore.context.openEvent;
    const hasClickedOnInactiveTrigger = currentStore.select('anchorElement') !== currentTarget;

    if (open && hasClickedOnInactiveTrigger) {
      // Moving between triggers should always open the newly active one.
      return true;
    }

    if (!open) {
      // A closed popup should open on the next press.
      return true;
    }

    if (!(toValue(toggle) ?? true)) {
      // Non-toggle mode never closes on a repeated trigger press.
      return true;
    }

    if (openEvent && (toValue(stickIfOpen) ?? true)) {
      // Preserve hover/focus-opened popups until the matching click-like event closes them.
      return !isClickLikeOpenEvent(openEvent.type);
    }

    // Otherwise, a repeated click toggles the popup closed.
    return false;
  }

  // A press that waits must not open the popup after `KeepAlive` deactivates the part.
  onDeactivated(() => {
    frame.cancel();
    touchOpenTimeout.clear();
  });

  const reference: ClickElementProps['reference'] = {
    onPointerdown(event) {
      if (!isEnabled()) {
        return;
      }

      // Screen reader activations (Android TalkBack, desktop screen readers) report a
      // mouse-like `pointerType`, but `ignoreMouse` must not drop them: hover logic cannot
      // open for a virtual press since there is no real pointer movement to wait for.
      // Virtual `touch` presses (iOS VoiceOver) keep their type so `touchOpenDelay` applies.
      lastPointerType =
        isMouseLikePointerType(event.pointerType, true) && isVirtualPointerEvent(event)
          ? 'virtual'
          : event.pointerType;
    },
    onMousedown(event) {
      if (!isEnabled()) {
        return;
      }

      const currentStore = toValue(store);
      const pointerType = lastPointerType;
      const open = currentStore.select('open');

      // Ignore all buttons except for the "main" button.
      // https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
      if (
        event.button !== 0 ||
        (toValue(eventOption) ?? 'click') === 'click' ||
        (isMouseLikePointerType(pointerType, true) && toValue(ignoreMouse))
      ) {
        return;
      }

      const nextOpen = getNextOpen(
        currentStore,
        open,
        event.currentTarget,
        (openEventType) => openEventType === 'click' || openEventType === 'mousedown',
      );

      // Animations sometimes won't run on a typeable element if using a rAF.
      // Focus is always set on these elements. For touch, we may delay opening.
      // A screen reader press opens synchronously, so the popup's focus lands before the reader
      // re-syncs focus to its cursor, which would otherwise read as a stray move.
      const target = getTarget(event);
      const isTypeable = isTypeableElement(target);

      if (isTypeable || pointerType === 'virtual') {
        // A virtual press may target a descendant of the trigger; the trigger is what opened.
        const pressedElement = (isTypeable ? target : event.currentTarget) as HTMLElement;

        // The reader only moves focus to its cursor after the press, so focus the trigger first.
        // Otherwise the popup records the previously focused element as where focus returns.
        // Like the browser's own mousedown focus, skip it when the default was prevented.
        if (!open && !isTypeable && !event.defaultPrevented) {
          pressedElement.focus({ preventScroll: true });
        }

        setOpenWithTouchDelay(currentStore, nextOpen, event, pressedElement, pointerType);
        return;
      }

      // Capture the currentTarget before the rAF.
      // The DOM sets it to null after the event dispatch completes.
      const eventCurrentTarget = event.currentTarget as HTMLElement;

      // Wait until focus is set on the element. This is an alternative to
      // `event.preventDefault()` to avoid :focus-visible from appearing when using a pointer.
      frame.request(() => {
        setOpenWithTouchDelay(currentStore, nextOpen, event, eventCurrentTarget, pointerType);
      });
    },
    onClick(event) {
      if (!isEnabled()) {
        return;
      }

      const eventType = toValue(eventOption) ?? 'click';

      if (eventType === 'mousedown-only') {
        return;
      }

      const pointerType = lastPointerType;

      if (eventType === 'mousedown' && pointerType) {
        lastPointerType = undefined;
        return;
      }

      if (isMouseLikePointerType(pointerType, true) && toValue(ignoreMouse)) {
        return;
      }

      const currentStore = toValue(store);
      const open = currentStore.select('open');
      const nextOpen = getNextOpen(
        currentStore,
        open,
        event.currentTarget,
        (openEventType) =>
          openEventType === 'click' ||
          openEventType === 'mousedown' ||
          openEventType === 'keydown' ||
          openEventType === 'keyup',
      );
      setOpenWithTouchDelay(
        currentStore,
        nextOpen,
        event,
        event.currentTarget as HTMLElement,
        pointerType,
      );
    },
    onKeydown() {
      if (!isEnabled()) {
        return;
      }

      lastPointerType = undefined;
    },
  };

  return { reference };
}
