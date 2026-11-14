import {
  inject,
  onActivated,
  onBeforeMount,
  onDeactivated,
  onMounted,
  onScopeDispose,
  provide,
  toValue,
  watch,
} from 'vue';
import type { InjectionKey, MaybeRefOrGetter } from 'vue';
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
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import type { FloatingUIOpenChangeDetails } from '../../../internals/types';
import { createAttribute } from '../createAttribute';
import { isEventTargetWithin, isRootElement } from '../element';
import { isVirtualClick } from '../event';
import { useFloatingTree } from '../tree/FloatingTree';
import type { FloatingTreeStore } from '../tree/FloatingTreeStore';
import { getNodeChildren } from '../tree/nodes';
import type { DismissElementProps, PopupInteractionStore } from '../types';

type PressType = 'intentional' | 'sloppy';
type PressTypes = PressType | { mouse: PressType; touch: PressType };
type Bubbles = boolean | { escapeKey?: boolean | undefined; outsidePress?: boolean | undefined };

interface EscapeLayers {
  version: 1;
  /** The number that the popup that opened last took. */
  count: number;
  /** The highest number of the popups that keep an Escape event for themselves. */
  layers: WeakMap<Event, number>;
}

const ESCAPE_LAYERS_KEY = Symbol.for('vase-ui.escape-layers');

// An open popup takes a number when it opens, and a parent opens before its child. An Escape that
// reaches the document does not go through the `keydown` handler of a popup element, for example
// when the focus is on `body` after a backdrop press. `stopPropagation()` cannot stop the other
// listeners of the document. Thus each open popup that keeps Escape for itself records its number
// for the event in the capture phase. The popup with the highest recorded number handles the
// event, together with each newer popup that lets Escape bubble.
// Two copies of the library on one page share the numbers, so the key is a `Symbol.for` key.
function getEscapeLayers(): EscapeLayers {
  const holder = globalThis as { [ESCAPE_LAYERS_KEY]?: EscapeLayers };
  holder[ESCAPE_LAYERS_KEY] ??= { version: 1, count: 0, layers: new WeakMap() };
  return holder[ESCAPE_LAYERS_KEY];
}

interface DismissParent {
  markInsideComponentTree(): void;
  handleKeydown(event: KeyboardEvent): void;
}

// React gives an event of a portal child to the handlers of the popup around the component.
// A DOM event of content that `Teleport` moved does not reach the popup element. Each
// `useDismiss` call provides the two handlers that need such an event, and the call below it in
// the component tree calls them.
const DismissParentContext: InjectionKey<DismissParent> = Symbol();

function alwaysFalse() {
  return false;
}

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

