import { nextTick, watch } from 'vue';
import { ownerDocument } from '../common/owner';
import { activeElement } from '../common/shadowDom';
import type { Layer } from './layer';
import type { InteractionType, PopupRoot } from './root';

/**
 * Where the focus goes: `true` or `null` for the default target, `false` for no move, an element,
 * or a function of the interaction type that gives one of them. A function that gives nothing moves
 * no focus.
 */
export type FocusTarget =
  | boolean
  | HTMLElement
  | null
  | ((interaction: InteractionType) => HTMLElement | boolean | null | undefined | void);

const CANDIDATES =
  'a[href],area[href],button,input:not([type="hidden"]),select,textarea,iframe,summary,details,audio[controls],video[controls],[tabindex],[contenteditable]:not([contenteditable="false"])';

/**
 * The tab stops in the container, in the order of the document: each focusable element with a
 * `tabIndex` of 0 or more that is not disabled, not inert and shown, and one radio of a group. The
 * elements in `skipped` are none.
 */
export function tabbables(container: Element, skipped?: Element): HTMLElement[] {
  const found: HTMLElement[] = [];
  collect(container, found);
  if (skipped) found.splice(0, Infinity, ...found.filter((element) => !skipped.contains(element)));
  return found.filter((element) => {
    if (!isNamedRadio(element)) return true;
    const group = found.filter(
      (other): other is HTMLInputElement =>
        isNamedRadio(other) && other.name === element.name && other.form === element.form,
    );
    return element === (group.find((radio) => radio.checked) ?? group[0]);
  });
}

// The content of an open shadow root takes the place of its host in the order.
function collect(container: Element | ShadowRoot, found: HTMLElement[]) {
  for (const element of container.querySelectorAll<HTMLElement>('*')) {
    if (element.matches(CANDIDATES) && isTabbable(element)) found.push(element);
    if (element.shadowRoot) collect(element.shadowRoot, found);
  }
}

// A browser gives an editable element and a media element with controls the `tabIndex` -1, and its
// Tab key reaches them.
function tabIndexOf(element: HTMLElement) {
  const reached =
    !element.hasAttribute('tabindex') &&
    (element.isContentEditable || /^(?:audio|video)$/.test(element.localName));
  return reached ? 0 : element.tabIndex;
}

function isTabbable(element: HTMLElement) {
  return (
    tabIndexOf(element) >= 0 &&
    !element.matches(':disabled') &&
    !element.closest('[inert]') &&
    element.checkVisibility({ checkVisibilityCSS: true })
  );
}

function isNamedRadio(element: HTMLElement): element is HTMLInputElement {
  const input = element as HTMLInputElement;
  return element.localName === 'input' && input.type === 'radio' && !!input.name;
}

function resolve(
  target: FocusTarget | undefined,
  interaction: InteractionType,
): HTMLElement | boolean {
  const value = typeof target === 'function' ? target(interaction) : target;
  if (value === undefined && typeof target === 'function') return false;
  if (value === undefined || value === null || value === true) return true;
  return value;
}

function focus(element: HTMLElement | null | undefined, focusVisible?: boolean) {
  // `focusVisible` makes Firefox show the ring after a key, as Chromium and WebKit do
  // (test/measurements/popup.test.ts). A browser with no such option ignores it.
  element?.focus({ preventScroll: true, ...(focusVisible && { focusVisible }) });
}

/**
 * The focus of a popup: the first focus after an open, the return at the close, and the Tab order
 * with the sentinels of its portal.
 */
