import {
  DismissPortalRegistration,
  getPortalLocation,
  isPortalOfPart,
} from '../portal/portalElements';
import { inject, onBeforeMount, onMounted, onScopeDispose, provide, toValue, watch } from 'vue';
import type { InjectionKey, MaybeRefOrGetter, WatchSource } from 'vue';
import {
  getComputedStyle,
  getParentNode,
  isElement,
  isHTMLElement,
  isLastTraversableNode,
  isShadowRoot,
} from '@floating-ui/utils/dom';
import { addEventListener } from '../../../common/addEventListener';
import { NOOP } from '../../../common/empty';
import { mergeCleanups } from '../../../common/mergeCleanups';
import { ownerDocument } from '../../../common/owner';
import { platform } from '../../../common/platform';
import { contains, getTarget } from '../../../common/shadowDom';
import { useTimeout } from '../../../common/useTimeout';
import { createChangeEventDetails } from '../../../internals/createVaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import type { FloatingUIOpenChangeDetails } from '../../../internals/types';
import { useKeepAliveState } from '../../../internals/useKeepAliveState';
import { createAttribute } from '../createAttribute';
import { isEventTargetWithin, isRootElement } from '../element';
import { isVirtualClick } from '../event';
import { useFloatingTree } from '../tree/FloatingTree';
import type { FloatingTreeStore } from '../tree/FloatingTreeStore';
import { getNodeChildren } from '../tree/nodes';
import type { PopupInteractionStore } from '../types';
import { useDomEffect } from '../useDomEffect';

type PressType = 'intentional' | 'sloppy';
type PressTypes = PressType | { mouse: PressType; touch: PressType };
type Bubbles = boolean | { escapeKey?: boolean | undefined; outsidePress?: boolean | undefined };

interface PopupLayers {
  version: 1;
  /** The number that the popup that opened last took. */
  count: number;
  /** The highest number of the popups that keep an Escape event for themselves. */
  escape: WeakMap<Event, number>;
  /** The highest number of the popups that hold the target of a press event. */
  press: WeakMap<Event, number>;
}

const POPUP_LAYERS_KEY = Symbol.for('vase-ui.popup-layers');

// A capture listener for each of these events marks a press, as the capture listeners of `floating` do.
const PRESS_EVENTS = [
  'click',
  'mousedown',
  'pointerdown',
  'mouseup',
  'touchend',
  'touchmove',
] as const;

// An open popup takes a number when it opens, and a parent opens before its child. An Escape that
// reaches the document does not go through the `keydown` handler of a popup element, for example
// when the focus is on `body` after a backdrop press. `stopPropagation()` cannot stop the other
// listeners of the document. Thus each open popup that keeps Escape for itself records its number
// for the event in the capture phase. The popup with the highest recorded number handles the
// event, together with each newer popup that lets Escape bubble.
// The same numbers decide which popup owns a press. A press in a popup that opened after this one
// belongs to that popup, so it is not an outside press here. An example is a modal Dialog that is
// not below this popup in the component tree.
// Two copies of the library on one page share the numbers, so the key is a `Symbol.for` key.
function getPopupLayers(): PopupLayers {
  const holder = globalThis as { [POPUP_LAYERS_KEY]?: PopupLayers };
  holder[POPUP_LAYERS_KEY] ??= {
    version: 1,
    count: 0,
    escape: new WeakMap(),
    press: new WeakMap(),
  };
  return holder[POPUP_LAYERS_KEY];
}

const POSITIONER_GETTERS_KEY = Symbol.for('vase-ui.positioner-getters');

// A press in a popup of a second copy of the library can belong to that popup, so the copies share
// the getters as they share the numbers.
function getPositionerElementGetters(): Set<() => Element | null> {
  const holder = globalThis as { [POSITIONER_GETTERS_KEY]?: Set<() => Element | null> };
  holder[POSITIONER_GETTERS_KEY] ??= new Set();
  return holder[POSITIONER_GETTERS_KEY];
}

/** Whether the shadow tree of `target` holds the positioner element of a popup, at any depth. */
function hostsPopup(target: EventTarget) {
  for (const getPositionerElement of getPositionerElementGetters()) {
    let root = getPositionerElement()?.getRootNode();
    while (isShadowRoot(root)) {
      if (root.host === target) {
        return true;
      }
      root = root.host.getRootNode();
    }
  }
  return false;
}

interface DismissParent {
  addElementBelow(getElement: () => Element | null | undefined): () => void;
  markInsideComponentTree(): void;
  markPressStartedInside(event: PointerEvent | MouseEvent): void;
  markInsidePressStartPrevented(event: PointerEvent | MouseEvent): void;
  handleKeydown(event: KeyboardEvent): void;
}

// A Teleport moves the DOM event outside its parent popup.
const DismissParentContext: InjectionKey<DismissParent> = Symbol();

export function normalizeProp(normalizable?: Bubbles) {
  return {
    escapeKey:
      typeof normalizable === 'boolean' ? normalizable : (normalizable?.escapeKey ?? false),
    outsidePress:
      typeof normalizable === 'boolean' ? normalizable : (normalizable?.outsidePress ?? true),
  };
}

