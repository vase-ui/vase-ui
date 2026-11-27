import { computed, onMounted, onUnmounted, shallowReactive, watch } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { mergeCleanups } from '../common/mergeCleanups';
import { ownerDocument, ownerWindow } from '../common/owner';
import { isShadowRoot } from '@floating-ui/utils/dom';
import { isElement } from '../common/element';
import { activeElement, contains } from '../common/shadowDom';
import { followRootNode } from '../common/observeRootNode';
import type { PopupRoot } from './root';

/** What an open root gives to the stack. The properties are reactive. */
export interface Layer {
  readonly root: PopupRoot;
  /** Escape closes the popup. */
  readonly escape: boolean;
  /**
   * A press outside closes the popup. With `'except-live'`, a press on a live region or an alert,
   * such as a toast, closes nothing. A layer that hides the rest of the page leaves such an element
   * in use (`LIVE`), so a person can operate it above the popup.
   */
  readonly outsidePress: boolean | 'except-live';
  /** A move of the focus to an element outside closes the popup. */
  readonly focusOut: boolean;
  /**
   * An outside press of a mouse or a pen closes the popup at `pointerdown`: of the main button, or
   * of each button with `'each-button'`, as a native menu does.
   */
  readonly pressStart: boolean | 'each-button';
  /** The portal renders a fixed element that takes each pointer from the page. */
  readonly block: boolean;
  /**
   * The attribute that the layer writes on the rest of the page. Only a layer of `useModalLayer`
   * writes it.
   */
  readonly hide: 'inert' | 'aria-hidden' | false;
  /** Tab keeps the focus in the popup. */
  readonly trap: boolean;
  /**
   * The page does not scroll. `useModalLayer` applies this rule, or the root gives it to
   * `useScrollLock`.
   */
  readonly lockScroll: boolean;
  /**
   * The active trigger stays in use: the layer does not hide it, and the fixed element has a hole
   * at it.
   */
  readonly triggerInUse: boolean;
  /**
   * The element that the block leaves free, in the place of the active trigger of `triggerInUse`.
   * `null` leaves none.
   */
  readonly hole?: Element | null | undefined;
  /**
   * More elements inside the layer, such as the triggers of a menubar, for the outside press and
   * the focus out. Escape on them closes the popup as on the popup element.
   */
  readonly inside?: readonly (Element | null)[] | undefined;
}

export type LayerRules = Omit<Layer, 'root'>;

/**
 * The live regions and the alerts. A layer that hides the rest of the page leaves them in use at
 * each place of the document, so that the page announces its messages, such as toasts, under a
 * modal popup.
 */
export const LIVE = '[aria-live]:not([aria-live="off"]), [role="alert"]';

interface Entry {
  readonly layer: Layer;
  /** The children of `<body>` at the open. */
  readonly bodyChildren: WeakSet<Element>;
  /** The task of the open. */
  readonly task: number;
  /** The place of the `setup` of the root among the roots. */
  readonly order: number;
  /** For the press that started after the open: it started outside. */
  pressOutside?: boolean;
  /** For the press that started after the open: it ended outside. */
  releaseOutside?: boolean;
}

/** The open layers, in the order of their open. */
const stack = shallowReactive<Entry[]>([]);

let roots = 0;
let task = 0;
let taskStarted = false;

function currentTask() {
  if (!taskStarted) {
    taskStarted = true;
    task += 1;
    queueMicrotask(() => (taskStarted = false));
  }
  return task;
}

/**
 * Adds an open layer. Roots that open in one task enter in the order of their `setup`, as their
 * portals enter `<body>`. `onMounted` of a child runs before that of its parent
 * (test/measurements/dialog.test.ts).
 */
function push(entry: Entry) {
  const later = stack.findLastIndex((each) => each.task !== entry.task || each.order < entry.order);
  stack.splice(later + 1, 0, entry);
}

/** The layers that the root of each popup has, by root, for the parts of a family. */
const layersOfRoots = new WeakMap<PopupRoot, Layer>();

export function layerOf(root: PopupRoot) {
  return layersOfRoots.get(root);
}

/** The open layers, from the lowest one. */
export function openLayers(): Layer[] {
  return stack.map((entry) => entry.layer);
}

