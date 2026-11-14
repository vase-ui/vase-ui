import { onActivated, onDeactivated, onMounted, onScopeDispose, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { isElement, isHTMLElement } from '@floating-ui/utils/dom';
import { addEventListener } from '../../../common/addEventListener';
import { mergeCleanups } from '../../../common/mergeCleanups';
import { ownerDocument, ownerWindow } from '../../../common/owner';
import { platform } from '../../../common/platform';
import { activeElement, contains, getTarget } from '../../../common/shadowDom';
import { useTimeout } from '../../../common/useTimeout';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import type { FloatingUIOpenChangeDetails, HTMLProps } from '../../../internals/types';
import { createAttribute } from '../createAttribute';
import { isTargetInsideEnabledTrigger, isTypeableElement, matchesFocusVisible } from '../element';
import type { PopupInteractionStore } from '../types';

// The check is a function, so that a case can set the flags of `platform`.
const isMacSafari = () => platform.os.mac && platform.engine.webkit;

interface ModalityTracker {
  /** Whether the last input of the window was a key and not a pointer press. */
  keyboard: boolean;
  users: number;
  stop: () => void;
}

// One tracker for each window. The modality is a state of the window, and a trigger can get enabled
// after the pointer press that opened its popup. The map is in the module, so each copy of the
// library has its own trackers.
const modalityTrackers = new WeakMap<Window, ModalityTracker>();

/**
 * Takes one use of the modality tracker of `win`. It returns the tracker and the function that gives
 * the use back. The last use removes the listeners of the tracker.
 */
function takeModalityTracker(win: Window): [ModalityTracker, () => void] {
  let tracker = modalityTrackers.get(win);

  if (!tracker) {
    const created: ModalityTracker = { keyboard: true, users: 0, stop: () => {} };
    created.stop = mergeCleanups(
      addEventListener(
        win,
        'keydown',
        () => {
          created.keyboard = true;
        },
        true,
      ),
      addEventListener(
        win,
        'pointerdown',
        () => {
          created.keyboard = false;
        },
        true,
      ),
    );
    modalityTrackers.set(win, created);
    tracker = created;
  }

  tracker.users += 1;
  const taken = tracker;

  return [
    taken,
    () => {
      taken.users -= 1;
      if (taken.users === 0) {
        taken.stop();
        modalityTrackers.delete(win);
      }
    },
  ];
}

export interface UseFocusProps {
  /**
   * Whether the composable is enabled, including its event handlers and its listener for the blur
   * of the window. In Safari on a Mac, the tracker of the input modality also runs while it is not
   * enabled.
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
export function useFocus(
  store: MaybeRefOrGetter<PopupInteractionStore>,
  props: UseFocusProps = {},
): Omit<HTMLProps, 'ref'> {
  const enabled = () => toValue(props.enabled) ?? true;
  const currentStore = () => toValue(store);

  let blockFocus = false;
  // Track which reference should be blocked from re-opening after Escape/press dismissal.
  let blockedReference: Element | null = null;
  let modality: ModalityTracker | undefined;
  // The element that the last `focusin` event reached: the trigger of this composable. `KeepAlive`
  // closes the popup only when this element is the anchor of the store.
  let lastFocusedTrigger: Element | null = null;
  let deactivated = false;
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

  let stopWindowListeners: (() => void) | undefined;
  function startWindowListeners(): (() => void) | undefined {
    if (deactivated) {
      return undefined;
    }

    const win = ownerWindow(currentStore().select('anchorElement'));
    // Base UI tracks the modality only while the composable is enabled. A trigger of a menubar is
    // enabled only while a menu of the menubar is open, so it misses the press that opened the menu.
    let giveModalityBack: (() => void) | undefined;
    if (isMacSafari()) {
      [modality, giveModalityBack] = takeModalityTracker(win);
    }

    if (!enabled()) {
      return giveModalityBack;
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

    return mergeCleanups(addEventListener(win, 'blur', onWindowBlur), giveModalityBack);
  }

  function listenToWindow() {
    // The new use of the modality tracker comes before the old use goes. The count of its uses then
    // does not go through zero, and the tracker keeps the modality.
    const stopPrevious = stopWindowListeners;
    modality = undefined;
    stopWindowListeners = startWindowListeners();
    stopPrevious?.();
  }
  onMounted(listenToWindow);
  watch([enabled, currentStore], listenToWindow, { flush: 'post' });
  onScopeDispose(() => stopWindowListeners?.());

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

  let stopListeningToOpenChange: (() => void) | undefined;
  function listenToOpenChange() {
    stopListeningToOpenChange?.();
    stopListeningToOpenChange = undefined;
    if (!enabled()) {
      return;
    }
    const { events } = currentStore().context;
    events.on('openchange', onOpenChangeLocal);
    stopListeningToOpenChange = () => events.off('openchange', onOpenChangeLocal);
  }
  onMounted(listenToOpenChange);
  watch([enabled, () => currentStore().context.events], listenToOpenChange);
  onScopeDispose(() => stopListeningToOpenChange?.());

  // `KeepAlive` takes the focused trigger out of the document. Firefox and WebKit send no
  // `focusout` for it. A popup that focus opened would then stay open after the activation, with
  // no focus on its trigger.
  onDeactivated(() => {
    deactivated = true;
    timeout.clear();
    listenToWindow();

    const current = currentStore();
    if (
      current.select('open') &&
      current.context.openEvent?.type === 'focusin' &&
      lastFocusedTrigger === current.select('anchorElement')
    ) {
      current.setOpen(false, createChangeEventDetails(REASONS.triggerFocus));
    }
  });
  // `onActivated` also runs at the first mount in a `KeepAlive`.
  onActivated(() => {
    if (deactivated) {
      deactivated = false;
      listenToWindow();
    }
  });

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
          if (!(modality?.keyboard ?? true) && !isTypeableElement(target)) {
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