function getFrameDocuments(doc: Document): Document[] {
  const view = doc.defaultView;
  const frameDocuments: Document[] = [];
  for (let index = 0; view && index < view.length; index += 1) {
    let frameDocument: Document;
    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The loop condition proves the index.
      frameDocument = view[index]!.document;
    } catch {
      // A cross-origin frame throws when code reads its document.
      continue;
    }
    frameDocuments.push(frameDocument, ...getFrameDocuments(frameDocument));
  }
  return frameDocuments;
}

/**
 * Gives the frame element of `doc` that holds the target of the event, at any depth. It gives
 * `null` when the target is in `doc` itself.
 */
function getFrameOfEvent(event: Event, doc: Document): Element | null {
  let view = (getTarget(event) as Node | null)?.ownerDocument?.defaultView;
  while (view && view.document !== doc) {
    const frame = view.frameElement;
    if (frame?.ownerDocument === doc) {
      return frame;
    }
    view = frame?.ownerDocument.defaultView;
  }
  return null;
}

export interface DismissLayerOptions {
  /**
   * Whether the composable is enabled, including its document listeners and its event handlers.
   * @default true
   */
  enabled?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Whether to dismiss the floating element upon pressing the `esc` key.
   * @default true
   */
  escapeKey?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Whether to dismiss the floating element upon pressing the reference element.
   *
   * The composable calls the function when it handles a press of the reference.
   * @default false
   */
  referencePress?: (() => boolean) | undefined;
  /**
   * Whether to dismiss the floating element upon pressing outside of the floating element.
   * A function decides for each press. The composable reads the option one time, so a function is
   * the form that follows a change.
   * No caller of Base UI gives a Boolean that changes.
   * @default true
   */
  outsidePress?: boolean | ((event: MouseEvent | TouchEvent) => boolean) | undefined;
  /**
   * The type of event to use to determine an outside "press".
   * - `intentional` dismisses on an outside `click` whose press began while the floating element was open, ignoring the trailing click of a press that started before it opened. Touch requires minimal `touchmove`s, and press-less clicks (keyboard, assistive technology) are always accepted.
   * - `sloppy` fires on `pointerdown` for mouse, while for touch it fires on `touchend` (within 1 second) or while scrolling away after `touchstart`.
   * @default 'sloppy'
   */
  outsidePressEvent?: MaybeRefOrGetter<PressTypes | undefined>;
  /**
   * Determines whether event listeners bubble upwards through a tree of floating elements.
   * `escapeKey` also determines whether an Escape that reaches the document, rather than a
   * floating element, propagates to floating elements opened earlier, even when they share no
   * floating tree.
   */
  bubbles?: MaybeRefOrGetter<Bubbles | undefined>;
  /**
   * External floating tree to use when the one provided by context can't be used.
   */
  externalTree?: MaybeRefOrGetter<FloatingTreeStore | undefined>;
}