/** The open layers above the layer, from the lowest one. */
export function layersAbove(layer: Layer): Layer[] {
  const index = stack.findIndex((entry) => entry.layer === layer);
  return index === -1 ? [] : stack.slice(index + 1).map((entry) => entry.layer);
}

/** The element is in the popup of the layer, or in a layer above it. */
export function isInPopup(layer: Layer, element: Element) {
  const index = stack.findIndex((each) => each.layer === layer);
  const inside = [layer.root.popup, ...stack.slice(index + 1).flatMap(entryElements)];
  return index !== -1 && inside.some((each) => !!each?.contains(element));
}

/**
 * Puts the root in the stack from its open to its close, and serves its rules. Call it in the
 * `setup` of a root. A root whose layer can hide the rest of the page calls `useModalLayer`
 * (`modal.ts`) in its place. `onOpen` runs at each open, after the layer enters the stack.
 */
export function useLayer(root: PopupRoot, rules: () => LayerRules, onOpen?: () => void) {
  const current = computed(rules);
  const layer: Layer = {
    root,
    get escape() {
      return current.value.escape;
    },
    get outsidePress() {
      return current.value.outsidePress;
    },
    get focusOut() {
      return current.value.focusOut;
    },
    get pressStart() {
      return current.value.pressStart;
    },
    get block() {
      return current.value.block;
    },
    get hide() {
      return current.value.hide;
    },
    get trap() {
      return current.value.trap;
    },
    get lockScroll() {
      return current.value.lockScroll;
    },
    get triggerInUse() {
      return current.value.triggerInUse;
    },
    get hole() {
      return current.value.hole;
    },
    get inside() {
      return current.value.inside;
    },
  };
  layersOfRoots.set(root, layer);
  const order = (roots += 1);

  const remove = () => {
    const index = stack.findIndex((entry) => entry.layer === layer);
    if (index !== -1) stack.splice(index, 1);
  };
  onMounted(() => {
    watch(
      () => root.open,
      (open, _, onCleanup) => {
        if (!open) return;
        const doc = ownerDocument(root.activeTrigger);
        push({ layer, bodyChildren: new WeakSet(doc.body.children), task: currentTask(), order });
        onOpen?.();
        onCleanup(mergeCleanups(remove, listen(doc)));
      },
      { immediate: true, flush: 'sync' },
    );
    // A popup in a shadow root gets the focus events of that root there. The document gets no
    // focus event for a move of the focus in one shadow root. Each shadow root around the popup
    // listens, so that a closed one decides an event in it.
    watch(
      () => (root.open ? root.popup : null),
      (popup, _, onCleanup) => {
        if (!popup) return;
        onCleanup(followRootNode(popup, () => mergeCleanups(...shadowRootsOf(popup).map(listen))));
      },
      { immediate: true, flush: 'post' },
    );
    // The Escape listener of the popup element runs before the listeners of the ancestors of an
    // in-place popup.
    watch(
      () => (root.open ? [root.popup, ...(layer.inside ?? [])] : []),
      (elements, _, onCleanup) => {
        const listening = elements.filter((element): element is Element => !!element);
        onCleanup(
          mergeCleanups(
            ...listening.map((element) => addEventListener(element, 'keydown', onKeydown)),
          ),
        );
      },
      { immediate: true, flush: 'post' },
    );
  });
  onUnmounted(remove);

  return layer;
}

// Each document and each shadow root of a popup gets one set of listeners.
const listeners = new Map<Node, { count: number; stop(): void }>();

/** The shadow root of the node, and each shadow root around its host, from the inner one. */
function shadowRootsOf(node: Node) {
  const roots: ShadowRoot[] = [];
  for (let each = node.getRootNode(); isShadowRoot(each); each = each.host.getRootNode()) {
    roots.push(each);
  }
  return roots;
}

/**
 * A listener outside a closed shadow root sees the host of the root in place of the elements in it.
 * When a popup is in that root or in a shadow root in it, the listener of the root gets the event
 * later in the capture phase, with the whole path. So that listener decides a press and a click,
 * which can close a popup at once. At a release, it writes the state of the press after the
 * document.
 */
function decidedInRoot<E extends Event>(handler: (event: E) => void) {
  return (event: E) => {
    const path = event.composedPath();
    for (const node of listeners.keys()) {
      if (isShadowRoot(node) && !path.includes(node) && path.includes(node.host)) return;
    }
    handler(event);
  };
}

