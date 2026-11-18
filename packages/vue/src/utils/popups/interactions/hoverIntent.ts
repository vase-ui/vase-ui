import { addEventListener } from '../../../common/addEventListener';
import { ownerDocument } from '../../../common/owner';
import { Timeout } from '../../../common/useTimeout';
import { closest, contains, getTarget } from '../../../common/shadowDom';
import { isElement } from '@floating-ui/utils/dom';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import type {
  Delay,
  PopupInteractionStore,
  PopupInteractionContext,
  FloatingTreeType,
} from '../types';
import { isInteractiveElement } from '../element';
import { isMouseLikePointerType } from '../event';
import { hasHoverBinding, setHoverPointerEvents } from './hoverPointerEvents';
import { getNodeChildren } from '../tree/nodes';
import type { HandleClose, HandleCloseContextBase, HandleCloseOptions } from './useHoverShared';
import {
  getDelay,
  getRestMs,
  isClickLikeOpenEvent,
  isHoverOpenEvent,
  isInsideEnabledTrigger,
} from './useHoverShared';

type Latest<T> = () => T;

/**
 * Options of one trigger. Several triggers can share a popup, so each trigger passes its own
 * options with every call. Values behind `Latest` are read when they are needed, so a timer or
 * the safe polygon that runs later sees the trigger's latest props.
 */
export interface HoverIntentTriggerOptions {
  delay: Latest<Delay>;
  restMs: Latest<number>;
  handleClose: Latest<HandleClose | null>;
  enabled: Latest<boolean>;
  /**
   * Whether the last close was caused by hovering out of a trigger.
   */
  isHoverCloseActive: Latest<boolean>;
  triggerElement: Latest<Element | null>;
  mouseOnly: Latest<boolean>;
  tree: Latest<FloatingTreeType | null>;
  shouldOpen: () => boolean;
  getHandleCloseContext?: (() => HandleCloseContextBase | null) | undefined;
}

type PointerEventsScopeElement = HTMLElement | SVGSVGElement;

type HoverTriggerElement = HTMLElement | SVGSVGElement;

export interface OutsidePointerEventsElements {
  /**
   * The element whose pointer events are blocked.
   */
  scopeElement: PointerEventsScopeElement;
  triggerElement: HTMLElement | SVGSVGElement;
  positionerElement: HTMLElement;
}

// Only one popup at a time can block pointer events within a scope element.
const pointerEventsOwnerByScopeElement = new WeakMap<PointerEventsScopeElement, HoverIntent>();

/**
 * Decides when hovering opens and closes one popup: the open and close delays, rest detection,
 * the safe polygon between the trigger and the popup, and blocking pointer events outside them.
 *
 * Every popup with hover interactions has one, shared by all its triggers and its popup.
 * Get it with `getHoverIntent()`.
 */
export class HoverIntent {
  /**
   * The pointer type of the latest trigger interaction.
   */
  pointerType: string | undefined = undefined;

  #interactedInside = false;

  #safePolygonHandler: ((event: MouseEvent) => void) | undefined = undefined;

  #removeSafePolygonListener: (() => void) | undefined = undefined;

  #blockMouseMove = true;

  #blockedPointerEvents: OutsidePointerEventsElements | null = null;

  readonly #hoverTriggers = new Set<HoverTriggerElement>();

  #foreignScopeStyle: { value: string; priority: string } | null = null;

  #parentFloating: HTMLElement | null = null;

  #restTimeoutPending = false;

  readonly #openChangeTimeout = new Timeout();

  readonly #restTimeout = new Timeout();

  /**
   * The safe polygon options of the active trigger.
   */
  handleCloseOptions: HandleCloseOptions | undefined = undefined;

  readonly #store: PopupInteractionStore;

  constructor(store: PopupInteractionStore) {
    this.#store = store;
    // A close request while the popup is already closed isn't an open change, but it still
    // cancels a pending open. The emitter lives as long as this intent, so it needs no cleanup.
    store.context.events.on('droppedclose', () => this.cancel());
  }

  #isClickLikeOpen() {
    return isClickLikeOpenEvent(this.#store.context.openEvent?.type, this.#interactedInside);
  }

  /**
   * Cancels a pending hover open: the open delay and rest detection.
   */
  cancelPendingOpen() {
    this.#openChangeTimeout.clear();
    this.#restTimeout.clear();
    this.#restTimeoutPending = false;
  }

