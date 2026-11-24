import { nextTick, shallowRef, watch } from 'vue';
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

/**
 * Focuses the element with the focus ring that the input gives: `focusVisible` is `true` after a
 * key and `false` after a pointer. A focus by script takes the ring of the last key, also after a
 * press whose `mousedown` the code took over (`trigger.ts`), so a pointer needs `false`
 * (test/measurements/select.test.ts). Firefox shows the ring after a key only with `true`
 * (test/measurements/popup.test.ts). With no known input, the browser decides. A field that takes
 * text matches `:focus-visible` at each focus, and `false` would hide its ring, so a pointer gives
 * it nothing. A checkbox, a radio or a button input takes no text, so a pointer gives it `false`
 * (test/measurements/select.test.ts). A browser without the option ignores it.
 */
export function focusAs(element: HTMLElement | null | undefined, input: InteractionType = '') {
  if (!element) return;
  const ring = input === 'keyboard' ? true : input === '' || takesText(element) ? undefined : false;
  element.focus({ preventScroll: true, ...(ring !== undefined && { focusVisible: ring }) });
}

const INPUT_TYPES_WITHOUT_TEXT = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

function takesText(element: HTMLElement) {
  if (element.isContentEditable || element.localName === 'textarea') return true;
  const { localName, type } = element as HTMLInputElement;
  return localName === 'input' && !INPUT_TYPES_WITHOUT_TEXT.has(type);
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
    /** The element that the first sentinel gives the focus to, in place of the trigger. */
    beforeTarget?: () => HTMLElement | null | undefined;
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
  // A close and an open in one task keep the same popup element, so the popup takes the focus at
  // each open.
  const opens = shallowRef(0);

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
        opens.value += 1;
        return;
      }
      const given = returnFocus();
      if (given) void nextTick(() => settleFocus(given));
    },
    { flush: 'sync' },
  );

  function takeFocus(popup: HTMLElement) {
    // A popup that an item of another popup opens gets the focus after that popup closed and
    // gave the focus back to its trigger.
    const doc = ownerDocument(popup);
    const active = activeElement(doc);
    before = active === doc.body ? null : active;
    befores.set(root, before);
    took = true;
    const target = resolve(options.initialFocus(), root.interaction);
    if (target !== true) {
      if (target) focusAs(target, root.interaction);
      // WebKit keeps the text caret in a focused element that becomes inert
      // (test/measurements/dialog.test.ts), so that element loses the focus.
      const focused = activeElement(doc);
      if (focused?.closest('[inert]')) (focused as HTMLElement).blur();
      return;
    }
    if (root.interaction === 'touch') {
      focusAs(popup, root.interaction);
      return;
    }
    focusAs(
      popup.querySelector<HTMLElement>('[autofocus]') ?? tabbables(popup)[0] ?? popup,
      root.interaction,
    );
  }

  watch(
    [() => opens.value, () => root.open && options.takesFocus() && options.placed() && root.popup],
    ([, popup]) => {
      if (!popup) return;
      // A child of the popup can change its attributes in a later update of this flush, such as
      // at its mount (test/measurements/dialog.test.ts), and `v-show` shows a popup in a hook of
      // this flush. So the focus moves after the flush.
      void nextTick(() => {
        if (root.open && root.popup === popup) takeFocus(popup);
      });
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
      const doc = ownerDocument(popup);
      // A child of the popup can take the focus at its mount, before this watcher.
      const current = activeElement(doc);
      let focused: Element | null = current && popup.contains(current) ? current : null;
      const restore = () => {
        if (!focused || (focused.isConnected && focused.checkVisibility())) return;
        const active = activeElement(doc);
        if (active && active !== doc.body) return;
        focused = null;
        focusAs(options.lostFocus?.());
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
    if (!popup) return null;
    const doc = ownerDocument(popup);
    const active = activeElement(doc);
    // A popup that took no focus at its open, as after a hover, gives back a focus that went into
    // it later.
    if (!took && !options.noReturn && !popup.contains(active)) return null;
    took = false;
    // The focus stays where it went: after a move out of the popup, and after a press outside.
    // During `focusout`, the active element is `<body>`.
    if ((options.noReturn ?? ['focus-out']).includes(root.reason ?? '')) return null;
    // In Chromium and Firefox, the `mousedown` of a press on the trigger gives it the focus before a
    // close at `click` (test/measurements/menu.test.ts). That focus is no move out of the popup, so
    // `finalFocus` applies in each browser.
    if (active && active !== doc.body && active !== root.activeTrigger && !popup.contains(active)) {
      return null;
    }
    // The return to the trigger, or to the element that had the focus before the open, happens at
    // once, so that a popup that another popup opens in the same task takes that element as the one
    // that had the focus before. A target of the developer can be an element that the update of the
    // close renders, so it waits for that update.
    const target = options.finalFocus();
    if (target === undefined || target === true || target === null) moveFocus(popup);
    return { popup, active };
  }

  // Gives the element that the return focuses, or `null`. A focus of an element that left the DOM
  // or is hidden does nothing. An element in the popup that closes is no target, also while the popup
  // leaves. After an open by code, the element that had the focus before comes before the trigger
  // (BUG-6037).
  function moveFocus(popup: HTMLElement) {
    const target = resolve(options.finalFocus(), root.closeInteraction);
    const fallbacks = [focusableTrigger(), before as HTMLElement | null];
    if (root.interaction === '') fallbacks.reverse();
    const element =
      target === false
        ? undefined
        : [target === true ? null : tabStopOf(target, popup), ...fallbacks].find(
            (each) => each?.isConnected && !popup.contains(each),
          );
    if (!element) return null;
    focusAs(element, root.closeInteraction);
    return element;
  }

  // After the update of the close, each element that the update renders is in the document, and the
  // page of a modal popup has no `inert`. The return resolves its target at that time.
  function settleFocus({ popup, active }: { popup: HTMLElement; active: Element | null }) {
    // An open in the same task takes the focus itself.
    if (root.open) return;
    const doc = ownerDocument(popup);
    const now = activeElement(doc);
    // The focus is on another element, such as one that a listener of the developer focused, or the
    // element that the return focused at the close.
    if (now && now !== doc.body && now !== active && !popup.contains(now)) return;
    if (moveFocus(popup)) return;
    // The popup that leaves is inert. The browser moves the focus out of an inert element only when
    // it updates the rendering, and WebKit keeps the text caret there
    // (test/measurements/dialog.test.ts). So the focused element of the popup loses the focus.
    const focused = activeElement(doc);
    if (focused && popup.contains(focused)) (focused as HTMLElement).blur();
  }

  return {
    /** Tab on the trigger of an open popup goes into the popup. */
    onTriggerKeydown(event: KeyboardEvent) {
      const popup = root.popup;
      if (event.key !== 'Tab' || event.shiftKey || !popup) return;
      const first = tabbables(popup)[0];
      if (!took && !(options.tabIntoPopup?.() && first)) return;
      event.preventDefault();
      focusAs(first ?? popup);
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
        focusAs(place === 'before' ? first : last);
      } else if (layer.trap) {
        focusAs(place === 'before' ? last : first);
      } else if (place === 'before') {
        if (options.closeBefore) root.request(false, 'focus-out', event);
        focusAs(options.beforeTarget?.() ?? focusableTrigger() ?? (before as HTMLElement | null));
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
        focusAs(next as HTMLElement | null | undefined);
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