export interface UseDismissProps {
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

/**
 * Closes the floating element when a dismissal is requested — by default, when
 * the user presses the `escape` key or outside of the floating element.
 *
 * Call it in the `setup` of the root of the popup. A popup below that root then counts as inside
 * the popup, also when `Teleport` moved it. Other content that `Teleport` moved out of the popup
 * is outside it.
 *
 * A press in a same-origin frame below the document of the popup counts as a press on the frame
 * element. A press in a cross-origin frame closes nothing, and neither does a press in a frame in
 * a shadow tree.
 * @see https://floating-ui.com/docs/useDismiss
 */
export function useDismiss(
  store: PopupInteractionStore,
  props: UseDismissProps = {},
): DismissElementProps {
  const {
    enabled: enabledOption,
    escapeKey: escapeKeyOption,
    outsidePress = true,
    outsidePressEvent,
    referencePress = alwaysFalse,
    bubbles,
    externalTree,
  } = props;

  const storeContext = store.context;
  const { events } = storeContext;

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
  // Outlives the runs of `update`, so a pending reset can't leave `compositionEndPending` stuck.
  const compositionTimeout = useTimeout();
  const preventedPressSuppressionTimeout = useTimeout();

  const parent = inject(DismissParentContext, undefined);

  // A closed store that a module shares has a frozen context. The two functions thus write the
  // marker only for an open popup and only when it is set.
  function clearInsideComponentTree() {
    clearInsideComponentTreeTimeout.clear();
    if (storeContext.insideComponentTree) {
      storeContext.insideComponentTree = false;
    }
  }

  function markInsideComponentTree() {
    parent?.markInsideComponentTree();
    if (!isEnabled() || !store.select('open')) {
      return;
    }
    storeContext.insideComponentTree = true;
    clearInsideComponentTreeTimeout.start(0, clearInsideComponentTree);
  }

  function hasBlockingChild(bubbleKey: 'escapeKeyBubbles' | 'outsidePressBubbles') {
    const nodeId = storeContext.positioning?.nodeId;
    const children = tree.value ? getNodeChildren(tree.value.nodesRef.value, nodeId) : [];

    return children.some(
      (child) => child.context?.open && !child.context.rootStore.context[bubbleKey],
    );
  }

  function closeOnReferencePress(event: MouseEvent | PointerEvent) {
    if (!isEnabled() || !referencePress()) {
      return;
    }

    store.setOpen(false, createChangeEventDetails(REASONS.triggerPress, event));
  }

  function closeOnEscapeKeyDown(event: KeyboardEvent) {
    if (!store.select('open') || !isEnabled() || !isEscapeKeyEnabled() || event.key !== 'Escape') {
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

    store.setOpen(false, eventDetails);

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
    markInsideComponentTree,
    handleKeydown(event) {
      if (!isEventTargetWithin(event, store.select('positionerElement'))) {
        handleFloatingKeydown(event);
      }
    },
  });

  function markPressStartedInside(event: PointerEvent | MouseEvent) {
    if (!store.select('open') || !isEnabled() || event.button !== 0) {
      return;
    }

    const target = getTarget(event) as Element | null;

    // Only treat presses that start within the floating DOM subtree as inside.
    // This avoids suppressing parent dismissal when interacting with nested portals.
    if (!contains(store.select('positionerElement'), target)) {
      return;
    }

    if (!pressStartedInside) {
      pressStartedInside = true;
      pressStartPrevented = false;
    }
  }

  function markInsidePressStartPrevented(event: PointerEvent | MouseEvent) {
    if (!store.select('open') || !isEnabled()) {
      return;
    }

    if (!event.defaultPrevented) {
      return;
    }

    if (pressStartedInside) {
      pressStartPrevented = true;
    }
  }

  // This popup's open number for an Escape that reaches the document (see `getEscapeLayers`).
  let layer = 0;
  function takeLayer(open: boolean) {
    if (open) {
      const escapeLayers = getEscapeLayers();
      escapeLayers.count += 1;
      layer = escapeLayers.count;
    }
  }
  // A server does not call `onBeforeMount`, so a server render takes no number. The hook runs for
  // a parent before its children, and `onMounted` runs for the children first.
  onBeforeMount(() => takeLayer(store.select('open')));
  watch(() => store.select('open'), takeLayer);

  // A close and an open in one flush never show `open === false` to a watcher, so only
  // `openchange` can observe that session boundary. `update` covers the other changes.
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
  }

  let deactivated = false;
  let cleanup: (() => void) | undefined;