  /**
   * Stops what the triggers have in flight when the popup closes: the safe polygon, both timers
   * and rest detection. Mouse movement can't open the popup until a trigger is entered again.
   */
  cancel() {
    this.stopSafePolygon();
    this.cancelPendingOpen();
    this.#blockMouseMove = true;
  }

  /**
   * Forgets the interaction once the popup has closed.
   */
  reset() {
    this.pointerType = undefined;
    this.#restTimeoutPending = false;
    this.#interactedInside = false;
    this.restoreOutsidePointerEvents();
  }

  /**
   * Removes the safe polygon's `mousemove` listener.
   */
  stopSafePolygon = () => {
    this.#removeSafePolygonListener?.();
    this.#removeSafePolygonListener = undefined;
    this.#safePolygonHandler = undefined;
  };

  /**
   * Blocks pointer events within `scopeElement`, except on the trigger and positioner elements,
   * so the pointer can travel to the popup without hovering anything else.
   * The hover triggers of the popup also keep their pointer events.
   * Takes over the scope element from another popup that blocks it.
   */
  blockOutsidePointerEvents(elements: OutsidePointerEventsElements) {
    const { scopeElement, triggerElement, positionerElement } = elements;

    const existingOwner = pointerEventsOwnerByScopeElement.get(scopeElement);
    if (existingOwner && existingOwner !== this) {
      existingOwner.restoreOutsidePointerEvents();
    }

    this.restoreOutsidePointerEvents();
    this.#blockedPointerEvents = elements;
    pointerEventsOwnerByScopeElement.set(scopeElement, this);

    if (hasHoverBinding(scopeElement)) {
      setHoverPointerEvents(scopeElement, this, 'none');
    } else {
      // The document body or an external scope has no part to bind its style.
      this.#foreignScopeStyle = {
        value: scopeElement.style.getPropertyValue('pointer-events'),
        priority: scopeElement.style.getPropertyPriority('pointer-events'),
      };
      scopeElement.style.setProperty('pointer-events', 'none');
    }
    setHoverPointerEvents(triggerElement, this, 'auto');
    setHoverPointerEvents(positionerElement, this, 'auto');
    for (const trigger of this.#hoverTriggers) {
      setHoverPointerEvents(trigger, this, 'auto');
    }
  }

  /**
   * Adds a trigger that opens the popup on hover. While the popup blocks pointer events, the
   * trigger keeps them. The pointer can then move from the active trigger to it, and the popup
   * moves to it with no close.
   */
  addHoverTrigger(element: HoverTriggerElement) {
    this.#hoverTriggers.add(element);
    // A popup that blocks the same scope element first restores the block of this popup.
    if (this.#blockedPointerEvents) {
      setHoverPointerEvents(element, this, 'auto');
    }
  }

  /**
   * Removes a trigger that `addHoverTrigger()` added. When the trigger got its pointer events from
   * the block, it loses them at once.
   */
  removeHoverTrigger(element: HoverTriggerElement) {
    this.#hoverTriggers.delete(element);
    if (this.#blockedPointerEvents && this.#blockedPointerEvents.triggerElement !== element) {
      setHoverPointerEvents(element, this);
    }
  }

  // A leave can name an element inside a hover trigger, such as its icon. In the wrapper
  // (delegated) mode, the hover trigger is a wrapper that contains the triggers.
  #isInsideHoverTrigger(target: EventTarget | null) {
    if (!isInsideEnabledTrigger(target, this.#store.context.triggerElements)) {
      return false;
    }
    for (const hoverTrigger of this.#hoverTriggers) {
      if (contains(hoverTrigger, target as Element)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Undoes `blockOutsidePointerEvents()`, unless another popup has taken over the scope element.
   */
  restoreOutsidePointerEvents = () => {
    const blocked = this.#blockedPointerEvents;
    if (!blocked) {
      return;
    }

    const { scopeElement, triggerElement, positionerElement } = blocked;

    if (pointerEventsOwnerByScopeElement.get(scopeElement) === this) {
      if (this.#foreignScopeStyle) {
        const { value, priority } = this.#foreignScopeStyle;
        scopeElement.style.setProperty('pointer-events', value, priority);
        this.#foreignScopeStyle = null;
      } else {
        setHoverPointerEvents(scopeElement, this);
      }
      setHoverPointerEvents(triggerElement, this);
      setHoverPointerEvents(positionerElement, this);
      for (const trigger of this.#hoverTriggers) {
        setHoverPointerEvents(trigger, this);
      }
      if (this.#parentFloating) {
        setHoverPointerEvents(this.#parentFloating, this);
        this.#parentFloating = null;
      }
      pointerEventsOwnerByScopeElement.delete(scopeElement);
    }

    this.#blockedPointerEvents = null;
  };

  onTriggerMouseEnter(event: MouseEvent, options: HoverIntentTriggerOptions) {
    const store = this.#store;

    this.#openChangeTimeout.clear();
    this.#blockMouseMove = false;

    if (options.mouseOnly() && !isMouseLikePointerType(this.pointerType)) {
      return;
    }

    // Only rest delay is set; there's no fallback delay.
    // This will be handled by `onTriggerMouseMove`.
    const restMsValue = getRestMs(options.restMs);
    const openDelay = getDelay(options.delay, 'open', this.pointerType);
    const eventTarget = getTarget(event);
    const currentTarget = (event.currentTarget as HTMLElement) ?? null;
    const currentDomReference = store.select('anchorElement');
    let triggerNode = currentTarget;

    // Wrapper/delegated mode: resolve the actual trigger from the event target.
    if (isElement(eventTarget) && !store.context.triggerElements.hasElement(eventTarget)) {
      // An inner trigger can register after its outer trigger. The first trigger of the map that
      // contains the target is then the outer one. The innermost trigger decides.
      let innermostTrigger: Element | undefined;
      for (const triggerElement of store.context.triggerElements.elements()) {
        if (
          contains(triggerElement, eventTarget) &&
          (!innermostTrigger || contains(innermostTrigger, triggerElement))
        ) {
          innermostTrigger = triggerElement;
        }
      }
      if (innermostTrigger) {
        triggerNode = innermostTrigger as HTMLElement;
      }
    }

    // Wrapper/delegated mode fallback: if the wrapper contains the active trigger,
    // treat this as re-entering that active trigger.
    if (
      isElement(currentTarget) &&
      isElement(currentDomReference) &&
      !store.context.triggerElements.hasElement(currentTarget) &&
      contains(currentTarget, currentDomReference)
    ) {
      triggerNode = currentDomReference as HTMLElement;
    }

    const isOverInactive =
      triggerNode == null
        ? false
        : this.#isOverInactiveTrigger(currentDomReference, triggerNode, eventTarget);
    const isOpen = store.select('open');
    const isInClosingTransition = store.select('transitionStatus') === 'ending';
    const isHoverCloseTransition = !isOpen && isInClosingTransition && options.isHoverCloseActive();
    const isReenteringSameTriggerDuringCloseTransition =
      !isOverInactive &&
      isElement(triggerNode) &&
      isElement(currentDomReference) &&
      contains(currentDomReference, triggerNode) &&
      isHoverCloseTransition;
    const isRestOnlyDelay = restMsValue > 0 && !openDelay;
    const shouldOpenImmediately =
      (isOverInactive && (isOpen || isHoverCloseTransition)) ||
      isReenteringSameTriggerDuringCloseTransition;

    const shouldOpen = !isOpen || isOverInactive;
    const open = () => {
      if (options.shouldOpen()) {
        store.setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, triggerNode));
      }
    };

    // Open immediately when moving between triggers while open, or during
    // a hover-driven close transition (including same-trigger re-entry).
    if (shouldOpenImmediately) {
      open();
      return;
    }

    if (isRestOnlyDelay || !shouldOpen) {
      return;
    }

    if (openDelay) {
      this.#openChangeTimeout.start(openDelay, open);
    } else {
      open();
    }
  }

  onTriggerMouseLeave(event: MouseEvent, options: HoverIntentTriggerOptions) {
    const store = this.#store;

    if (this.#isClickLikeOpen()) {
      this.restoreOutsidePointerEvents();
      return;
    }

    this.stopSafePolygon();

    const anchorElement = store.select('anchorElement');
    const doc = ownerDocument(anchorElement);
    this.#restTimeout.clear();
    this.#restTimeoutPending = false;

    const handleCloseContextBase =
      this.#store.context.positioning ?? options.getHandleCloseContext?.();

    // A hover trigger takes the popup at its `mouseenter`. Another trigger takes nothing, so a leave
    // to it closes the popup as a leave to any element does.
    if (this.#isInsideHoverTrigger(event.relatedTarget)) {
      return;
    }

    const handleClose = options.handleClose();

    if (handleClose && handleCloseContextBase) {
      if (!store.select('open')) {
        this.#openChangeTimeout.clear();
      }

      const currentTrigger = options.triggerElement();

      this.#safePolygonHandler = handleClose({
        ...handleCloseContextBase,
        placement: handleCloseContextBase.placement ?? null,
        tree: options.tree(),
        x: event.clientX,
        y: event.clientY,
        onClose: () => {
          this.restoreOutsidePointerEvents();
          this.stopSafePolygon();
          if (
            options.enabled() &&
            !this.#isClickLikeOpen() &&
            currentTrigger === store.select('anchorElement')
          ) {
            this.#closeWithDelay(event, options.delay, options.tree());
          }
        },
      });

      this.#removeSafePolygonListener = addEventListener(
        doc,
        'mousemove',
        this.#safePolygonHandler,
      );
      this.#safePolygonHandler(event);

      return;
    }

    const shouldClose =
      this.pointerType === 'touch'
        ? !contains(store.select('positionerElement'), event.relatedTarget as Element | null)
        : true;

    if (shouldClose) {
      this.#closeWithDelay(event, options.delay, options.tree());
    }
  }

  onTriggerMouseMove(
    event: MouseEvent,
    options: Pick<HoverIntentTriggerOptions, 'restMs' | 'mouseOnly' | 'shouldOpen'>,
  ) {
    const store = this.#store;
    const trigger = event.currentTarget as HTMLElement;

    const currentDomReference = store.select('anchorElement');
    const currentOpen = store.select('open');
    const isOverInactive = this.#isOverInactiveTrigger(currentDomReference, trigger, event.target);

    if (options.mouseOnly() && !isMouseLikePointerType(this.pointerType)) {
      return;
    }

    if (currentOpen && isOverInactive && this.handleCloseOptions?.blockPointerEvents) {
      const positionerElement = store.select('positionerElement');

      if (positionerElement) {
        const scopeElement = this.handleCloseOptions?.getScope?.() ?? trigger.ownerDocument.body;

        this.blockOutsidePointerEvents({
          scopeElement,
          triggerElement: trigger,
          positionerElement,
        });
      }
    }

    const restMsValue = getRestMs(options.restMs);
    if ((currentOpen && !isOverInactive) || restMsValue === 0) {
      return;
    }

    if (
      !isOverInactive &&
      this.#restTimeoutPending &&
      event.movementX ** 2 + event.movementY ** 2 < 2
    ) {
      return;
    }

    this.#restTimeout.clear();

    const handleMouseMove = () => {
      this.#restTimeoutPending = false;

      // A delayed hover open should not override a click-like open that happened
      // while the hover delay was pending.
      if (this.#isClickLikeOpen()) {
        return;
      }

      const latestOpen = store.select('open');

      if (!this.#blockMouseMove && (!latestOpen || isOverInactive) && options.shouldOpen()) {
        store.setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, trigger));
      }
    };

    if (this.pointerType === 'touch') {
      handleMouseMove();
    } else if (isOverInactive && currentOpen) {
      handleMouseMove();
    } else {
      this.#restTimeoutPending = true;
      this.#restTimeout.start(restMsValue, handleMouseMove);
    }
  }

  /**
   * Blocks pointer events outside the popup and its trigger while a hover-opened popup is open,
   * if the active trigger's safe polygon asks for it.
   * Returns whether pointer events were blocked.
   */
  blockOutsidePointerEventsForPopup(
    triggerElement: HTMLElement | SVGSVGElement,
    positionerElement: HTMLElement,
    tree: FloatingTreeType | null,
    parentId: string | null,
  ): boolean {
    if (
      !this.handleCloseOptions?.blockPointerEvents ||
      !isHoverOpenEvent(this.#store.context.openEvent?.type)
    ) {
      return false;
    }

    const doc = ownerDocument(positionerElement);

    const parentFloating = tree?.nodesRef.value.find((node) => node.id === parentId)?.context
      ?.elements.floating as HTMLElement | null;

    // A keep-mounted submenu can appear in the tree before it opens, so a
    // cached scope or parent lookup may resolve to the submenu itself. That
    // would not shield sibling items in the parent menu.
    const previousScopeElement = this.#blockedPointerEvents?.scopeElement ?? null;
    const cachedScopeElement =
      previousScopeElement !== positionerElement ? previousScopeElement : null;
    const parentScopeElement = parentFloating !== positionerElement ? parentFloating : null;
    const scopeElement =
      this.handleCloseOptions?.getScope?.() ??
      cachedScopeElement ??
      parentScopeElement ??
      closest<PointerEventsScopeElement>(triggerElement, '[data-rootownerid]') ??
      doc.body;

    this.blockOutsidePointerEvents({ scopeElement, triggerElement, positionerElement });
    if (parentFloating && parentFloating !== scopeElement && parentFloating !== positionerElement) {
      this.#parentFloating = parentFloating;
      setHoverPointerEvents(parentFloating, this, 'inherit');
    }

    return true;
  }

  onPopupMouseEnter() {
    this.#openChangeTimeout.clear();
    this.restoreOutsidePointerEvents();
  }

  onPopupMouseLeave(
    event: MouseEvent,
    options: {
      closeDelay: number | (() => number);
      tree: FloatingTreeType | null;
      nodeId: string | undefined;
    },
  ) {
    const store = this.#store;
    const { tree } = options;

    if (isInsideEnabledTrigger(event.relatedTarget, store.context.triggerElements)) {
      // If the mouse is leaving the popup for another trigger, don't explicitly close the popup
      // as it will be moved.
      return;
    }

    const currentNodeId = this.#store.context.positioning?.nodeId ?? options.nodeId;
    const relatedTarget = event.relatedTarget;
    const isMovingIntoDescendantFloating =
      tree &&
      currentNodeId &&
      isElement(relatedTarget) &&
      getNodeChildren(tree.nodesRef.value, currentNodeId, false).some((node) =>
        contains(node.context?.elements.floating, relatedTarget),
      );

    if (isMovingIntoDescendantFloating) {
      return;
    }

    // If the safePolygon handler is active, let it handle the close logic.
    if (this.#safePolygonHandler) {
      this.#safePolygonHandler(event);
      return;
    }

    this.restoreOutsidePointerEvents();
    if (isHoverOpenEvent(this.#store.context.openEvent?.type) && !this.#isClickLikeOpen()) {
      this.#closeWithDelay(event, options.closeDelay, tree);
    }
  }

  onPopupPointerDown(event: PointerEvent) {
    const target = getTarget(event) as Element | null;
    if (!isInteractiveElement(target)) {
      this.#interactedInside = false;
      return;
    }

    this.#interactedInside = closest(target, '[aria-haspopup]') != null;
  }

  #closeWithDelay(
    event: MouseEvent,
    delay: Delay | (() => Delay) | undefined,
    tree: FloatingTreeType | null,
  ) {
    const close = () => {
      this.#store.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
      tree?.events.emit('floating.closed', event);
    };

    const closeDelay = getDelay(delay, 'close', this.pointerType);
    if (closeDelay) {
      this.#openChangeTimeout.start(closeDelay, close);
    } else {
      this.#openChangeTimeout.clear();
      close();
    }
  }

  #isOverInactiveTrigger(
    currentDomReference: Element | null,
    currentTarget: Element,
    target: EventTarget | null,
  ): boolean {
    const allTriggers = this.#store.context.triggerElements;

    // Fast path for normal usage where handlers are attached directly to triggers.
    if (allTriggers.hasElement(currentTarget)) {
      return !currentDomReference || !contains(currentDomReference, currentTarget);
    }

    // Fallback for delegated/wrapper usage where currentTarget may be outside the trigger map.
    if (!isElement(target)) {
      return false;
    }

    const targetElement = target;
    return (
      allTriggers.hasMatchingElement((trigger) => contains(trigger, targetElement)) &&
      (!currentDomReference || !contains(currentDomReference, targetElement))
    );
  }
}

const hoverIntents = new WeakMap<PopupInteractionContext, HoverIntent>();

/**
 * Returns the popup's `HoverIntent`, creating it on first use.
 */
export function getHoverIntent(store: PopupInteractionStore): HoverIntent {
  let intent = hoverIntents.get(store.context);
  if (!intent) {
    intent = new HoverIntent(store);
    hoverIntents.set(store.context, intent);
  }
  return intent;
}
