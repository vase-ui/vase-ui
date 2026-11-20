import { isElement, isHTMLElement } from '@floating-ui/utils/dom';
import { platform } from '../../common/platform';
import { closest, contains } from '../../common/shadowDom';
import { FOCUSABLE_ATTRIBUTE, TYPEABLE_SELECTOR } from './constants';
import type { PopupTriggerMap } from './usePopupRoot';

export function isTargetInsideEnabledTrigger(
  target: EventTarget | null,
  triggerElements: PopupTriggerMap,
) {
  if (!isElement(target)) {
    return false;
  }

  return closest(target, (element) => triggerElements.hasElement(element)) !== null;
}

export function isEventTargetWithin(event: Event, node: Node | null | undefined) {
  if (node == null) {
    return false;
  }

  if ('composedPath' in event) {
    return event.composedPath().includes(node);
  }

  // TypeScript assumes that `composedPath` always exists, so it types `event` as `never` here.
  // An old browser with no shadow DOM does not have it.
  const eventAgain = event as Event;
  return eventAgain.target != null && contains(node as Element, eventAgain.target as Element);
}

export function isRootElement(element: Element): boolean {
  return element.matches('html,body');
}

export function isTypeableElement(element: unknown): boolean {
  return isHTMLElement(element) && element.matches(TYPEABLE_SELECTOR);
}

export function isInteractiveElement(element: Element | null) {
  return (
    closest(
      element,
      `button,a[href],[role="button"],select,[tabindex]:not([tabindex="-1"]),${TYPEABLE_SELECTOR}`,
    ) != null
  );
}

export function isTypeableCombobox(element: Element | null) {
  if (!element) {
    return false;
  }
  return element.getAttribute('role') === 'combobox' && isTypeableElement(element);
}

export function matchesFocusVisible(element: Element | null) {
  // In jsdom, an element that has `:focus` does not match `:focus-visible`. The check returns
  // `true` there, so that it does not block the focus.
  if (!element || platform.env.jsdom) {
    return true;
  }
  try {
    return element.matches(':focus-visible');
  } catch {
    // A browser that does not know `:focus-visible` throws on this selector.
    return true;
  }
}

export function getFloatingFocusElement(
  positionerElement: HTMLElement | null | undefined,
  popupElement: HTMLElement | null | undefined,
): HTMLElement | null {
  if (!positionerElement) {
    return null;
  }
  if (popupElement !== undefined) {
    return popupElement?.isConnected ? popupElement : positionerElement;
  }
  // A raw floating wrapper can mark an arbitrary child as its focus target.
  return positionerElement.hasAttribute(FOCUSABLE_ATTRIBUTE)
    ? positionerElement
    : (positionerElement.querySelector<HTMLElement>(`[${FOCUSABLE_ATTRIBUTE}]`) ??
        positionerElement);
}