export function usePopupFocus(
  root: PopupRoot,
  layer: Layer,
  options: {
    /** The popup takes the focus at its open. */
    takesFocus: () => boolean;
    /** The popup has its first place. */
    placed: () => boolean;
    initialFocus: () => FocusTarget | undefined;
    finalFocus: () => FocusTarget | undefined;
  },
) {
  let before: Element | null = null;
  let took = false;

  watch(
    () => root.open,
    (open) => {
      if (open) {
        took = false;
        return;
      }
      returnFocus();
    },
    { flush: 'sync' },
  );

  watch(
    () => root.open && options.takesFocus() && options.placed() && root.popup,
    (popup) => {
      if (!popup) return;
      // A popup that an item of another popup opens gets the focus after that popup closed and
      // gave the focus back to its trigger.
      const doc = ownerDocument(popup);
      const active = activeElement(doc);
      before = active === doc.body ? null : active;
      took = true;
      const target = resolve(options.initialFocus(), root.interaction);
      if (target === false) return;
      if (target !== true) {
        focus(target);
        return;
      }
      if (root.interaction === 'touch') {
        focus(popup);
        return;
      }
      focus(popup.querySelector<HTMLElement>('[autofocus]') ?? tabbables(popup)[0] ?? popup);
    },
    { flush: 'post' },
  );

  function returnFocus() {
    const popup = root.popup;
    if (!took || !popup) return;
    took = false;
    // The focus stays where it went: after a move out of the popup, and after a press outside.
    // During `focusout`, the active element is `<body>`.
    if (root.reason === 'focus-out') return;
    const doc = ownerDocument(popup);
    const active = activeElement(doc);
    if (active && active !== doc.body && !popup.contains(active)) return;
    const target = resolve(options.finalFocus(), root.closeInteraction);
    if (target === false) return;
    // A focus of an element that left the DOM or is hidden does nothing. An element in the popup
    // that closes is no target, also while the popup leaves.
    const element = [
      target === true ? null : tabStopOf(target, popup),
      root.activeTrigger as HTMLElement | null,
      before as HTMLElement | null,
    ].find((each) => each?.isConnected && !popup.contains(each));
    const keyboard = root.closeInteraction === 'keyboard';
    if (!element?.closest('[inert]')) {
      focus(element, keyboard);
      return;
    }
    // The layer removes its `inert` from the page in the update of the close. A focus of an inert
    // element does nothing, and a focus in the same task after the removal works
    // (test/measurements/dialog.test.ts).
    void nextTick(() => {
      const now = activeElement(doc);
      if (!now || now === doc.body || popup.contains(now)) focus(element, keyboard);
    });
  }

  return {
    /** Tab on the trigger of an open popup goes into the popup. */
    onTriggerKeydown(event: KeyboardEvent) {
      const popup = root.popup;
      if (event.key !== 'Tab' || event.shiftKey || !popup || !took) return;
      event.preventDefault();
      focus(tabbables(popup)[0] ?? popup);
    },
    /** The focus of a sentinel of the portal: before the content, or after it. */
    onSentinelFocus(place: 'before' | 'after', event: FocusEvent) {
      const popup = root.popup;
      if (!popup) return;
      const stops = tabbables(popup);
      const fromPopup = popup.contains(event.relatedTarget as Node | null);
      const first = stops[0] ?? popup;
      const last = stops.at(-1) ?? popup;
      if (!fromPopup) {
        focus(place === 'before' ? first : last);
      } else if (layer.trap) {
        focus(place === 'before' ? last : first);
      } else if (place === 'before') {
        focus((root.activeTrigger ?? before) as HTMLElement | null);
      } else {
        // With no trigger, the element that had the focus before the open has its place. With
        // neither, the next Tab goes on in the order of the document.
        const place = root.activeTrigger ?? before;
        const next = place ? nextTabStop(place, [popup, ...root.portalElements]) : undefined;
        if (layer.focusOut) root.request(false, 'focus-out', event);
        focus(next);
      }
    },
  };
}

/** The target, or its first tab stop outside the popup when the target is no tab stop. */
function tabStopOf(target: HTMLElement, popup: Element) {
  if (target.matches(CANDIDATES) && isTabbable(target)) return target;
  return tabbables(target, popup)[0] ?? target;
}

// The first tab stop after the trigger in the document, outside the elements of the popup.
function nextTabStop(trigger: Element, popupElements: Element[]) {
  return tabbables(ownerDocument(trigger).body).find(
    (stop) =>
      !popupElements.some((element) => element.contains(stop)) &&
      trigger.compareDocumentPosition(stop) & trigger.DOCUMENT_POSITION_FOLLOWING,
  );
}
