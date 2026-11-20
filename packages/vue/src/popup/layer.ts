import {
  computed,
  effectScope,
  onMounted,
  onUnmounted,
  shallowReactive,
  watch,
  type EffectScope,
} from 'vue';
import { addEventListener } from '../common/addEventListener';
import { mergeCleanups } from '../common/mergeCleanups';
import { ownerDocument, ownerWindow } from '../common/owner';
import { activeElement } from '../common/shadowDom';
import { useScrollLock } from '../common/useScrollLock';
import type { PopupRoot } from './root';

/** What an open root gives to the stack. The properties are reactive. */
export interface Layer {
  readonly root: PopupRoot;
  /** Escape closes the popup. */
  readonly escape: boolean;
  /** A press outside closes the popup. */
  readonly outsidePress: boolean;
  /** A move of the focus to an element outside closes the popup. */
  readonly focusOut: boolean;
  /** An outside press of a mouse or a pen closes the popup at `pointerdown`. */
  readonly pressStart: boolean;
  /** The portal renders a fixed element that takes each pointer from the page. */
  readonly block: boolean;
  /** The attribute that the layer writes on the rest of the page. */
  readonly hide: 'inert' | 'aria-hidden' | false;
  /** Tab keeps the focus in the popup. */
  readonly trap: boolean;
  readonly lockScroll: boolean;
}

export type LayerRules = Omit<Layer, 'root'>;

interface Entry {
  readonly layer: Layer;
  /** The children of `<body>` at the open. */
  readonly bodyChildren: WeakSet<Element>;
  /** For the press that started after the open: it started outside. */
  pressOutside?: boolean;
  /** For the press that started after the open: it ended outside. */
  releaseOutside?: boolean;
}

/** The open layers, in the order of their open. */
const stack = shallowReactive<Entry[]>([]);

/** The layers that the root of each popup has, by root, for the parts of a family. */
const layersOfRoots = new WeakMap<PopupRoot, Layer>();

export function layerOf(root: PopupRoot) {
  return layersOfRoots.get(root);
}

/** The layer is open and no open layer is above it. */
export function isTopLayer(layer: Layer) {
  return stack.at(-1)?.layer === layer;
}

/** The number of open layers above the layer. */
export function layersAbove(layer: Layer) {
  const index = stack.findIndex((entry) => entry.layer === layer);
  return index === -1 ? 0 : stack.length - index - 1;
}

/** The element is in the popup of the layer, in one of its triggers, or in a layer above it. */
export function isInsideLayer(layer: Layer, element: Element) {
  const entry = stack.find((each) => each.layer === layer);
  const inside = entry ? insideElements(entry) : [layer.root.popup];
  return inside.some((each) => !!each?.contains(element));
}

/**
 * Puts the root in the stack from its open to its close, and serves its rules. Call it in the
 * `setup` of a root.
 */
export function useLayer(root: PopupRoot, rules: () => LayerRules) {
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
  };
  layersOfRoots.set(root, layer);

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
        stack.push({ layer, bodyChildren: new WeakSet(doc.body.children) });
        startHide();
        onCleanup(mergeCleanups(remove, listen(doc)));
      },
      { immediate: true, flush: 'sync' },
    );
    // A popup in a shadow root gets the focus events of that root there. The document gets no
    // focus event for a move of the focus in one shadow root.
    watch(
      () => (root.open ? root.popup?.getRootNode() : undefined),
      (node, _, onCleanup) => {
        if (node instanceof ShadowRoot) onCleanup(listen(node));
      },
      { flush: 'post' },
    );
    // The Escape listener of the popup element runs before the listeners of the ancestors of an
    // in-place popup.
    watch(
      () => (root.open ? root.popup : null),
      (element, _, onCleanup) => {
        if (element) onCleanup(addEventListener(element, 'keydown', onKeydown));
      },
      { flush: 'post' },
    );
  });
  onUnmounted(remove);

  useScrollLock(
    () => root.open && layer.lockScroll,
    () => root.activeTrigger,
  );

  return layer;
}

// Each document and each shadow root of a popup gets one set of listeners.
const listeners = new Map<Node, { count: number; stop(): void }>();