function listen(node: Document | ShadowRoot) {
  let entry = listeners.get(node);
  if (!entry) {
    entry = {
      count: 0,
      stop: mergeCleanups(
        addEventListener(node, 'pointerdown', decidedInRoot(onPointerdown) as EventListener, true),
        addEventListener(node, 'pointermove', onPointermove as EventListener, true),
        addEventListener(node, 'pointerup', onPointerup as EventListener, true),
        addEventListener(node, 'pointercancel', onPointerup as EventListener, true),
        addEventListener(node, 'contextmenu', onContextmenu, true),
        addEventListener(node, 'click', decidedInRoot(onClick) as EventListener, true),
        addEventListener(node, 'focusout', onFocusout as EventListener),
        addEventListener(node, 'keydown', onKeydown as EventListener),
        addEventListener(node, 'compositionend', onCompositionend, true),
      ),
    };
    listeners.set(node, entry);
  }
  entry.count += 1;
  const owned = entry;
  return () => {
    owned.count -= 1;
    if (owned.count > 0) return;
    owned.stop();
    listeners.delete(node);
  };
}

/** The entries from the top one to the bottom one. */
function fromTop() {
  return [...stack].reverse();
}

/** Each element of the layer: its popup, its backdrop, its sentinels and its fixed element. */
export function layerElements({ root }: Layer): Element[] {
  return [root.popup, ...root.parts, ...root.portalElements].filter(
    (element): element is Element => !!element?.isConnected,
  );
}

const entryElements = (entry: Entry) => layerElements(entry.layer);

/**
 * The elements inside the layer: its popup, its sentinels and its triggers, and each element of the
 * layers above it. Its backdrop, its viewport and its fixed element are outside.
 */
function insideElements(entry: Entry) {
  const { root } = entry.layer;
  const index = stack.indexOf(entry);
  const own = [
    root.popup,
    ...root.portalElements.filter(isSentinel),
    ...root.triggers.map((trigger) => trigger.element),
    ...(entry.layer.inside ?? []),
  ].filter((element): element is Element => !!element?.isConnected);
  return [...own, ...stack.slice(index + 1).flatMap(entryElements)];
}

function isSentinel(element: Element) {
  return element.getAttribute('tabindex') === '0';
}

/** The event path has an element inside the layer. */
function isPathInside(entry: Entry, path: readonly EventTarget[]) {
  const inside = insideElements(entry);
  return path.some((node) => inside.includes(node as Element));
}

/** The event path has an element of one of the layers, such as its backdrop. */
function isPathOnLayer(entries: readonly Entry[], path: readonly EventTarget[]) {
  return entries.some((entry) => entryElements(entry).some((element) => path.includes(element)));
}

// A press on an element that a script added to `<body>` after the open, and that no layer owns,
// such as the element of a password tool, is no press outside.
function isAddedElement(entry: Entry, path: readonly EventTarget[]) {
  const body = ownerDocument(path[0] as Element).body;
  const child = path.find((node) => (node as Node).parentNode === body) as Element | undefined;
  if (!child || entry.bodyChildren.has(child)) return false;
  return !stack.some((each) => entryElements(each).some((element) => child.contains(element)));
}

// A press on a scrollbar sends `pointerdown` with an offset outside the client box of the element
// that scrolls, and no `click` (test/measurements/popup.test.ts). Only a layer that closes at
// `pointerdown` reads it. WebKit gives an element with its scrollbar on the left no `clientLeft`.
function isScrollbarPress(event: PointerEvent | MouseEvent) {
  const target = event.target;
  if (!(target instanceof ownerWindow(target).HTMLElement)) return false;
  const html = target.ownerDocument.documentElement;
  const root = target === html || target === target.ownerDocument.body;
  const style = ownerWindow(target).getComputedStyle(target);
  const scrollsY =
    (root || /auto|scroll/.test(style.overflowY)) && target.scrollHeight > target.clientHeight;
  const scrollsX =
    (root || /auto|scroll/.test(style.overflowX)) && target.scrollWidth > target.clientWidth;
  const rtl = style.direction === 'rtl';
  const offsetX = root ? event.clientX : event.offsetX;
  const offsetY = root ? event.clientY : event.offsetY;
  const width = root ? html.clientWidth : target.clientWidth;
  const height = root ? html.clientHeight : target.clientHeight;
  const onY = scrollsY && (rtl ? offsetX < target.offsetWidth - width : offsetX > width);
  return onY || (scrollsX && offsetY > height);
}

