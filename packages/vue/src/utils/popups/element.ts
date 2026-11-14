import { isElement, isHTMLElement } from '@floating-ui/utils/dom';
import { platform } from '../../common/platform';
import { closest, contains } from '../../common/shadowDom';
import * as TooltipTriggerDataAttributes from '../../tooltip/trigger/TooltipTriggerDataAttributes';
import { FOCUSABLE_ATTRIBUTE, TYPEABLE_SELECTOR } from './constants';
import type { PopupTriggerMap } from './popupTriggerMap';

export function isTargetInsideEnabledTrigger(
  target: EventTarget | null,
  triggerElements: PopupTriggerMap,
) {
  if (!isElement(target)) {
    return false;
  }

  // An inner trigger can register after its outer trigger. The first trigger of the map that
  // contains the target is then the outer one. The innermost trigger decides.
  let innermostTrigger: Element | undefined;
  for (const trigger of triggerElements.elements()) {
    if (contains(trigger, target) && (!innermostTrigger || contains(innermostTrigger, trigger))) {
      innermostTrigger = trigger;
    }
  }

  return (
    innermostTrigger !== undefined &&
    !innermostTrigger.hasAttribute(TooltipTriggerDataAttributes.triggerDisabled)
  );
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
  } catch (_e) {
    // A browser that does not know `:focus-visible` throws on this selector.
    return true;
  }
}

export function getFloatingFocusElement(
  positionerElement: HTMLElement | null | undefined,
): HTMLElement | null {
  if (!positionerElement) {
    return null;
  }
  // The positioner can be a wrapper. The focus then goes to the child that has the focusable
  // attribute, because that child has the event handlers and the aria attributes of the popup.
  return positionerElement.hasAttribute(FOCUSABLE_ATTRIBUTE)
    ? positionerElement
    : (positionerElement.querySelector(`[${FOCUSABLE_ATTRIBUTE}]`) ?? positionerElement);
}
