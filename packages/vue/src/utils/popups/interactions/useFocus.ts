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

export interface UseFocusProps {
  /**
   * Whether the composable is enabled, including its window listeners and its event handlers.
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
  let keyboardModality = true;
  // The element that the last `focusin` event reached: the trigger of this composable. `KeepAlive`
  // closes the popup only when this element is the anchor of the store.
  let lastFocusedTrigger: Element | null = null;
  let deactivated = false;
  let disposed = false;

  const timeout = useTimeout();
  onScopeDispose(() => {
    disposed = true;
  });

  // The timer holds a request that the focus made while the composable was enabled, for the store
  // of that time. A change of either ends the request.
  watch([enabled, currentStore], () => timeout.clear());

  let stopWindowListeners: (() => void) | undefined;
  function listenToWindow() {
    stopWindowListeners?.();
    stopWindowListeners = undefined;
    if (!enabled() || deactivated) {
      return;
    }

    const win = ownerWindow(currentStore().select('anchorElement'));

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

    function onWindowKeydown() {
      keyboardModality = true;
    }

    function onWindowPointerdown() {
      keyboardModality = false;
    }

    const trackModality = isMacSafari();
    stopWindowListeners = mergeCleanups(
      addEventListener(win, 'blur', onWindowBlur),
      trackModality && addEventListener(win, 'keydown', onWindowKeydown, true),
      trackModality && addEventListener(win, 'pointerdown', onWindowPointerdown, true),
    );
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

      // Hit the non-modal focus management portal guard. Focus will be
      // moved into the floating element immediately after.
      const movedToFocusGuard =
        isElement(relatedTarget) &&
        relatedTarget.hasAttribute(createAttribute('focus-guard')) &&
        relatedTarget.getAttribute('data-type') === 'outside';

      // Wait for the window blur listener to fire.
      timeout.start(0, () => {
        const current = currentStore();
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