function closeOutside(event: Event, entries: Entry[]) {
  for (const entry of entries) {
    if (stack.includes(entry)) entry.layer.root.request(false, 'outside-press', event);
  }
}

/** The entries that a press is outside of, from the top one. */
function outsideEntries(event: Event) {
  const path = event.composedPath();
  const onLive = path.some((node) => isElement(node) && node.matches(LIVE));
  return fromTop().filter((entry) => {
    const { outsidePress } = entry.layer;
    return (
      outsidePress &&
      !(onLive && outsidePress === 'except-live') &&
      !isPathInside(entry, path) &&
      !isAddedElement(entry, path)
    );
  });
}

/** A touch that started outside, while it can be a tap. */
interface Tap {
  x: number;
  y: number;
  time: number;
  entries: Entry[];
  /** The touch started on an element of a layer that it closes, such as a backdrop. */
  onLayer: boolean;
  target: Element;
}

let tap: Tap | null = null;
/** From a `pointerdown` of the main button to its `pointerup`. */
let pressing = false;

// The largest move of a tap in each measured browser. Chromium on Android sends `click` for a touch
// that moves 8 px and not for one that moves 8.1 px. Chromium on a desktop sends it up to 15 px, and
// Safari on iOS up to 44 px (test/measurements/popup.test.ts).
const TAP_SLOP = 8;

// The layer decides at `pointerdown` which layers the press can close.
function onPointerdown(event: PointerEvent) {
  if (event.pointerType === 'touch') {
    for (const entry of stack) {
      entry.pressOutside = undefined;
      entry.releaseOutside = undefined;
    }
    // A second touch makes a gesture of two fingers, such as a pinch. It is no tap, and it closes
    // nothing.
    if (!event.isPrimary) {
      tap = null;
      return;
    }
    const path = event.composedPath();
    const entries = outsideEntries(event);
    // A touch that rests more than 1 s selects text or opens the menu of the system.
    tap = {
      x: event.clientX,
      y: event.clientY,
      time: event.timeStamp,
      entries,
      onLayer: isPathOnLayer(entries, path),
      target: path[0] as Element,
    };
    return;
  }
  const outside = isScrollbarPress(event) ? [] : outsideEntries(event);
  if (event.button === 0) {
    pressing = true;
    for (const entry of stack) {
      entry.pressOutside = outside.includes(entry);
      entry.releaseOutside = undefined;
    }
  }
  const closing = outside.filter(
    ({ layer }) => layer.pressStart === 'each-button' || (layer.pressStart && event.button === 0),
  );
  // The close removes the element of the press, such as a fixed element or a viewport, before the
  // `mousedown`. The press then gives the focus to `<body>`, also in WebKit, which sends no
  // `mousedown`. A canceled `pointerdown` keeps the focus where the close put it
  // (test/measurements/popup.test.ts, "a mouse press on an element that leaves at `pointerdown`").
  if (isPathOnLayer(closing, event.composedPath())) event.preventDefault();
  closeOutside(event, closing);
}

// A touch that moves more than `TAP_SLOP` drags or scrolls, and is no tap. A drag on an element
// with `touch-action: none` ends with `pointerup` (test/measurements/popup.test.ts).
function onPointermove(event: PointerEvent) {
  if (!tap || event.pointerType !== 'touch') return;
  if (Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > TAP_SLOP) tap = null;
}

// Chromium on Android opens the menu of the system at a long press of about 650 ms, with
// `contextmenu`, and sends no `click`. That touch then closes nothing at its end.
function onContextmenu() {
  tap = null;
}

function onPointerup(event: PointerEvent) {
  if (event.pointerType === 'touch') {
    if (!tap) return;
    const { entries, onLayer, target, time } = tap;
    tap = null;
    // A touch that scrolls the page ends with `pointercancel` (test/measurements/popup.test.ts),
    // and it closes nothing (VUE-172).
    if (event.type !== 'pointerup' || event.timeStamp - time >= 1000) return;
    closeOutside(event, entries);
    // The close takes the backdrop or the fixed element away from under the tap. The browser then
    // gives the `click` of the tap to the element of the page under it, unless the `touchend` of
    // the tap is canceled (test/measurements/popup.test.ts). Pointer Events give no way to stop
    // that `click`.
    if (onLayer) {
      addEventListener(target, 'touchend', (end) => end.preventDefault(), { once: true });
    }
    return;
  }
  pressing = false;
  // A press on a scrollbar sends no `click` (test/measurements/popup.test.ts).
  const outside = outsideEntries(event);
  for (const entry of stack) {
    if (entry.pressOutside !== undefined) entry.releaseOutside = outside.includes(entry);
  }
}