/** Owns the open layer, its gesture and the listeners in its document and frames. */
export function useDismissLayer(
  store: MaybeRefOrGetter<PopupInteractionStore>,
  props: DismissLayerOptions = {},
) {
  const {
    enabled: enabledOption,
    escapeKey: escapeKeyOption,
    outsidePress = true,
    outsidePressEvent,
    referencePress,
    bubbles,
    externalTree,
  } = props;

  const getStore = () => toValue(store);

  const tree = useFloatingTree(externalTree);
  const outsidePressEnabled = outsidePress !== false;

  const isEnabled = () => toValue(enabledOption) ?? true;
  const isEscapeKeyEnabled = () => toValue(escapeKeyOption) ?? true;
  const getBubbles = () => normalizeProp(toValue(bubbles));

  let pressStartedInside = false;
  let pressStartPrevented = false;
  // Ignore only the very next outside click after dragging from inside to outside.
  let suppressNextOutsideClick = false;
  // A click whose press began before the floating element opened is the tail of that
  // gesture (e.g. the drag-release that opened it), not a new outside press.
  let sawPressWhileOpen = false;
  let compositionEndPending = false;
  let currentPointerType: PointerEvent['pointerType'] = '';
  let touchState: {
    startTime: number;
    startX: number;
    startY: number;
    dismissOnTouchEnd: boolean;
    dismissOnMouseDown: boolean;
  } | null = null;

  const cancelDismissOnEndTimeout = useTimeout();
  const clearInsideComponentTreeTimeout = useTimeout();
  // A change of document listeners must let a pending composition reset finish.
  const compositionTimeout = useTimeout();
  const preventedPressSuppressionTimeout = useTimeout();

  const parent = inject(DismissParentContext, undefined);

  // The positioner of each popup below this call in the component tree, and each portal element
  // below it. A release on the backdrop of a child popup gives the inside marker to the click that
  // follows, so that click takes no suppression. The release check thus counts the portal of a
  // child popup as inside too.
  const elementsBelow = new Set<() => Element | null | undefined>();

  function addElementBelow(getElement: () => Element | null | undefined) {
    elementsBelow.add(getElement);
    const removeFromParent = parent?.addElementBelow(getElement);
    return () => {
      elementsBelow.delete(getElement);
      removeFromParent?.();
    };
  }

  function ownsPortal(portal: Element) {
    const currentStore = getStore();
    return (
      isPortalOfPart(portal, currentStore.select('positionerElement')) ||
      isPortalOfPart(portal, currentStore.context.popupRef?.value) ||
      isPortalOfPart(portal, currentStore.context.backdropRef?.value) ||
      isPortalOfPart(portal, currentStore.context.internalBackdropRef?.value)
    );
  }

  function someElementBelow(predicate: (element: Element) => boolean) {
    const nodeId = getStore().context.positioning?.nodeId;
    if (
      tree.value &&
      getNodeChildren(tree.value.nodesRef.value, nodeId).some((node) => {
        const floatingElement = node.context?.elements.floating;
        return floatingElement != null && predicate(floatingElement);
      })
    ) {
      return true;
    }

    for (const getElement of elementsBelow) {
      const element = getElement();
      if (element && !ownsPortal(element) && predicate(element)) {
        return true;
      }
    }

    return false;
  }

  // The elements below cannot replace the inside marker. The document sees the host as the target
  // of a press in a closed shadow root. A press can also close a child popup, and Vue can remove
  // that popup before the popup above checks the press.
  // A closed store that a module shares has a frozen context. The two functions thus write the
  // marker only for an open popup and only when it is set.
  let markedStore: PopupInteractionStore | undefined;
  function clearInsideComponentTree(store = getStore()) {
    if (markedStore === store) {
      clearInsideComponentTreeTimeout.clear();
      markedStore = undefined;
    }
    store.context.insideComponentTree &&= false;
  }

  // A press can reach a new store before the post-flush watcher subscribes to it.
  function clearMarkedStore() {
    if (markedStore) {
      clearInsideComponentTree(markedStore);
    }
  }
  onScopeDispose(clearMarkedStore);

  function markInsideComponentTree() {
    parent?.markInsideComponentTree();
    const store = getStore();
    if (!isEnabled() || !store.select('open')) {
      return;
    }
    if (markedStore !== store) {
      clearMarkedStore();
    }
    markedStore = store;
    store.context.insideComponentTree = true;
    clearInsideComponentTreeTimeout.start(0, clearMarkedStore);
  }

  // The portal of this popup can hold its backdrop and its other parts outside the popup element.
  // A press there is outside this popup and inside the popups above, so only they get the marker.
  // No popup records a press start there, because the backdrop can unmount before the release. A
  // portal below this popup that no popup owns, such as `NavigationMenu.Portal`, is inside this
  // popup.
  function markInsidePortal(portal: Element, event: Event) {
    if (ownsPortal(portal)) {
      parent?.markInsideComponentTree();
      return;
    }
    markInsideComponentTree();
    if (event.type === 'pointerdown' || event.type === 'mousedown') {
      markPressStartedInside(event as PointerEvent | MouseEvent);
    }
  }

  function markPortalPressStartPrevented(portal: Element, event: PointerEvent | MouseEvent) {
    if (!ownsPortal(portal)) {
      markInsidePressStartPrevented(event);
    }
  }

  function hasBlockingChild(bubbleKey: 'escapeKeyBubbles' | 'outsidePressBubbles') {
    const nodeId = getStore().context.positioning?.nodeId;
    const children = tree.value ? getNodeChildren(tree.value.nodesRef.value, nodeId) : [];

    return children.some(
      (child) => child.context?.open && !child.context.rootStore.context[bubbleKey],
    );
  }

  function closeOnReferencePress(event: MouseEvent | PointerEvent) {
    if (!isEnabled() || !referencePress?.()) {
      return;
    }

    getStore().setOpen(false, createChangeEventDetails(REASONS.triggerPress, event));
  }

  function closeOnEscapeKeyDown(event: KeyboardEvent) {
    if (
      !getStore().select('open') ||
      !isEnabled() ||
      !isEscapeKeyEnabled() ||
      event.key !== 'Escape'
    ) {
      return;
    }

    // Key code 229 indicates that an IME is processing the key event.
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- The key code 229 is the IME workaround of Base UI, and the code keeps it.
    const isImeKey = event.keyCode === 229;

    // Wait until IME is settled. Pressing `Escape` while composing should
    // close the compose menu, but not the floating element. The flag covers Safari, which fires
    // `compositionend` before `keydown`; the event identifies an active composition.
    if (compositionEndPending || event.isComposing || isImeKey) {
      return;
    }

    const { escapeKey: escapeKeyBubbles } = getBubbles();

    if (!escapeKeyBubbles && hasBlockingChild('escapeKeyBubbles')) {
      return;
    }

    const eventDetails = createChangeEventDetails(REASONS.escapeKey, event);

    getStore().setOpen(false, eventDetails);

    if (!eventDetails.isCanceled) {
      event.preventDefault();
    }

    if (!escapeKeyBubbles && !eventDetails.isPropagationAllowed) {
      event.stopPropagation();
    }
  }

  // A `keydown` that no handler stopped goes to the popup above in the component tree, as a
  // React event does. The DOM gives the event to that popup itself when its element holds the
  // target.
  function handleFloatingKeydown(event: KeyboardEvent) {
    closeOnEscapeKeyDown(event);
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- `cancelBubble` is the only read that tells that a handler stopped the event.
    if (!event.cancelBubble) {
      parent?.handleKeydown(event);
    }
  }

  provide(DismissParentContext, {
    addElementBelow,
    markInsideComponentTree,
    markPressStartedInside,
    markInsidePressStartPrevented,
    handleKeydown(event) {
      if (!isEventTargetWithin(event, getStore().select('positionerElement'))) {
        handleFloatingKeydown(event);
      }
    },
  });

  provide(DismissPortalRegistration, (portal) => {
    // Native capture leaves a newly mounted child's Vue listener eligible for this same press.
    const mark = (event: Event) => markInsidePortal(portal, event);
    const markPrevented = (event: PointerEvent | MouseEvent) =>
      markPortalPressStartPrevented(portal, event);
    return mergeCleanups(
      addElementBelow(() => portal),
      ...PRESS_EVENTS.map((type) =>
        addEventListener(portal, type, mark, { capture: true, passive: true }),
      ),
      addEventListener(portal, 'pointerdown', markPrevented),
      addEventListener(portal, 'mousedown', markPrevented),
    );
  });

  // The inside marker expires in its timer before the release of a held press. The record of the
  // press start lasts until the release, so each popup above needs it too (`VUE-4`).
  function markPressStartedInside(event: PointerEvent | MouseEvent) {
    parent?.markPressStartedInside(event);
    if (!getStore().select('open') || !isEnabled() || event.button !== 0) {
      return;
    }

    const target = getTarget(event) as Element | null;

    // `NavigationMenu.List` puts the `floating` handlers on the list element, outside the
    // positioner. A press on the list must not record a start for the popup.
    if (
      !contains(getStore().select('positionerElement'), target) &&
      !someElementBelow((element) => contains(element, target))
    ) {
      return;
    }

    if (!pressStartedInside) {
      pressStartedInside = true;
      pressStartPrevented = false;
    }
  }

  function markInsidePressStartPrevented(event: PointerEvent | MouseEvent) {
    // A prevented press can produce no click. Without this state, the suppression of a popup above
    // stays after the release.
    parent?.markInsidePressStartPrevented(event);
    if (!getStore().select('open') || !isEnabled()) {
      return;
    }

    if (!event.defaultPrevented) {
      return;
    }

    if (pressStartedInside) {
      pressStartPrevented = true;
    }
  }

  // This popup's open number orders Escape and outside-press ownership (see `getPopupLayers`).
  let layer = 0;
  function takeLayer(open: boolean) {
    if (open) {
      const popupLayers = getPopupLayers();
      popupLayers.count += 1;
      layer = popupLayers.count;
    }
  }
  function claimPress(event: Event) {
    const { press } = getPopupLayers();
    press.set(event, Math.max(press.get(event) ?? 0, layer));
  }

  // The document cannot see the path of a press in a closed shadow root, so the capture listeners
  // of the popup element claim the press too.
  function markPressInside(event: Event) {
    markInsideComponentTree();
    if (isEnabled() && getStore().select('open')) {
      claimPress(event);
    }
  }

  // A server does not call `onBeforeMount`, so a server render takes no number. The hook runs for
  // a parent before its children, and `onMounted` runs for the children first.
  onBeforeMount(() => takeLayer(getStore().select('open')));
  watch(() => getStore().select('open'), takeLayer);

  // A close and an open in one flush never show `open === false` to a watcher, so only
  // `openchange` can observe that session boundary. The listener effect covers the other changes.
  function handleOpenChange(details: FloatingUIOpenChangeDetails) {
    // Only the closing half ends the session: `setOpen(true)` on an already-open
    // element (hovering an inactive trigger) must not drop a press mid-gesture.
    if (!details.open) {
      sawPressWhileOpen = false;
    }
  }

  function resetPressStartState() {
    pressStartedInside = false;
    pressStartPrevented = false;
  }

  function resetSession() {
    sawPressWhileOpen = false;
    compositionEndPending = false;
    currentPointerType = '';
    touchState = null;
    cancelDismissOnEndTimeout.clear();
    compositionTimeout.clear();
  }

  function listenToDocument() {
    const store = getStore();
    const open = store.select('open');
    if (!open || !isEnabled()) {
      // A source can change mid-gesture. Only a close or a hold ends the session.
      if (!open) {
        resetSession();
      }
      // A closed shadow root has no other inside-press signal. Keep the marker during a press.
      return () => clearInsideComponentTree(store);
    }

    const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = getBubbles();
    getStore().context.escapeKeyBubbles = escapeKeyBubbles;
    getStore().context.outsidePressBubbles = outsidePressBubbles;

    const doc = ownerDocument(getStore().select('positionerElement'));

    function handleCompositionEnd() {
      // Safari fires `compositionend` before `keydown`, so we need to wait
      // until the next tick before dismissing. Open this bounded window on compositionend
      // even when the composition began while the popup was closed.
      // https://bugs.webkit.org/show_bug.cgi?id=165004
      // The other engines send that `keydown` first, with `isComposing`, so they need no window.
      // A window there drops an Escape that comes before its timer.
      if (!platform.engine.webkit) {
        return;
      }
      compositionEndPending = true;
      // 0ms or 1ms don't work in Safari. 5ms appears to consistently work.
      compositionTimeout.start(5, () => {
        compositionEndPending = false;
      });
    }

    function suppressImmediateOutsideClickAfterPreventedStart() {
      suppressNextOutsideClick = true;
      // Firefox can emit the synthetic outside click in a later task after
      // pointer lock exit, so microtask clearing is too early here.
      preventedPressSuppressionTimeout.start(0, () => {
        suppressNextOutsideClick = false;
      });
    }

    function getOutsidePressEvent(): PressType {
      const type = currentPointerType as 'pen' | 'mouse' | 'touch' | '';
      const computedType = type === 'pen' || !type ? 'mouse' : type;
      const resolved = toValue(outsidePressEvent) ?? 'sloppy';

      if (typeof resolved === 'string') {
        return resolved;
      }

      return resolved[computedType];
    }

    function shouldIgnoreEvent(event: Event) {
      const computedOutsidePressEvent = getOutsidePressEvent();
      return (
        (computedOutsidePressEvent === 'intentional' && event.type !== 'click') ||
        (computedOutsidePressEvent === 'sloppy' && event.type === 'click')
      );
    }

    // The path of an event in a frame has no node of this document. The frame element then takes
    // the place of the target.
    function isEventWithin(event: Event, element: Element | null | undefined) {
      return isEventTargetWithin(event, element) || contains(element, getFrameOfEvent(event, doc));
    }

    function isEventWithinOwnElements(event: Event) {
      return (
        isEventWithin(event, getStore().select('positionerElement')) ||
        isEventWithin(event, getStore().select('anchorElement'))
      );
    }

    function isEventWithinPopupOrBelow(event: Event) {
      return (
        isEventWithinOwnElements(event) ||
        someElementBelow((element) => isEventWithin(event, element))
      );
    }

    function closeOnPressOutside(event: MouseEvent | PointerEvent | TouchEvent) {
      if (shouldIgnoreEvent(event)) {
        // A new press began outside the floating element and its trigger. Clear any
        // leftover drag-out suppression so this press's eventual click can dismiss.
        if (event.type !== 'click' && !isEventWithinOwnElements(event)) {
          preventedPressSuppressionTimeout.clear();
          suppressNextOutsideClick = false;
        }
        clearInsideComponentTree();
        return;
      }

      if (getStore().context.insideComponentTree) {
        clearInsideComponentTree();
        return;
      }

      if ((getPopupLayers().press.get(event) ?? 0) > layer) {
        return;
      }

      const target = getTarget(event);
      // A press in a frame is a press on the frame element for the checks of this document.
      const targetInDocument = getFrameOfEvent(event, doc) ?? target;
      const inertSelector = `[${createAttribute('inert')}]`;
      const targetRoot = isElement(targetInDocument) ? targetInDocument.getRootNode() : null;
      const markers = Array.from(
        (isShadowRoot(targetRoot)
          ? targetRoot
          : ownerDocument(getStore().select('positionerElement'))
        ).querySelectorAll(inertSelector),
      );

      const triggers = getStore().context.triggerElements;

      // If another trigger is clicked, don't close the floating element.
      if (
        targetInDocument &&
        (triggers.hasElement(targetInDocument as Element) ||
          triggers.hasMatchingElement((trigger) => contains(trigger, targetInDocument as Element)))
      ) {
        return;
      }

      let targetRootAncestor = isElement(targetInDocument) ? targetInDocument : null;
      while (targetRootAncestor && !isLastTraversableNode(targetRootAncestor)) {
        const nextParent = getParentNode(targetRootAncestor);
        if (isLastTraversableNode(nextParent) || !isElement(nextParent)) {
          break;
        }

        targetRootAncestor = nextParent;
      }

      // Check if the click occurred on a third-party element injected after the
      // floating element rendered.
      if (
        markers.length &&
        isElement(targetInDocument) &&
        !isRootElement(targetInDocument) &&
        // Clicked on a direct ancestor (e.g. FloatingOverlay).
        !contains(targetInDocument, getStore().select('positionerElement')) &&
        // If the target root element contains none of the markers, then the
        // element was injected after the floating element rendered.
        markers.every((marker) => !contains(targetRootAncestor, marker))
      ) {
        return;
      }

      // Check if the click occurred on the scrollbar
      // Skip for touch events: scrollbars don't receive touch events on most platforms
      // In a frame, the offsets of the event are relative to its target, not to the frame element.
      if (isHTMLElement(target) && !('touches' in event)) {
        const lastTraversableNode = isLastTraversableNode(target);
        const style = getComputedStyle(target);
        const scrollRe = /auto|scroll/;
        const isScrollableX = lastTraversableNode || scrollRe.test(style.overflowX);
        const isScrollableY = lastTraversableNode || scrollRe.test(style.overflowY);

        const canScrollX =
          isScrollableX && target.clientWidth > 0 && target.scrollWidth > target.clientWidth;
        const canScrollY =
          isScrollableY && target.clientHeight > 0 && target.scrollHeight > target.clientHeight;

        const isRTL = style.direction === 'rtl';

        // Check click position relative to scrollbar.
        // In some browsers it is possible to change the <body> (or window)
        // scrollbar to the left side, but is very rare and is difficult to
        // check for. Plus, for modal dialogs with backdrops, it is more
        // important that the backdrop is checked but not so much the window.
        const pressedVerticalScrollbar =
          canScrollY &&
          (isRTL
            ? event.offsetX <= target.offsetWidth - target.clientWidth
            : event.offsetX > target.clientWidth);

        const pressedHorizontalScrollbar = canScrollX && event.offsetY > target.clientHeight;

        if (pressedVerticalScrollbar || pressedHorizontalScrollbar) {
          return;
        }
      }

      if (isEventWithinPopupOrBelow(event)) {
        return;
      }

      // Only `click` events reach this point in intentional mode.
      if (getOutsidePressEvent() === 'intentional') {
        // Press-less clicks (keyboard, assistive technology, `element.click()`) report no
        // click count; `isVirtualClick` also catches the ones that do.
        if (
          (event as MouseEvent).detail !== 0 &&
          !isVirtualClick(event as MouseEvent) &&
          !sawPressWhileOpen
        ) {
          return;
        }

        // A press that starts inside and ends outside gets one suppressed
        // outside click. Run this after inside-target checks so inside clicks
        // don't consume the one-shot suppression.
        if (suppressNextOutsideClick) {
          preventedPressSuppressionTimeout.clear();
          suppressNextOutsideClick = false;
          return;
        }
      }

      if (typeof outsidePress === 'function' && !outsidePress(event)) {
        return;
      }

      if (hasBlockingChild('outsidePressBubbles')) {
        return;
      }

      getStore().setOpen(false, createChangeEventDetails(REASONS.outsidePress, event));
      clearInsideComponentTree();
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        getOutsidePressEvent() !== 'sloppy' ||
        event.pointerType === 'touch' ||
        !getStore().select('open') ||
        !isEnabled() ||
        isEventWithinOwnElements(event)
      ) {
        return;
      }

      closeOnPressOutside(event);
    }

    function handleTouchStart(event: TouchEvent) {
      if (
        getOutsidePressEvent() !== 'sloppy' ||
        !getStore().select('open') ||
        !isEnabled() ||
        isEventWithinOwnElements(event)
      ) {
        return;
      }

      const touch = event.touches[0];
      if (touch) {
        touchState = {
          startTime: Date.now(),
          startX: touch.clientX,
          startY: touch.clientY,
          dismissOnTouchEnd: false,
          dismissOnMouseDown: true,
        };

        cancelDismissOnEndTimeout.start(1000, () => {
          if (touchState) {
            touchState.dismissOnTouchEnd = false;
            touchState.dismissOnMouseDown = false;
          }
        });
      }
    }

    // A press in a frame in the popup element reaches no capture listener of that element, so the
    // popups above get no marker from it. This popup needs none: the frame element takes the place
    // of the target in its own checks.
    function markPressInFrame(event: Event) {
      if (contains(getStore().select('positionerElement'), getFrameOfEvent(event, doc))) {
        parent?.markInsideComponentTree();
      }
    }

    function addTargetEventListenerOnce<EventType extends Event>(
      event: EventType,
      listener: (event: EventType) => void,
    ) {
      const target = getTarget(event);

      if (!target) {
        return;
      }

      markPressInFrame(event);

      // React runs the listeners of the pressed element at its root, after this listener. A
      // capture listener of the target runs before the bubble listeners of the target. Thus the
      // press closes the popup first, and a listener of the pressed element can open it again.
      // Two targets get a bubble listener. A capture listener that the document gets while it
      // runs its capture listeners does not run for this event. A press in a closed shadow root
      // has the host as its target here. The capture listeners of a popup element in that tree
      // must mark the press before this listener runs.
      const capture = target !== event.currentTarget && !hostsPopup(target);

      // If propagation stops before the target, this runs on the next event of the type to reach
      // it instead, which must not be handled as the stopped one.
      const unsubscribe = addEventListener(
        target,
        event.type,
        (currentEvent) => {
          unsubscribe();
          if (currentEvent === event) {
            listener(event);
          }
        },
        capture,
      );
    }

    function handleTouchStartCapture(event: TouchEvent) {
      currentPointerType = 'touch';
      addTargetEventListenerOnce(event, handleTouchStart);
    }

    function closeOnPressOutsideCapture(event: PointerEvent | MouseEvent) {
      cancelDismissOnEndTimeout.clear();

      // Only `pointerdown` marks a press; `mousedown` is its compatibility event, and
      // counting it would misattribute a gesture that started before open.
      if (event.type === 'pointerdown') {
        // Only a primary press can produce a `click`.
        if (event.button === 0) {
          sawPressWhileOpen = true;
        }
        currentPointerType = (event as PointerEvent).pointerType;
      }

      if (event.type === 'mousedown' && touchState && !touchState.dismissOnMouseDown) {
        return;
      }

      addTargetEventListenerOnce(event, (targetEvent) => {
        if (targetEvent.type === 'pointerdown') {
          handlePointerDown(targetEvent as PointerEvent);
        } else {
          closeOnPressOutside(targetEvent);
        }
      });
    }

    function handlePressEndCapture(event: PointerEvent | MouseEvent) {
      // A cancelled gesture produces no click. Not cleared on `pointerup`: the click
      // fires after it and must still find the press.
      if (event.type === 'pointercancel') {
        sawPressWhileOpen = false;
      }

      if (!pressStartedInside) {
        return;
      }

      const pressStartedInsideDefaultPrevented = pressStartPrevented;
      resetPressStartState();

      if (getOutsidePressEvent() !== 'intentional') {
        return;
      }

      if (event.type === 'pointercancel') {
        if (pressStartedInsideDefaultPrevented) {
          suppressImmediateOutsideClickAfterPreventedStart();
        }
        return;
      }

      if (isEventWithinPopupOrBelow(event)) {
        return;
      }

      // If pointerdown was prevented, no click may be generated for that
      // interaction. However, Firefox may still emit an immediate click after
      // pointerup (e.g. NumberField scrub with pointer lock), so suppress for
      // one tick to absorb that synthetic click only.
      if (pressStartedInsideDefaultPrevented) {
        suppressImmediateOutsideClickAfterPreventedStart();
        return;
      }

      // Avoid suppressing when outsidePress explicitly ignores this target.
      if (typeof outsidePress === 'function' && !outsidePress(event)) {
        return;
      }

      preventedPressSuppressionTimeout.clear();
      suppressNextOutsideClick = true;
      clearInsideComponentTree();
    }

    function handleTouchMove(event: TouchEvent) {
      if (getOutsidePressEvent() !== 'sloppy' || !touchState || isEventWithinOwnElements(event)) {
        return;
      }

      const touch = event.touches[0];
      if (!touch) {
        return;
      }

      const deltaX = Math.abs(touch.clientX - touchState.startX);
      const deltaY = Math.abs(touch.clientY - touchState.startY);
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance > 5) {
        touchState.dismissOnTouchEnd = true;
      }

      if (distance > 10) {
        closeOnPressOutside(event);
        cancelDismissOnEndTimeout.clear();
        touchState = null;
      }
    }

    function handleTouchMoveCapture(event: TouchEvent) {
      addTargetEventListenerOnce(event, handleTouchMove);
    }

    function handleTouchEnd(event: TouchEvent) {
      if (getOutsidePressEvent() !== 'sloppy' || !touchState || isEventWithinOwnElements(event)) {
        return;
      }

      if (touchState.dismissOnTouchEnd) {
        closeOnPressOutside(event);
      }

      cancelDismissOnEndTimeout.clear();
      touchState = null;
    }

    function handleTouchEndCapture(event: TouchEvent) {
      addTargetEventListenerOnce(event, handleTouchEnd);
    }

    // The listener runs in the capture phase of the document. Thus each open popup that holds the
    // target records its number before a `closeOnPressOutside` check runs on the target.
    function recordPressLayer(event: Event) {
      if (isEventWithin(event, getStore().select('positionerElement'))) {
        claimPress(event);
      }
    }

    function listenForPress(pressDocument: Document) {
      return mergeCleanups(
        addEventListener(pressDocument, 'pointerdown', recordPressLayer, true),
        addEventListener(pressDocument, 'mousedown', recordPressLayer, true),
        addEventListener(pressDocument, 'click', recordPressLayer, true),
        addEventListener(pressDocument, 'touchmove', recordPressLayer, {
          capture: true,
          passive: true,
        }),
        addEventListener(pressDocument, 'touchend', recordPressLayer, {
          capture: true,
          passive: true,
        }),
        outsidePressEnabled &&
          mergeCleanups(
            addEventListener(pressDocument, 'click', closeOnPressOutsideCapture, true),
            addEventListener(pressDocument, 'pointerdown', closeOnPressOutsideCapture, true),
            addEventListener(pressDocument, 'pointerup', handlePressEndCapture, true),
            addEventListener(pressDocument, 'pointercancel', handlePressEndCapture, true),
            addEventListener(pressDocument, 'mousedown', closeOnPressOutsideCapture, true),
            addEventListener(pressDocument, 'mouseup', handlePressEndCapture, true),
            addEventListener(pressDocument, 'touchstart', handleTouchStartCapture, {
              capture: true,
              passive: true,
            }),
            addEventListener(pressDocument, 'touchmove', handleTouchMoveCapture, {
              capture: true,
              passive: true,
            }),
            addEventListener(pressDocument, 'touchend', handleTouchEndCapture, {
              capture: true,
              passive: true,
            }),
          ),
      );
    }

    // A press in a frame sends no event to the document of the popup, so each frame below it gets
    // the press listeners too. A frame has a new document when it loads, and `load` does not
    // bubble. A capture listener for `load` on each document finds a frame that loads while the
    // popup is open.
    function listenInFrames() {
      // eslint-disable-next-line no-restricted-syntax -- This effect replaces its frame listeners when a frame loads.
      let stopListening = NOOP;

      function listen() {
        stopListening();
        stopListening = mergeCleanups(
          ...getFrameDocuments(doc).map((frameDocument) =>
            mergeCleanups(
              listenForPress(frameDocument),
              addEventListener(frameDocument, 'load', handleFrameLoad, true),
            ),
          ),
        );
      }

      function handleFrameLoad(event: Event) {
        const target = getTarget(event);
        if (isElement(target) && target.localName === 'iframe') {
          listen();
        }
      }

      listen();
      return mergeCleanups(addEventListener(doc, 'load', handleFrameLoad, true), () =>
        stopListening(),
      );
    }

    const unsubscribe = mergeCleanups(
      isEscapeKeyEnabled() &&
        mergeCleanups(
          addEventListener(
            doc,
            'keydown',
            (event) => {
              if (!escapeKeyBubbles) {
                const { escape } = getPopupLayers();
                escape.set(event, Math.max(escape.get(event) ?? 0, layer));
              }
            },
            true,
          ),
          addEventListener(doc, 'keydown', (event) => {
            if (layer >= (getPopupLayers().escape.get(event) ?? 0)) {
              closeOnEscapeKeyDown(event);
            }
          }),
          addEventListener(doc, 'compositionend', handleCompositionEnd),
        ),
      listenForPress(doc),
      listenInFrames(),
    );

    return () => {
      unsubscribe();
      preventedPressSuppressionTimeout.clear();
      resetPressStartState();
      suppressNextOutsideClick = false;
    };
  }

  const { isHeld } = useKeepAliveState();
  const getPositionerElement = () => getStore().select('positionerElement');
  const listenerSources: [typeof getStore, ...WatchSource[]] = [
    getStore,
    () => getStore().select('open'),
    isEnabled,
    () => getPortalLocation(getPositionerElement()).document,
    isEscapeKeyEnabled,
    () => getBubbles().escapeKey,
    () => getBubbles().outsidePress,
    tree,
  ];

  // A server calls no `onMounted` hook and runs no such `watch`, so a server render adds no
  // listener to a document or to a store that a module shares.
  onMounted(() => {
    const getters = getPositionerElementGetters();
    getters.add(getPositionerElement);
    onScopeDispose(() => getters.delete(getPositionerElement));
    if (parent) {
      onScopeDispose(parent.addElementBelow(getPositionerElement));
    }
    watch(
      getStore,
      (store, _previous, onCleanup) => {
        store.context.events.on('openchange', handleOpenChange);
        onCleanup(() => {
          store.context.events.off('openchange', handleOpenChange);
          // A marker left on the previous store would count its next outside press as inside.
          store.context.insideComponentTree &&= false;
        });
      },
      { immediate: true, flush: 'post' },
    );
    // The hold ends the gesture. Its inside marker lasts until the next update or activation.
    watch(
      () => (isHeld.value ? getStore() : null),
      (heldStore, _previous, onCleanup) => {
        if (heldStore) {
          resetSession();
          onCleanup(() => clearInsideComponentTree(heldStore));
        }
      },
      { immediate: true, flush: 'sync' },
    );
    watch(
      listenerSources,
      ([store]) => {
        if (isHeld.value) {
          clearInsideComponentTree(store);
          resetSession();
        }
      },
      { flush: 'post' },
    );
  });
  useDomEffect(listenerSources, listenToDocument, isHeld);

  function startPress(event: PointerEvent | MouseEvent) {
    markPressInside(event);
    markPressStartedInside(event);
  }

  return {
    closeOnEscapeKeyDown,
    closeOnReferencePress,
    handleFloatingKeydown,
    markInsideComponentTree,
    markInsidePressStartPrevented,
    markPressInside,
    startPress,
  };
}

export type DismissLayer = ReturnType<typeof useDismissLayer>;

export function dismissTriggerBindings(layer: DismissLayer) {
  return {
    onKeydown: layer.closeOnEscapeKeyDown,
    onPointerdown: layer.closeOnReferencePress,
    onClick: layer.closeOnReferencePress,
  };
}

export function dismissPopupBindings(layer: DismissLayer) {
  return {
    onKeydown: layer.handleFloatingKeydown,
    onPointerdown: layer.markInsidePressStartPrevented,
    onMousedown: layer.markInsidePressStartPrevented,
    onClickCapture: layer.markPressInside,
    onMousedownCapture: layer.startPress,
    onPointerdownCapture: layer.startPress,
    onMouseupCapture: layer.markInsideComponentTree,
    onTouchendCapture: layer.markPressInside,
    onTouchmoveCapturePassive: layer.markPressInside,
  };
}
