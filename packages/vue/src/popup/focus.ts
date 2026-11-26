import { nextTick, onScopeDispose, shallowRef, watch, watchPostEffect } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { mergeCleanups } from '../common/mergeCleanups';
import { ownerDocument } from '../common/owner';
import { activeElement } from '../common/shadowDom';
import { CANDIDATES, isTabbable, tabbables } from '../common/tabbable';
import { isInPopup, layerOf, type Layer } from './layer';
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

interface ReturnChain {
  readonly root: PopupRoot;
  readonly targets: () => (HTMLElement | null)[];
  readonly settleFromChild: (childPopup: HTMLElement) => HTMLElement | null;
  closing: boolean;
  returnsFocus: boolean;
  settled: boolean;
}

/**
 * Each open popup, until its close pass ends. A popup that opens from inside it keeps its targets,
 * because the update of the open can make them `inert`.
 */
const returnChains = new Map<PopupRoot, ReturnChain>();

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
 * A focus by script takes the ring of the last key, also after a press whose `mousedown` the code
 * took over (`trigger.ts`), so a pointer needs `focusVisible: false`
 * (test/measurements/select.test.ts). Firefox shows the ring after a key only with
 * `focusVisible: true` (test/measurements/popup.test.ts). A field that takes text matches
 * `:focus-visible` at each focus, and `false` would hide its ring, so a pointer gives it nothing
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
    /**
     * An input outside the popup keeps the focus while the popup is open. The return then gives
     * the focus only to an element of `finalFocus`, and not at a close by `'focus-out'` or
     * `'outside-press'`.
     */
    inputKeepsFocus?: () => boolean;
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
  // The element that had the focus at the open, for a child of the popup that takes the focus at
  // its mount, before `takeFocus`.
  let openedFrom: Element | null = null;
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

  // After an open by code, the element that had the focus before comes before the trigger
  // (BUG-6037).
  function ownTargets() {
    const own = [focusableTrigger(), before as HTMLElement | null];
    if (root.interaction === '') own.reverse();
    return own;
  }
  function targets() {
    return [...ownTargets(), ...inherited];
  }
  let inherited: (HTMLElement | null)[] = [];
  let parent: ReturnChain | null = null;
  let chain: ReturnChain | null = null;

  function findOrigin() {
    const doc = ownerDocument(root.activeTrigger ?? root.popup);
    const active = activeElement(doc);
    let from: ReturnChain | null = null;
    for (const other of returnChains.values()) {
      if (other.root === root) continue;
      const popup = other.root.popup;
      if (popup?.contains(active) && (!from || from.root.popup?.contains(popup))) {
        from = other;
      }
    }
    if (from) return from;
    // A popup that closed in this task can leave the DOM before a `v-if` popup mounts, which moves
    // the focus to `<body>`.
    if (!active || active === doc.body) {
      for (const other of returnChains.values()) {
        if (other.root !== root && other.closing && other.returnsFocus) from = other;
      }
    }
    return from;
  }

  function release(closing: ReturnChain) {
    closing.closing = false;
    closing.returnsFocus = false;
    if (chain !== closing) return;
    returnChains.delete(root);
    chain = null;
    inherited = [];
    parent = null;
  }

  function enter() {
    pending = null;
    const active = activeElement(ownerDocument(root.activeTrigger ?? root.popup));
    openedFrom = active && root.popup?.contains(active) ? before : active;
    if (chain) {
      chain.closing = false;
      chain.returnsFocus = false;
    }
    parent = findOrigin();
    inherited = parent ? parent.targets() : [];
    chain = {
      root,
      targets,
      settleFromChild,
      closing: false,
      returnsFocus: false,
      settled: false,
    };
    returnChains.set(root, chain);
  }

  function scheduleClose(given: ReturnType<typeof returnFocus>, closing: ReturnChain | null) {
    if (!given && !closing) return;
    void nextTick(() => {
      if (given) settleFocus(given);
      if (closing) void Promise.resolve().then(() => release(closing));
    });
  }

  let pending: ReturnType<typeof returnFocus> = null;
  const closes = shallowRef(0);
  // A post-flush effect runs only on the client, so a server render adds no entry to the map. It
  // runs before `onMounted` of the children, for a root that mounts open.
  const stopInit = watchPostEffect(() => {
    stopInit();
    if (root.open && !chain) enter();
  });
  watch(
    () => root.open,
    (open) => {
      if (open) {
        took = false;
        opens.value += 1;
        // The open reads the targets before the update that writes `inert`.
        enter();
        return;
      }
      pending = returnFocus();
      if (chain) {
        chain.closing = true;
        chain.settled = false;
        chain.returnsFocus = !!pending && !pending.onlyFinalFocus;
      }
      closes.value += 1;
    },
    { flush: 'sync' },
  );
  // The return waits for the close update, so that new elements are in the document and a modal
  // popup removes `inert` (test/measurements/dialog.test.ts). A `nextTick` in the `sync` watcher
  // runs before the update when the queue is empty, and cannot cancel an earlier close in one task.
  watch(
    closes,
    () => {
      if (root.open) return;
      const given = pending;
      pending = null;
      openedFrom = null;
      scheduleClose(given, chain);
    },
    { flush: 'post' },
  );
  // A root that unmounts during its close update stops the post watcher, so the return schedules
  // here.
  onScopeDispose(() => {
    const given = pending;
    pending = null;
    openedFrom = null;
    const closing = chain;
    if (given || closing?.closing) scheduleClose(given, closing);
    else if (closing) release(closing);
  });

  function takeFocus(popup: HTMLElement) {
    const doc = ownerDocument(popup);
    const active = activeElement(doc);
    const inside = !!active && (popup.contains(active) || isInPopup(layer, active));
    const origin = inside ? openedFrom : active;
    openedFrom = null;
    before = origin === doc.body ? null : origin;
    befores.set(root, before);
    took = true;
    const target = resolve(options.initialFocus(), root.interaction);
    // A child that mounted with the popup can already hold the focus; keep it (Base UI).
    if (inside) return;
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
    if (options.inputKeepsFocus?.() && !popup.contains(active)) {
      if (['focus-out', 'outside-press'].includes(root.reason ?? '')) return null;
      return { popup, active, onlyFinalFocus: true };
    }
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
    return { popup, active, onlyFinalFocus: false };
  }

  function focusFirst(doc: Document, popup: HTMLElement, candidates: (HTMLElement | null)[]) {
    for (const each of candidates) {
      if (!each || popup.contains(each)) continue;
      focusAs(each, root.closeInteraction);
      if (activeElement(doc) === each) return each;
    }
    return null;
  }

  // A focus of an element that left the DOM, is hidden, `inert` or disabled does nothing, so the
  // next target gets the focus. An element in the popup that closes is no target, also while the
  // popup leaves.
  function moveFocus(popup: HTMLElement): HTMLElement | null {
    const target = resolve(options.finalFocus(), root.closeInteraction);
    if (target === false) return null;
    const doc = ownerDocument(popup);
    const moved = focusFirst(doc, popup, [
      target === true ? null : tabStopOf(target, popup),
      ...ownTargets(),
    ]);
    if (moved) return moved;
    // A parent that closes in the same task, such as a menu and its submenu, applies its own close
    // rules and `finalFocus`.
    if (parent?.closing) return parent.settleFromChild(popup);
    return focusFirst(doc, popup, inherited);
  }

  function settleFromChild(childPopup: HTMLElement): HTMLElement | null {
    if (root.open || chain?.settled) return null;
    if (chain) chain.settled = true;
    if ((options.noReturn ?? ['focus-out']).includes(root.reason ?? '')) return null;
    return moveFocus(root.popup ?? childPopup);
  }

  function settleFocus({ popup, active, onlyFinalFocus }: NonNullable<typeof pending>) {
    // An open in the same task takes the focus itself.
    if (root.open) return;
    const doc = ownerDocument(popup);
    const now = activeElement(doc);
    // A listener of the developer focused another element.
    if (now && now !== doc.body && now !== active && !popup.contains(now)) return;
    if (chain) chain.settled = true;
    if (onlyFinalFocus) {
      const target = resolve(options.finalFocus(), root.closeInteraction);
      if (typeof target === 'object') focusAs(target, root.closeInteraction);
      return;
    }
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
