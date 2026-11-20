import { nextTick, watch } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { mergeCleanups } from '../common/mergeCleanups';
import { ownerDocument } from '../common/owner';
import { activeElement } from '../common/shadowDom';
import { layerOf, type Layer } from './layer';
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

/** The element that had the focus before the open of each root. */
const befores = new WeakMap<PopupRoot, Element | null>();

const CANDIDATES =
  'a[href],area[href],button,input:not([type="hidden"]),select,textarea,iframe,summary,details,audio[controls],video[controls],[tabindex],[contenteditable]:not([contenteditable="false"])';

/**
 * The tab stops in the container, in the order of the document: each focusable element with a
 * `tabIndex` of 0 or more that is not disabled, not inert and shown, and one radio of a group. The
 * elements in `skipped` are none.
 */
export function tabbables(container: Element, skipped?: Element): HTMLElement[] {
  const collected: HTMLElement[] = [];
  collect(container, collected);
  const found = skipped ? collected.filter((element) => !skipped.contains(element)) : collected;
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
    /**
     * The reasons of a close that move no focus. With this option, the return also runs for a popup
     * that took no focus at its open.
     * @default ['focus-out']
     */
    noReturn?: readonly string[];
    /** The element that takes the focus when the focused element of the popup leaves or hides. */
    lostFocus?: () => HTMLElement | null;
    /** The first sentinel also asks for a close when it gets the focus from the popup. */
    closeBefore?: boolean;
    /** The root that the last sentinel closes, and after whose trigger the focus goes. */
    exit?: () => PopupRoot;
    /**
     * Tab on the trigger goes to the first tab stop of the popup also when the popup took no
     * focus. With no tab stop, the Tab is native.
     */
    tabIntoPopup?: () => boolean;
  },
) {
  let before: Element | null = null;
  let took = false;

  // A trigger that takes no focus, such as the swipe area of a drawer, gives its place to the
  // element that had the focus before the open.
  function focusableTrigger() {
    const trigger = root.activeTrigger;
    return trigger?.matches(CANDIDATES) ? (trigger as HTMLElement) : null;
  }

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
      befores.set(root, before);
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

  // Only Chromium sends `focusout` when the focused element leaves the DOM
  // (test/measurements/popup.test.ts), so a `MutationObserver` looks for the removal, and for an
  // attribute that hides the element.
  watch(
    () => (options.lostFocus && root.open ? root.popup : null),
    (popup, _, onCleanup) => {
      if (!popup) return;
      let focused: Element | null = null;
      const restore = () => {
        if (!focused || (focused.isConnected && focused.checkVisibility())) return;
        const doc = ownerDocument(popup);
        const active = activeElement(doc);
        if (active && active !== doc.body) return;
        focused = null;
        focus(options.lostFocus?.());
      };
      const onFocusin = (event: FocusEvent) => (focused = event.target as Element);
      const observer = new MutationObserver(restore);
      observer.observe(popup, { childList: true, subtree: true, attributes: true });
      onCleanup(
        mergeCleanups(() => observer.disconnect(), addEventListener(popup, 'focusin', onFocusin)),
      );
    },
    { flush: 'post' },
  );

  function returnFocus() {
    const popup = root.popup;
    if ((!took && !options.noReturn) || !popup) return;
    took = false;
    // The focus stays where it went: after a move out of the popup, and after a press outside.
    // During `focusout`, the active element is `<body>`.
    if ((options.noReturn ?? ['focus-out']).includes(root.reason ?? '')) return;
    const doc = ownerDocument(popup);
    const active = activeElement(doc);
    if (active && active !== doc.body && !popup.contains(active)) return;
    const target = resolve(options.finalFocus(), root.closeInteraction);
    if (target === false) return;
    // A focus of an element that left the DOM or is hidden does nothing. An element in the popup
    // that closes is no target, also while the popup leaves.
    const element = [
      target === true ? null : tabStopOf(target, popup),
      focusableTrigger(),
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
      if (event.key !== 'Tab' || event.shiftKey || !popup) return;
      const first = tabbables(popup)[0];
      if (!took && !(options.tabIntoPopup?.() && first)) return;
      event.preventDefault();
      focus(first ?? popup);
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
        if (options.closeBefore) root.request(false, 'focus-out', event);
        focus(focusableTrigger() ?? (before as HTMLElement | null));
      } else {
        // The root that the last sentinel closes, such as the menu of a submenu. With no trigger,
        // a menu gives the focus back to the element that had it before the open, as a context
        // menu does, and another popup gives it to the next tab stop after that element. With
        // neither, the next Tab goes on in the order of the document.
        const exit = options.exit?.() ?? root;
        const trigger = exit.activeTrigger;
        const earlier = exit === root ? before : (befores.get(exit) ?? null);
        const elements = [exit.popup, ...exit.portalElements, popup, ...root.portalElements];
        let next: Element | null | undefined;
        if (trigger) next = nextTabStop(trigger, elements);
        else if (options.exit) next = earlier;
        else if (earlier) next = nextTabStop(earlier, elements);
        if ((layerOf(exit) ?? layer).focusOut) exit.request(false, 'focus-out', event);
        focus(next as HTMLElement | null | undefined);
      }
    },
  };
}

/** The target, or its first tab stop outside the popup when the target is no tab stop. */
function tabStopOf(target: HTMLElement, popup: Element) {
  if (target.matches(CANDIDATES) && isTabbable(target)) return target;
  return tabbables(target, popup)[0] ?? target;
}

/** The first tab stop after the trigger in the document, outside the elements of the popup. */
export function nextTabStop(trigger: Element, popupElements: (Element | null)[]) {
  return tabbables(ownerDocument(trigger).body).find(
    (stop) =>
      !popupElements.some((element) => element?.contains(stop)) &&
      trigger.compareDocumentPosition(stop) & trigger.DOCUMENT_POSITION_FOLLOWING,
  );
}
