import { computed, onMounted, shallowRef, toRaw, toValue, watch, onScopeDispose } from 'vue';
import type { ComputedRef, MaybeRefOrGetter, ShallowRef, Ref } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { triggerBindings } from './popupBindings';
import { readTriggerStore } from './popupHandle';
import type { PopupHandleStoreProvider } from './popupHandle';
import { canClaimOpenPopup, popupStoreSelectors } from './usePopupRoot';
import type { PopupStoreState, PopupTriggerDataStore } from './usePopupRoot';
import { getTarget, activeElement, contains } from '../../common/shadowDom';
import { useAnimationFrame } from '../../common/useAnimationFrame';
import { useTimeout } from '../../common/useTimeout';
import type { VaseUIChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { isTypeableElement, isTargetInsideEnabledTrigger, matchesFocusVisible } from './element';
import { isMouseLikePointerType, isVirtualPointerEvent } from './event';
import type { PopupInteractionStore } from './types';
import { isElement, isHTMLElement } from '@floating-ui/utils/dom';
import { addEventListener } from '../../common/addEventListener';
import { mergeCleanups } from '../../common/mergeCleanups';
import { ownerDocument, ownerWindow } from '../../common/owner';
import { platform } from '../../common/platform';
import type { FloatingUIOpenChangeDetails } from '../../internals/types';
import { createAttribute } from './createAttribute';
import { useDomEffect } from './useDomEffect';
import { useValueChanged } from '../../internals/useValueChanged';

export type InteractionType = 'mouse' | 'touch' | 'pen' | 'keyboard' | '';

/**
 * Gives the type of the input that made a click: a pointer type, or `'keyboard'`. Safari and Firefox
 * give a `MouseEvent` to a click handler, and a `MouseEvent` has no pointer type. A `PointerEvent`
 * that a script or a test tool made can also have an empty pointer type. In both cases, the type is
 * the one that the last `pointerdown` had.
 *
 * Call it in `setup`. Bind `onClick` and `onPointerdown` on the element.
 *
 * @param handler The function that the events call. It gets the event and the type of the input.
 */
export function useEnhancedClickHandler(
  handler: (event: MouseEvent | PointerEvent, interactionType: InteractionType) => void,
) {
  let lastClickInteractionType: InteractionType = '';

  function handlePointerdown(event: PointerEvent) {
    if (event.defaultPrevented) {
      return;
    }

    lastClickInteractionType = event.pointerType as InteractionType;
    handler(event, event.pointerType as InteractionType);
  }

  function handleClick(event: MouseEvent | PointerEvent) {
    // `event.detail` has the number of clicks on the element. 0 means that the keyboard made the
    // click.
    if (event.detail === 0) {
      handler(event, 'keyboard');
      return;
    }

    // Chrome and Edge give a `PointerEvent`.
    const pointerType = 'pointerType' in event ? (event.pointerType as InteractionType) : '';
    handler(event, pointerType || lastClickInteractionType);
    lastClickInteractionType = '';
  }

  return { onClick: handleClick, onPointerdown: handlePointerdown };
}

export function usePopupHandleStore<HandleStore>(
  handle: MaybeRefOrGetter<PopupHandleStoreProvider<HandleStore> | undefined>,
): ComputedRef<HandleStore | undefined> {
  const isHydrating = useIsHydrating();

  return computed(() => {
    const current = toValue(handle);
    if (current === undefined) {
      return undefined;
    }
    return isHydrating.value ? current.serverStore : readTriggerStore(current);
  });
}

export function useTriggerOwner<Store>(
  root: Store | undefined,
  handle: () => PopupHandleStoreProvider<Store> | undefined,
  missingRoot: string,
) {
  const attached = usePopupHandleStore(handle);
  if (root === undefined && handle() === undefined) {
    throw new Error(missingRoot);
  }
  return computed(() => attached.value ?? (root as Store));
}

function syncTriggerCount(store: PopupTriggerDataStore<PopupStoreState<unknown>>) {
  // The cleanup of a registration runs while Vue unmounts a part, in the render of its parent. A
  // read of the reactive state there would make that render depend on the state.
  const state = toRaw(store.state);
  const triggerCount = store.context.triggerElements.size;
  if (popupStoreSelectors.open(state) && state.triggerCount !== triggerCount) {
    store.set('triggerCount', triggerCount);
  }
}

/** A held trigger retains its place. Vue activates children in reverse order. */
export function useTriggerRegistration<State extends PopupStoreState<unknown>>(
  id: MaybeRefOrGetter<string | undefined>,
  store: MaybeRefOrGetter<PopupTriggerDataStore<State>>,
  onRegister?: (
    element: Element,
    store: PopupTriggerDataStore<State>,
    id: string,
    activated: boolean,
  ) => void,
) {
  const element = shallowRef<Element | null>(null);
  const { isHeld } = useKeepAliveState();

  let registration:
    { store: PopupTriggerDataStore<State>; id: string; element: Element } | undefined;

  watch(
    [() => toValue(store), () => toValue(id), element] as const,
    ([currentStore, currentId, currentElement], _previous, onCleanup) => {
      if (currentElement === null || currentId === undefined) {
        return;
      }

      const triggerElements = currentStore.context.triggerElements;
      triggerElements.add(currentId, currentElement);
      registration = { store: currentStore, id: currentId, element: currentElement };
      onCleanup(() => {
        registration = undefined;
        // Another trigger can take the id before this cleanup runs. That entry stays.
        triggerElements.delete(currentId, currentElement);
        syncTriggerCount(currentStore);
      });

      triggerElements.setActive(currentId, !isHeld.value);
      syncTriggerCount(currentStore);
      if (!isHeld.value) {
        onRegister?.(currentElement, currentStore, currentId, false);
      }
    },
    { flush: 'post' },
  );

  watch(
    isHeld,
    (held) => {
      if (registration === undefined) {
        return;
      }

      registration.store.context.triggerElements.setActive(registration.id, !held);
      syncTriggerCount(registration.store);
      if (!held) {
        onRegister?.(registration.element, registration.store, registration.id, true);
      }
    },
    { flush: 'post' },
  );

  return {
    element: element as Readonly<ShallowRef<Element | null>>,
    registerTrigger: (next: Element | null) => {
      element.value = next;
    },
  };
}

/** Accept data from the mounted trigger. The root selects the trigger on activation. */
export function usePopupTrigger<
  State extends PopupStoreState<unknown>,
  const Key extends keyof Omit<State, 'activeTriggerId' | 'activeTriggerElement'>,
  Details extends VaseUIChangeEventDetails<string>,
>(
  triggerId: MaybeRefOrGetter<string | undefined>,
  store: MaybeRefOrGetter<
    PopupTriggerDataStore<State> & { setOpen(open: boolean, details: Details): void }
  >,
  stateUpdates: () => Pick<State, Key>,
) {
  const state = () => toValue(store).state;
  const open = computed(() => popupStoreSelectors.open(state()));
  const id = () => toValue(triggerId);
  const isMountedByThisTrigger = computed(() =>
    popupStoreSelectors.isMountedByTrigger(state(), id()),
  );

  const { element, registerTrigger } = useTriggerRegistration(
    triggerId,
    store,
    (registered, currentStore, id, activated) => {
      const state = toRaw(currentStore.state);
      const open = popupStoreSelectors.open(state);
      const activeTriggerId = popupStoreSelectors.activeTriggerId(state);

      if (activeTriggerId === id) {
        currentStore.update({
          activeTriggerElement: registered,
          ...(open ? stateUpdates() : null),
        } as Pick<Readonly<State>, Key | 'activeTriggerElement'>);
        return;
      }

      if (!activated && canClaimOpenPopup(state)) {
        // A detached trigger can mount while the popup is open and has no active trigger. The
        // first trigger that registers then claims the popup. A popup that opened with no trigger
        // keeps its own state, such as the payload that the caller gave.
        currentStore.update({
          activeTriggerId: id,
          activeTriggerElement: registered,
          ...stateUpdates(),
        } as Pick<Readonly<State>, Key | 'activeTriggerId' | 'activeTriggerElement'>);
      }
    },
  );

  function forward() {
    if (isMountedByThisTrigger.value) {
      toValue(store).update({
        activeTriggerElement: element.value,
        ...stateUpdates(),
      } as Pick<Readonly<State>, Key | 'activeTriggerElement'>);
    }
  }

  onMounted(forward);
  watch(
    [isMountedByThisTrigger, () => toValue(store), () => Object.values(stateUpdates())] as const,
    forward,
  );

  return {
    element,
    registerTrigger,
    open,
    usePress: (options?: UseClickProps) => useTriggerPress(store, options),
    useFocus: (options?: UseFocusProps) => useTriggerFocus(store, options),
    useModality: (setMethod: (method: InteractionType | null) => void) =>
      useTriggerModality(open, setMethod),
    requestOpen: (open: boolean, details: Details) => toValue(store).setOpen(open, details),
    bindings: computed(() => triggerBindings(toValue(store), isMountedByThisTrigger.value)),
    isMountedByThisTrigger,
    isTriggerActive: computed(() => popupStoreSelectors.isTriggerActive(state(), id())),
    isOpenedByThisTrigger: computed(() => popupStoreSelectors.isOpenedByTrigger(state(), id())),
    popupId: computed(() => popupStoreSelectors.triggerPopupId(state(), id())),
  };
}

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
 * comes, so a ref or a getter follows a change. The frame and the touch timer stop when
 * the part unmounts and when `KeepAlive` deactivates it.
 * @see https://floating-ui.com/docs/useClick
 */
export function useTriggerPress(
  store: MaybeRefOrGetter<PopupInteractionStore>,
  props: UseClickProps = {},
) {
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
  const { isHeld } = useKeepAliveState();
  watch(
    isHeld,
    (held) => {
      if (held) {
        frame.cancel();
        touchOpenTimeout.clear();
      }
    },
    { flush: 'sync' },
  );

  return {
    onPointerdown(event: PointerEvent) {
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
    onMousedown(event: MouseEvent) {
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
    onClick(event: MouseEvent) {
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
}

// The check is a function, so that a case can set the flags of `platform`.
const isMacSafari = () => platform.os.mac && platform.engine.webkit;

export interface UseFocusProps {
  /**
   * Whether the composable is enabled, including its event handlers and its listener for the blur
   * of the window. In Safari on a Mac, the listeners that track the input modality also run while
   * it is not enabled.
   * @default true
   */
  enabled?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Waits for the specified time, in milliseconds, before opening.
   * @default undefined
   */
  delay?: MaybeRefOrGetter<number | undefined>;
}

/**
 * Gives the listeners of a trigger that opens a popup while the trigger has focus, like CSS
 * `:focus`. Call it in `setup`. The part puts the object in the `props` of `useRenderElement`,
 * before its own props and its attributes. Each listener returns while the composable is not
 * enabled.
 * @see https://floating-ui.com/docs/useFocus
 */
export function useTriggerFocus(
  store: MaybeRefOrGetter<PopupInteractionStore>,
  props: UseFocusProps = {},
) {
  const enabled = () => toValue(props.enabled) ?? true;
  const currentStore = () => toValue(store);

  let blockFocus = false;
  // Track which reference should be blocked from re-opening after Escape/press dismissal.
  let blockedReference: Element | null = null;
  let keyboardModality = true;
  // The element that the last `focusin` event reached: the trigger of this composable. `KeepAlive`
  // closes the popup only when this element is the anchor of the store.
  let lastFocusedTrigger: Element | null = null;
  const { isHeld } = useKeepAliveState();
  let disposed = false;

  // As in Base UI, one timer serves the open request of a focus and the check of a focus out. The
  // flag tells which of the two started the timer last.
  const timeout = useTimeout();
  let timerStartedForOpen = false;
  onScopeDispose(() => {
    disposed = true;
  });

  // A change of `enabled` or of the store ends an open request. It does not end the check of a focus
  // out: as in Base UI, the check closes the store that the focus left.
  watch([enabled, currentStore], () => {
    if (timerStartedForOpen) {
      timeout.clear();
    }
  });

  function onWindowKeydown() {
    keyboardModality = true;
  }

  function onWindowPointerdown() {
    keyboardModality = false;
  }

  function listenToWindow() {
    const win = ownerWindow(currentStore().select('anchorElement'));
    // Base UI tracks the modality only while the composable is enabled. A trigger of a menubar is
    // enabled only while a menu of the menubar is open, so it would miss the press that opened the
    // menu.
    const trackModality = isMacSafari();
    const stopTrackingModality = mergeCleanups(
      trackModality && addEventListener(win, 'keydown', onWindowKeydown, true),
      trackModality && addEventListener(win, 'pointerdown', onWindowPointerdown, true),
    );
    if (!enabled()) {
      return stopTrackingModality;
    }

    // If the reference was focused and the user left the tab/window, and the
    // floating element was not open, the focus should be blocked when they
    // return to the tab/window.
    function onWindowBlur() {
      const current = currentStore();
      const domReference = current.select('anchorElement');
      if (
        !current.select('open') &&
        isHTMLElement(domReference) &&
        domReference === activeElement(ownerDocument(domReference))
      ) {
        blockFocus = true;
        blockedReference = domReference;
      }
    }

    return mergeCleanups(addEventListener(win, 'blur', onWindowBlur), stopTrackingModality);
  }
  useDomEffect([enabled, currentStore], listenToWindow, isHeld);

  // A dismissal by Escape or by a press of the trigger leaves the focus on the trigger. The same
  // focus must not open the popup again.
  function onOpenChangeLocal(details: FloatingUIOpenChangeDetails) {
    if (details.reason === REASONS.triggerPress || details.reason === REASONS.escapeKey) {
      const referenceElement = currentStore().select('anchorElement');
      if (isElement(referenceElement)) {
        blockedReference = referenceElement;
        blockFocus = true;
      }
    }
  }

  onMounted(() => {
    watch(
      [enabled, () => currentStore().context.events],
      ([isEnabled, events], _previous, onCleanup) => {
        if (isEnabled) {
          events.on('openchange', onOpenChangeLocal);
          onCleanup(() => events.off('openchange', onOpenChangeLocal));
        }
      },
      { immediate: true },
    );
  });

  // `KeepAlive` takes the focused trigger out of the document. Firefox and WebKit send no
  // `focusout` for it. A popup that focus opened would then stay open after the activation, with
  // no focus on its trigger.
  watch(
    isHeld,
    (held) => {
      if (!held) {
        return;
      }

      timeout.clear();
      const current = currentStore();
      if (
        current.select('open') &&
        current.context.openEvent?.type === 'focusin' &&
        lastFocusedTrigger === current.select('anchorElement')
      ) {
        current.setOpen(false, createChangeEventDetails(REASONS.triggerFocus));
      }
    },
    { flush: 'sync' },
  );

  function resetBlockedFocus() {
    blockFocus = false;
    blockedReference = null;
  }

  return {
    onMouseleave() {
      if (enabled()) {
        resetBlockedFocus();
      }
    },
    onFocusin(event: FocusEvent) {
      if (!enabled()) {
        return;
      }

      const focusTarget = event.currentTarget as Element;
      lastFocusedTrigger = focusTarget;

      if (blockFocus) {
        if (blockedReference === focusTarget) {
          return;
        }

        resetBlockedFocus();
      }

      const target = getTarget(event);

      if (isElement(target)) {
        // Safari fails to match `:focus-visible` if focus was initially
        // outside the document.
        if (isMacSafari() && !event.relatedTarget) {
          if (!keyboardModality && !isTypeableElement(target)) {
            return;
          }
        } else if (!matchesFocusVisible(target)) {
          return;
        }
      }

      const current = currentStore();
      const movedFromOtherEnabledTrigger = isTargetInsideEnabledTrigger(
        event.relatedTarget,
        current.context.triggerElements,
      );
      const delay = toValue(props.delay);

      if ((current.select('open') && movedFromOtherEnabledTrigger) || !delay) {
        current.setOpen(true, createChangeEventDetails(REASONS.triggerFocus, event, focusTarget));
        return;
      }

      timerStartedForOpen = true;
      timeout.start(delay, () => {
        if (blockFocus) {
          return;
        }

        current.setOpen(true, createChangeEventDetails(REASONS.triggerFocus, event, focusTarget));
      });
    },
    onFocusout(event: FocusEvent) {
      // Chromium sends this event when Vue removes the focused trigger, after the scope stopped.
      if (!enabled() || disposed) {
        return;
      }

      resetBlockedFocus();

      const relatedTarget = event.relatedTarget;
      // The check closes the store that the focus left, also when the store changes before the
      // check runs.
      const current = currentStore();

      // Hit the non-modal focus management portal guard. Focus will be
      // moved into the floating element immediately after.
      const movedToFocusGuard =
        isElement(relatedTarget) &&
        relatedTarget.hasAttribute(createAttribute('focus-guard')) &&
        relatedTarget.getAttribute('data-type') === 'outside';

      // Wait for the window blur listener to fire. The check replaces an open request that waits.
      timerStartedForOpen = false;
      timeout.start(0, () => {
        const domReference = current.select('anchorElement');
        const activeEl = activeElement(ownerDocument(domReference));

        // Focus left the page, keep it open.
        if (!relatedTarget && activeEl === domReference) {
          return;
        }

        // When focusing the reference element (e.g. regular click), then
        // clicking into the floating element, prevent it from hiding.
        // Note: it must be focusable, e.g. `tabindex="-1"`.
        // We can not rely on relatedTarget to point to the correct element
        // as it will only point to the shadow host of the newly focused element
        // and not the element that actually has received focus if it is located
        // inside a shadow root.
        if (
          contains(current.select('positionerElement'), activeEl) ||
          contains(domReference, activeEl) ||
          movedToFocusGuard
        ) {
          return;
        }

        // If the next focused element is one of the triggers, do not close
        // the floating element. The focus handler of that trigger will
        // handle the open state.
        const nextFocusedElement = relatedTarget ?? activeEl;
        if (isTargetInsideEnabledTrigger(nextFocusedElement, current.context.triggerElements)) {
          return;
        }

        current.setOpen(false, createChangeEventDetails(REASONS.triggerFocus, event));
      });
    },
  };
}

/**
 * Gives the listeners that tell `setOpenMethod` the type of the input that presses the trigger.
 * They do this only while the popup is closed. Call it in `setup`.
 *
 * @param open The open state of the popup, as a ref or a getter.
 * @param setOpenMethod The function that gets the type of the input.
 */
export function useTriggerModality(
  open: MaybeRefOrGetter<boolean>,
  setOpenMethod: (interactionType: InteractionType | null) => void,
) {
  return useEnhancedClickHandler((_event, interactionType) => {
    if (!toValue(open)) {
      setOpenMethod(
        interactionType ||
          // On iOS Safari, the hitslop around touch targets means tapping outside an element's
          // bounds does not fire `pointerdown` but does fire `mousedown`. The `interactionType`
          // will be "" in that case.
          (platform.os.ios ? 'touch' : ''),
      );
    }
  });
}

/**
 * Determines the interaction type (keyboard, mouse, touch, etc.) that opened the component.
 * Call it in `setup`, and bind `triggerProps` on the trigger.
 *
 * @param open The open state of the component, as a ref or a getter.
 */
export function useOpenInteractionType(open: MaybeRefOrGetter<boolean>): {
  openMethod: Readonly<Ref<InteractionType | null>>;
  triggerProps: ReturnType<typeof useTriggerModality>;
} {
  const openMethod = shallowRef<InteractionType | null>(null);

  const triggerProps = useTriggerModality(open, (interactionType) => {
    openMethod.value = interactionType;
  });

  useValueChanged(open, (previousOpen) => {
    if (previousOpen && !toValue(open)) {
      openMethod.value = null;
    }
  });

  return { openMethod, triggerProps };
}