function listen(node: Document | ShadowRoot) {
  let entry = listeners.get(node);
  if (!entry) {
    entry = {
      count: 0,
      stop: mergeCleanups(
        addEventListener(node, 'pointerdown', onPointerdown as EventListener, true),
        addEventListener(node, 'pointermove', onPointermove as EventListener, true),
        addEventListener(node, 'pointerup', onPointerup as EventListener, true),
        addEventListener(node, 'pointercancel', onPointerup as EventListener, true),
        addEventListener(node, 'click', onClick as EventListener, true),
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

/** The elements of the layer itself: its popup, its sentinels and its fixed element, its backdrop. */
function ownElements(entry: Entry, withTriggers: boolean): Element[] {
  const { root } = entry.layer;
  const elements = [root.popup, ...root.portalElements];
  if (withTriggers) elements.push(...root.triggers.map((trigger) => trigger.element));
  return elements.filter((element): element is Element => !!element?.isConnected);
}

/** The elements inside the layer: its own, and those of each layer above it. */
function insideElements(entry: Entry) {
  const index = stack.indexOf(entry);
  return [
    ...ownElements(entry, true),
    ...stack.slice(index + 1).flatMap((above) => ownElements(above, true)),
  ];
}

function isFixedElement(entry: Entry, node: EventTarget) {
  return entry.layer.block && entry.layer.root.portalElements.includes(node as Element);
}

/** The event path has an element inside the layer. The fixed element of the layer is outside. */
function isInside(entry: Entry, path: readonly EventTarget[]) {
  const inside = insideElements(entry).filter((element) => !isFixedElement(entry, element));
  return path.some((node) => inside.includes(node as Element));
}

// A press on an element that a script added to `<body>` after the open, and that no layer owns,
// such as the element of a password tool, is no press outside.
function isAddedElement(entry: Entry, path: readonly EventTarget[]) {
  const body = ownerDocument(path[0] as Element).body;
  const child = path.find((node) => (node as Node).parentNode === body) as Element | undefined;
  if (!child || entry.bodyChildren.has(child)) return false;
  return !stack.some((each) => ownElements(each, false).some((element) => child.contains(element)));
}

// A press on a scrollbar sends `pointerdown` with an offset outside the client box of the element
// that scrolls, and no `click` (test/measurements/popup.test.ts). Only a layer that closes at
// `pointerdown` reads it.
function isScrollbarPress(event: PointerEvent | MouseEvent) {
  const target = event.target;
  if (!(target instanceof ownerWindow(target as Element).HTMLElement)) return false;
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
  return fromTop().filter(
    (entry) =>
      entry.layer.outsidePress && !isInside(entry, path) && !isAddedElement(entry, path),
  );
}

interface TouchGesture {
  x: number;
  y: number;
  time: number;
  moved: boolean;
  entries: Entry[];
}

let touch: TouchGesture | null = null;
let pressType = '';
/** From a `pointerdown` of the main button to its `pointerup`. */
let pressing = false;

function onPointerdown(event: PointerEvent) {
  pressType = event.pointerType;
  if (event.pointerType === 'touch') {
    // A touch that rests more than 1 s selects text or opens the menu of the system.
    touch = {
      x: event.clientX,
      y: event.clientY,
      time: event.timeStamp,
      moved: false,
      entries: outsideEntries(event),
    };
    return;
  }
  if (event.button !== 0) return;
  pressing = true;
  const outside = isScrollbarPress(event) ? [] : outsideEntries(event);
  for (const entry of stack) {
    entry.pressOutside = outside.includes(entry);
    entry.releaseOutside = undefined;
  }
  closeOutside(
    event,
    outside.filter((entry) => entry.layer.pressStart),
  );
}

function onPointermove(event: PointerEvent) {
  if (!touch || event.pointerType !== 'touch') return;
  const distance = Math.hypot(event.clientX - touch.x, event.clientY - touch.y);
  if (distance > 5) touch.moved = true;
  if (distance > 10) {
    const { entries } = touch;
    touch = null;
    closeOutside(event, entries);
  }
}

function onPointerup(event: PointerEvent) {
  if (event.pointerType === 'touch') {
    if (!touch) return;
    const { entries, moved, time } = touch;
    touch = null;
    if (moved || event.timeStamp - time < 1000) closeOutside(event, entries);
    return;
  }
  pressing = false;
  if (event.type === 'pointercancel') return;
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
  // A click of a key, of a script or of an assistive tool has no press.
  const withPress = event.detail !== 0;
  if (withPress && pressType === 'touch') return;
  const outside = outsideEntries(event);
  const entries = fromTop().filter((entry) => {
    const pressed = entry.pressOutside;
    entry.pressOutside = undefined;
    const released = entry.releaseOutside;
    entry.releaseOutside = undefined;
    if (entry.layer.pressStart && withPress) return false;
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
    if (!entry.layer.focusOut || !isInside(entry, path)) continue;
    if (related) {
      if (!insideElements(entry).some((element) => element.contains(related))) {
        entry.layer.root.request(false, 'focus-out', event);
      }
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
        !insideElements(entry).some((element) => element.contains(active))
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

// A layer gets each key press one time. With no `allowPropagation()`, the layer stops the event,
// so one `cancel()` gives one change event for one key press.
function onKeydown(event: KeyboardEvent) {
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

// The top layer that asks for it writes `inert` or `aria-hidden` on each sibling of the path from
// each element inside it to `<body>`.
let hideScope: EffectScope | undefined;
const written = new Map<Element, 'inert' | 'aria-hidden'>();

function startHide() {
  if (hideScope) return;
  hideScope = effectScope(true);
  hideScope.run(() => {
    watch(
      () => {
        const top = stack.findLast((entry) => entry.layer.hide);
        if (!top) return null;
        const { root } = top.layer;
        const hide = top.layer.hide as 'inert' | 'aria-hidden';
        return { hide, inside: [...insideElements(top), root.activeTrigger] };
      },
      (next) => writeHide(next),
      { flush: 'post', immediate: true },
    );
  });
}

function writeHide(
  next: { hide: 'inert' | 'aria-hidden'; inside: (Element | null)[] } | null,
) {
  const wanted = new Map<Element, 'inert' | 'aria-hidden'>();
  if (next) {
    const kept = new Set<Node>();
    for (const element of next.inside) {
      if (!element?.isConnected) continue;
      const body = element.ownerDocument.body;
      for (
        let node: Node | null = element;
        node && node !== body;
        node = node.parentNode instanceof ShadowRoot ? node.parentNode.host : node.parentNode
      ) {
        kept.add(node);
      }
    }
    for (const node of kept) {
      for (const sibling of (node.parentNode as ParentNode | null)?.children ?? []) {
        if (!kept.has(sibling) && !sibling.hasAttribute('aria-live')) {
          wanted.set(sibling, next.hide);
        }
      }
    }
  }
  for (const [element, attribute] of written) {
    if (wanted.get(element) === attribute) continue;
    element.removeAttribute(attribute);
    written.delete(element);
  }
  for (const [element, attribute] of wanted) {
    if (written.has(element) || element.hasAttribute(attribute)) continue;
    element.setAttribute(attribute, attribute === 'inert' ? '' : 'true');
    written.set(element, attribute);
  }
  if (stack.length === 0) {
    hideScope?.stop();
    hideScope = undefined;
  }
}