// `click` has the common ancestor of the press and the release, so it cannot tell a drag across
// the edge of the popup (test/measurements/popup.test.ts). The layer reads the press and the
// release.
function onClick(event: MouseEvent) {
  // A click of a key, of a script or of an assistive tool has no press. A tap closes at its
  // `pointerup`.
  const withPress = event.detail !== 0;
  const outside = outsideEntries(event);
  const entries = fromTop().filter((entry) => {
    const pressed = entry.pressOutside;
    entry.pressOutside = undefined;
    const released = entry.releaseOutside;
    entry.releaseOutside = undefined;
    if (!withPress) return outside.includes(entry);
    return pressed === true && released === true;
  });
  closeOutside(event, entries);
}

function onFocusout(event: FocusEvent) {
  // A press moves the focus at `pointerdown`. The rule of the press decides.
  if (handledFocusouts.has(event) || pressing) return;
  handledFocusouts.add(event);
  const path = event.composedPath();
  const related = event.relatedTarget as Element | null;
  for (const entry of fromTop()) {
    if (!entry.layer.focusOut || !isPathInside(entry, path)) continue;
    if (related) {
      const inside = insideElements(entry);
      if (inside.some((element) => element.contains(related))) continue;
      // A move of the focus into a shadow root has the host of the root, or of a shadow root
      // around it, as its related target. The element in the root has the focus one task later.
      const roots = inside.flatMap((element) => {
        const around = shadowRootsOf(element);
        return around.some((each) => each.host === related) ? around.slice(0, 1) : [];
      });
      if (roots.length === 0) {
        entry.layer.root.request(false, 'focus-out', event);
        continue;
      }
      setTimeout(() => {
        const active = roots.map((root) => root.activeElement);
        if (
          stack.includes(entry) &&
          !insideElements(entry).some((element) => active.some((each) => element.contains(each)))
        ) {
          entry.layer.root.request(false, 'focus-out', event);
        }
      });
      continue;
    }
    // A press in a frame moves the focus there with no related target. The active element is the
    // frame one task later (test/measurements/popup.test.ts).
    const doc = ownerDocument(event.target as Element);
    setTimeout(() => {
      const active = activeElement(doc);
      if (
        stack.includes(entry) &&
        active?.localName === 'iframe' &&
        !insideElements(entry).some((element) => contains(element, active))
      ) {
        entry.layer.root.request(false, 'focus-out', event);
      }
    });
  }
}

const handledFocusouts = new WeakSet<Event>();
const escapesOfLayers = new WeakMap<Event, Set<Entry>>();

// WebKit sends `compositionend` before the `keydown` of the Escape that ends a composition
// (https://bugs.webkit.org/show_bug.cgi?id=165004).
let compositionEnd = -Infinity;

function onCompositionend(event: Event) {
  compositionEnd = event.timeStamp;
}

/** The key event is a part of a text composition. */
export function isComposing(event: KeyboardEvent) {
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- An IME sends the key code 229 while it composes. `isComposing` is false for it in some browsers.
  return event.isComposing || event.keyCode === 229 || event.timeStamp - compositionEnd < 5;
}

/**
 * The Escape listener of the stack. A part binds it on an element that has the focus outside the
 * popup, so that a handled Escape does not reach the ancestors of that element. A layer gets each
 * key press one time. With no `allowPropagation()`, the layer stops the event, so one `cancel()`
 * gives one change event for one key press.
 */
export function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented || isComposing(event)) return;
  const handled = escapesOfLayers.get(event) ?? new Set<Entry>();
  escapesOfLayers.set(event, handled);
  const entry = fromTop().find((each) => each.layer.escape && !handled.has(each));
  if (!entry) return;
  handled.add(entry);
  const details = entry.layer.root.request(false, 'escape-key', event);
  if (details.isPropagationAllowed) return;
  event.stopPropagation();
  if (!details.isCanceled) event.preventDefault();
}