  function update() {
    cleanup?.();
    cleanup = undefined;

    const open = store.select('open');
    if (deactivated || !open || !isEnabled()) {
      // Reset here, not in the cleanup, which also runs when a source changes mid-gesture.
      if (!open || deactivated) {
        resetSession();
        cancelDismissOnEndTimeout.clear();
        compositionTimeout.clear();
      }
      // The marker is not cleared in the cleanup of the listeners, which can run mid-press when
      // a source changes. In a closed shadow root, the marker is the only inside-press signal.
      cleanup = clearInsideComponentTree;
      return;
    }

    const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = getBubbles();
    storeContext.escapeKeyBubbles = escapeKeyBubbles;
    storeContext.outsidePressBubbles = outsidePressBubbles;

    const doc = ownerDocument(store.select('positionerElement'));

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
        isEventWithin(event, store.select('positionerElement')) ||
        isEventWithin(event, store.select('anchorElement'))
      );
    }

    function isEventWithinFloatingTree(event: Event) {
      const nodeId = storeContext.positioning?.nodeId;
      const targetIsInsideChildren =
        tree.value &&
        getNodeChildren(tree.value.nodesRef.value, nodeId).some((node) =>
          isEventWithin(event, node.context?.elements.floating),
        );

      return isEventWithinOwnElements(event) || targetIsInsideChildren;
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

      if (storeContext.insideComponentTree) {
        clearInsideComponentTree();
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
          : ownerDocument(store.select('positionerElement'))
        ).querySelectorAll(inertSelector),
      );

      const triggers = store.context.triggerElements;

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
        !contains(targetInDocument, store.select('positionerElement')) &&
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

      if (isEventWithinFloatingTree(event)) {
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

      store.setOpen(false, createChangeEventDetails(REASONS.outsidePress, event));
      clearInsideComponentTree();
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        getOutsidePressEvent() !== 'sloppy' ||
        event.pointerType === 'touch' ||
        !store.select('open') ||
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
        !store.select('open') ||
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
      if (contains(store.select('positionerElement'), getFrameOfEvent(event, doc))) {
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

      // If propagation stops before the target, this runs on the next event of the type to reach
      // it instead, which must not be handled as the stopped one.
      const unsubscribe = addEventListener(target, event.type, (currentEvent) => {
        unsubscribe();
        if (currentEvent === event) {
          listener(event);
        }
      });
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

      if (isEventWithinFloatingTree(event)) {
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

    function listenForPress(pressDocument: Document) {
      return mergeCleanups(
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
      );
    }

    // A press in a frame sends no event to the document of the popup, so each frame below it gets
    // the press listeners too. A frame has a new document when it loads, and `load` does not
    // bubble. A capture listener for `load` on each document finds a frame that loads while the
    // popup is open.
    function listenInFrames() {
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
                const { layers } = getEscapeLayers();
                layers.set(event, Math.max(layers.get(event) ?? 0, layer));
              }
            },
            true,
          ),
          addEventListener(doc, 'keydown', (event) => {
            if (layer >= (getEscapeLayers().layers.get(event) ?? 0)) {
              closeOnEscapeKeyDown(event);
            }
          }),
          addEventListener(doc, 'compositionend', handleCompositionEnd),
        ),
      outsidePressEnabled && mergeCleanups(listenForPress(doc), listenInFrames()),
    );

    cleanup = () => {
      unsubscribe();
      preventedPressSuppressionTimeout.clear();
      resetPressStartState();
      suppressNextOutsideClick = false;
    };
  }

  watch(
    [
      () => store.select('open'),
      isEnabled,
      () => ownerDocument(store.select('positionerElement')),
      isEscapeKeyEnabled,
      () => getBubbles().escapeKey,
      () => getBubbles().outsidePress,
      tree,
    ],
    update,
    { flush: 'post' },
  );

  // A server calls no `onMounted` hook and runs no such `watch`, so a server render adds no
  // listener to a document or to a store that a module shares.
  onMounted(() => {
    events.on('openchange', handleOpenChange);
    update();
  });
  onDeactivated(() => {
    deactivated = true;
    update();
  });
  // `onActivated` also runs at the first mount in a `KeepAlive`.
  onActivated(() => {
    if (deactivated) {
      deactivated = false;
      update();
    }
  });
  onScopeDispose(() => {
    events.off('openchange', handleOpenChange);
    cleanup?.();
    clearInsideComponentTree();
  });

  const reference: DismissElementProps['reference'] = {
    onKeydown: closeOnEscapeKeyDown,
    onPointerdown: closeOnReferencePress,
    onClick: closeOnReferencePress,
  };

  const floating: DismissElementProps['floating'] = {
    onKeydown: handleFloatingKeydown,
    // `onMousedown` may be blocked if `event.preventDefault()` is called in
    // `onPointerdown`, such as with <NumberField.ScrubArea>.
    // See https://github.com/mui/base-ui/pull/3379
    onPointerdown: markInsidePressStartPrevented,
    onMousedown: markInsidePressStartPrevented,
    onClickCapture: markInsideComponentTree,
    onMousedownCapture(event: MouseEvent) {
      markInsideComponentTree();
      markPressStartedInside(event);
    },
    onPointerdownCapture(event: PointerEvent) {
      markInsideComponentTree();
      markPressStartedInside(event);
    },
    onMouseupCapture: markInsideComponentTree,
    onTouchendCapture: markInsideComponentTree,
    // React adds each `touchmove` listener as a passive listener. A listener of an element that
    // is not passive makes the browser wait for it before each scroll step.
    onTouchmoveCapturePassive: markInsideComponentTree,
  };

  return { reference, floating, trigger: reference };
}
