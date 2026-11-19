import { computed, shallowReactive, toValue, watch, onMounted } from 'vue';
import type { MaybeRefOrGetter, ComputedRef } from 'vue';
import type { Placement, Side, Rect } from '@floating-ui/vue';
import { isMouseLikePointerType } from '../event';
import type {
  ExtendedElements,
  FloatingTreeType,
  Delay,
  PopupInteractionStore,
  PopupInteractionContext,
} from '../types';
import {
  isTargetInsideEnabledTrigger as isInsideEnabledTrigger,
  isInteractiveElement,
} from '../element';
import { bindPositionerHandlers, menuPopups } from '../registeredParts';
import { addEventListener } from '../../../common/addEventListener';
import { ownerDocument } from '../../../common/owner';
import { Timeout, useTimeout } from '../../../common/useTimeout';
import { closest, contains, getTarget } from '../../../common/shadowDom';
import { isElement } from '@floating-ui/utils/dom';
import { createChangeEventDetails } from '../../../internals/createVaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { getNodeChildren } from '../tree/nodes';
import type { FloatingUIOpenChangeDetails, HTMLProps } from '../../../internals/types';
import { useKeepAliveState } from '../../../internals/useKeepAliveState';
import { useFloatingTree, useFloatingParentNodeId } from '../tree/FloatingTree';
import { useDomEffect } from '../useDomEffect';
import type { FloatingTreeStore } from '../tree/FloatingTreeStore';
import { mergeCleanups } from '../../../common/mergeCleanups';
import { safePolygon } from './safePolygon';

type PointerEvents = 'auto' | 'none' | 'inherit';
const overrides = shallowReactive(new WeakMap<Element, Map<PopupHoverSession, PointerEvents>>());
const owners = new WeakMap<Element, number>();

function setHoverPointerEvents(element: Element, intent: PopupHoverSession, value?: PointerEvents) {
  const requests = new Map(overrides.get(element));
  requests.delete(intent);
  if (value !== undefined) {
    requests.set(intent, value);
  }
  if (requests.size) {
    overrides.set(element, requests);
  } else {
    overrides.delete(element);
  }
}

export function hoverPointerStyle(element: Element | null | undefined) {
  const requests = element && overrides.get(element);
  if (!requests) {
    return undefined;
  }
  // A child popup can borrow a parent's positioner as its scope.
  return { pointerEvents: Array.from(requests.values()).at(-1) };
}

export function useHoverPointerStyle(source: MaybeRefOrGetter<Element | null | undefined>) {
  watch(
    () => toValue(source),
    (element, _, onCleanup) => {
      if (element) {
        owners.set(element, (owners.get(element) ?? 0) + 1);
        onCleanup(() => {
          const count = owners.get(element) ?? 0;
          if (count > 1) {
            owners.set(element, count - 1);
          } else {
            owners.delete(element);
          }
        });
      }
    },
    { immediate: true, flush: 'sync' },
  );
  return computed(() => hoverPointerStyle(toValue(source)));
}

export interface HoverScope {
  blockPointerEvents?: boolean | undefined;
  getScope?: (() => HTMLElement | SVGSVGElement | null) | undefined;
}

export interface HandleCloseContext {
  x: number | null;
  y: number | null;
  placement: Placement | null;
  elements: Pick<ExtendedElements, 'domReference' | 'floating'>;
  onClose: () => void;
  nodeId?: string | undefined;
  tree?: FloatingTreeType | null | undefined;
}

export type HandleCloseContextBase = Omit<HandleCloseContext, 'onClose' | 'tree' | 'x' | 'y'>;

export function getDelay(
  value: MaybeRefOrGetter<Delay> | undefined,
  prop: 'open' | 'close',
  pointerType?: PointerEvent['pointerType'],
) {
  if (pointerType != null && !isMouseLikePointerType(pointerType)) {
    return 0;
  }
  const result = toValue(value);
  if (typeof result === 'number') {
    return result;
  }

  return result?.[prop];
}

export function isClickLikeOpenEvent(openEventType: string | undefined, interactedInside: boolean) {
  return interactedInside || openEventType === 'click' || openEventType === 'mousedown';
}

export function isHoverOpenEvent(openEventType: string | undefined) {
  return openEventType?.includes('mouse') && openEventType !== 'mousedown';
}

export function resolvePolygonOptions(value: boolean | HoverScope | undefined) {
  if (!value) {
    return undefined;
  }
  return value === true ? { blockPointerEvents: false } : value;
}

interface HoverTriggerPolicy {
  delay: () => Delay;
  restMs: () => number;
  polygon: () => HoverScope | undefined;
  enabled: () => boolean;
  triggerElement: () => Element | null;
  mouseOnly: () => boolean;
  tree: () => FloatingTreeType | null;
  shouldOpen: () => boolean;
  getHandleCloseContext?: (() => HandleCloseContextBase | null) | undefined;
}

type PointerEventsScopeElement = HTMLElement | SVGSVGElement;

type HoverTriggerElement = HTMLElement | SVGSVGElement;

export interface OutsidePointerEventsElements {
  scopeElement: PointerEventsScopeElement;
  triggerElement: HTMLElement | SVGSVGElement;
  positionerElement: HTMLElement;
}

// Only one popup at a time can block pointer events within a scope element.
const pointerEventsOwnerByScopeElement = new WeakMap<
  PointerEventsScopeElement,
  PopupHoverSession
>();

export class PopupHoverSession {
  pointerType: string | undefined = undefined;

  #interactedInside = false;

  #safePolygonHandler: ((event: MouseEvent) => void) | undefined = undefined;

  #removeSafePolygonListener: (() => void) | undefined = undefined;

  #blockMouseMove = true;

  #blockedPointerEvents: OutsidePointerEventsElements | null = null;

  readonly #hoverTriggers = new Set<HoverTriggerElement>();

  #nativeScopeStyle: { value: string; priority: string } | null = null;

  #parentFloating: HTMLElement | null = null;

  #hoverCloseActive = false;
  #listeners = 0;
  #timerOwner: HoverTriggerPolicy | undefined;
  #polygonOwner: HoverTriggerPolicy | undefined;
  readonly #polygonTimeout = new Timeout();
  readonly #openChangeTimeout = new Timeout();

  readonly #restTimeout = new Timeout();

  handleCloseOptions: HoverScope | undefined = undefined;

  readonly #store: PopupInteractionStore;

  constructor(store: PopupInteractionStore) {
    this.#store = store;
    // A close request while the popup is already closed isn't an open change, but it still
    // cancels a pending open. The emitter lives as long as this intent, so it needs no cleanup.
    store.context.events.on('droppedclose', () => this.cancel());
  }

  #onOpenChange = (details: FloatingUIOpenChangeDetails) => {
    this.#hoverCloseActive = !details.open && details.reason === REASONS.triggerHover;
    if (!details.open) {
      this.cancel();
    }
  };

  attachTrigger(policy: HoverTriggerPolicy) {
    if (this.#listeners++ === 0) {
      this.#store.context.events.on('openchange', this.#onOpenChange);
    }
    return () => {
      if (--this.#listeners === 0) {
        this.#store.context.events.off('openchange', this.#onOpenChange);
      }
      if (this.#timerOwner === policy) {
        this.cancelPendingOpen();
      }
      if (this.#polygonOwner === policy) {
        this.stopSafePolygon();
      }
    };
  }

  #isClickLikeOpen() {
    return isClickLikeOpenEvent(this.#store.context.openEvent?.type, this.#interactedInside);
  }

  cancelPendingOpen() {
    this.#timerOwner = undefined;
    this.#openChangeTimeout.clear();
    this.#restTimeout.clear();
  }

  cancel() {
    this.stopSafePolygon();
    this.cancelPendingOpen();
    this.#blockMouseMove = true;
  }

  reset() {
    this.pointerType = undefined;
    this.#interactedInside = false;
    this.restoreOutsidePointerEvents();
  }

  stopSafePolygon = () => {
    this.#polygonOwner = undefined;
    this.#polygonTimeout.clear();
    this.#removeSafePolygonListener?.();
    this.#removeSafePolygonListener = undefined;
    this.#safePolygonHandler = undefined;
  };

  blockOutsidePointerEvents(elements: OutsidePointerEventsElements) {
    const { scopeElement, triggerElement, positionerElement } = elements;

    const existingOwner = pointerEventsOwnerByScopeElement.get(scopeElement);
    if (existingOwner && existingOwner !== this) {
      existingOwner.restoreOutsidePointerEvents();
    }

    this.restoreOutsidePointerEvents();
    this.#blockedPointerEvents = elements;
    pointerEventsOwnerByScopeElement.set(scopeElement, this);

    if (owners.has(scopeElement)) {
      setHoverPointerEvents(scopeElement, this, 'none');
    } else if (!menuPopups.has(scopeElement) || !scopeElement.style.pointerEvents) {
      // A submenu must release its parent scope between mouseleave and pointerenter in one input.
      this.#nativeScopeStyle = {
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

  addHoverTrigger(element: HoverTriggerElement) {
    this.#hoverTriggers.add(element);
    // A popup that blocks the same scope element first restores the block of this popup.
    if (this.#blockedPointerEvents) {
      setHoverPointerEvents(element, this, 'auto');
    }
  }

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

  restoreOutsidePointerEvents = () => {
    const blocked = this.#blockedPointerEvents;
    if (!blocked) {
      return;
    }

    const { scopeElement, triggerElement, positionerElement } = blocked;

    if (pointerEventsOwnerByScopeElement.get(scopeElement) === this) {
      if (this.#nativeScopeStyle) {
        const { value, priority } = this.#nativeScopeStyle;
        const { style } = scopeElement;
        if (style.pointerEvents === 'none' && !style.getPropertyPriority('pointer-events')) {
          style.setProperty('pointer-events', value, priority);
        }
        this.#nativeScopeStyle = null;
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

  enterTrigger(event: MouseEvent, options: HoverTriggerPolicy) {
    const store = this.#store;

    if (this.#timerOwner !== options) {
      this.cancelPendingOpen();
    } else {
      this.#openChangeTimeout.clear();
    }
    if (this.#polygonOwner && this.#polygonOwner !== options) {
      this.stopSafePolygon();
    }
    this.#blockMouseMove = false;

    if (options.mouseOnly() && !isMouseLikePointerType(this.pointerType)) {
      return;
    }

    // Only rest delay is set; there's no fallback delay.
    // This will be handled by `moveTrigger`.
    const restMsValue = options.restMs();
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
    const isHoverCloseTransition = !isOpen && isInClosingTransition && this.#hoverCloseActive;
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
      this.#timerOwner = options;
      this.#openChangeTimeout.start(openDelay, open);
    } else {
      open();
    }
  }

  leaveTrigger(event: MouseEvent, options: HoverTriggerPolicy) {
    const store = this.#store;

    if (this.#isClickLikeOpen()) {
      this.restoreOutsidePointerEvents();
      return;
    }

    this.stopSafePolygon();

    const anchorElement = store.select('anchorElement');
    const doc = ownerDocument(anchorElement);
    this.#restTimeout.clear();

    const handleCloseContextBase =
      this.#store.context.positioning ?? options.getHandleCloseContext?.();

    // A hover trigger takes the popup at its `mouseenter`. Another trigger takes nothing, so a leave
    // to it closes the popup as a leave to any element does.
    if (this.#isInsideHoverTrigger(event.relatedTarget)) {
      return;
    }

    const polygon = options.polygon();

    if (polygon && handleCloseContextBase) {
      if (!store.select('open')) {
        this.#openChangeTimeout.clear();
      }

      const currentTrigger = options.triggerElement();

      this.#polygonOwner = options;
      this.#safePolygonHandler = trackHoverPolygon(
        {
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
              this.#closeWithDelay(event, options.delay, options.tree(), options);
            }
          },
        },
        this.#polygonTimeout,
      );

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
      this.#closeWithDelay(event, options.delay, options.tree(), options);
    }
  }

  moveTrigger(event: MouseEvent, options: HoverTriggerPolicy) {
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

    const restMsValue = options.restMs();
    if ((currentOpen && !isOverInactive) || restMsValue === 0) {
      return;
    }

    if (
      !isOverInactive &&
      this.#restTimeout.isStarted() &&
      event.movementX ** 2 + event.movementY ** 2 < 2
    ) {
      return;
    }

    this.#restTimeout.clear();

    const handleMouseMove = () => {
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
      this.#timerOwner = options;
      this.#restTimeout.start(restMsValue, handleMouseMove);
    }
  }

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
      closest<HTMLElement>(
        triggerElement,
        (element) => element.isConnected && menuPopups.has(element),
      ) ??
      cachedScopeElement ??
      parentScopeElement ??
      doc.body;

    this.blockOutsidePointerEvents({ scopeElement, triggerElement, positionerElement });
    if (parentFloating && parentFloating !== scopeElement && parentFloating !== positionerElement) {
      this.#parentFloating = parentFloating;
      setHoverPointerEvents(parentFloating, this, 'inherit');
    }

    return true;
  }

  enterPopup() {
    this.#polygonTimeout.clear();
    this.#openChangeTimeout.clear();
    this.restoreOutsidePointerEvents();
  }

  leavePopup(
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

  onPopupPointerDown = (event: PointerEvent) => {
    const target = getTarget(event) as Element | null;
    if (!isInteractiveElement(target)) {
      this.#interactedInside = false;
      return;
    }

    this.#interactedInside = closest(target, '[aria-haspopup]') != null;
  };

  #closeWithDelay(
    event: MouseEvent,
    delay: Delay | (() => Delay) | undefined,
    tree: FloatingTreeType | null,
    trigger?: HoverTriggerPolicy,
  ) {
    const close = () => {
      this.#store.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
      tree?.events.emit('floating.closed', event);
    };

    const closeDelay = getDelay(delay, 'close', this.pointerType);
    if (closeDelay) {
      this.#timerOwner = trigger;
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

const sessions = new WeakMap<PopupInteractionContext, PopupHoverSession>();

export function getPopupHoverSession(store: PopupInteractionStore): PopupHoverSession {
  let intent = sessions.get(store.context);
  if (!intent) {
    intent = new PopupHoverSession(store);
    sessions.set(store.context, intent);
  }
  return intent;
}

export interface HoverTriggerOptions {
  enabled?: MaybeRefOrGetter<boolean | undefined>;
  safePolygon?: MaybeRefOrGetter<boolean | HoverScope | undefined>;
  restMs?: MaybeRefOrGetter<number | undefined>;
  delay?: MaybeRefOrGetter<Delay | undefined>;
  /**
   * Whether the first `mousemove` that comes with no `mouseenter` counts as an enter.
   * @default true
   */
  move?: MaybeRefOrGetter<boolean | undefined>;
  mouseOnly?: MaybeRefOrGetter<boolean | undefined>;
  externalTree?: MaybeRefOrGetter<FloatingTreeStore | undefined>;
  /**
   * Whether the composable controls the active trigger. A trigger that is not the active trigger
   * does not give its safe polygon options to the popup.
   * @default true
   */
  isActiveTrigger?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * The element of the trigger. The safe polygon and `KeepAlive` close the popup only when this
   * element is the anchor of the store. While the composable is enabled, the element is a hover
   * trigger of the popup (`PopupHoverSession.addHoverTrigger`).
   */
  triggerElement?: MaybeRefOrGetter<Element | null | undefined>;
  getHandleCloseContext?: (() => HandleCloseContextBase | null) | undefined;
  /**
   * Called before each hover-driven open attempt (immediate, delayed, and rest-ms
   * paths). Return `false` to veto; any other return value permits the open.
   */
  shouldOpen?: (() => boolean) | undefined;
  /**
   * Regression workaround (https://github.com/mui/base-ui/issues/5152): also cancels a pending
   * hover-open from the `mouseout` of the trigger, backing up a `mouseleave` that Chrome can drop
   * during a fast pointer sweep and leave a submenu stuck open.
   *
   * WARNING: only enable on single-trigger, hover-driven roots (e.g.
   * `Menu.SubmenuTrigger`). It skips the `isClickLikeOpenEvent()` and
   * `isInsideEnabledTrigger()` checks `mouseleave` applies, so on a
   * multi-trigger or click-driven root it cancels legitimate opens/closes.
   * @default false
   */
  guardStaleOpen?: MaybeRefOrGetter<boolean | undefined>;
}

/**
 * Gives the listeners of a trigger that opens and closes a popup on hover. Call it in `setup`.
 * The part puts the object in the `props` of `useRenderElement`, before its own props and its
 * attributes. Each listener returns while the composable is not enabled.
 */
function bindHoverTrigger(
  store: MaybeRefOrGetter<PopupInteractionStore>,
  intent: ComputedRef<PopupHoverSession>,
  props: HoverTriggerOptions = {},
): Omit<HTMLProps, 'ref'> {
  const enabled = () => toValue(props.enabled) ?? true;
  const isActiveTrigger = () => toValue(props.isActiveTrigger) ?? true;
  const polygon = computed(() => resolvePolygonOptions(toValue(props.safePolygon)));
  const move = () => toValue(props.move) ?? true;
  const mouseOnly = () => toValue(props.mouseOnly) ?? false;

  const tree = useFloatingTree(props.externalTree);
  let moveCountsAsEnter = true;

  const options: HoverTriggerPolicy = {
    delay: () => toValue(props.delay) ?? 0,
    restMs: () => toValue(props.restMs) ?? 0,
    polygon: () => polygon.value,
    enabled,
    triggerElement: () => toValue(props.triggerElement) ?? null,
    mouseOnly,
    tree: () => tree.value,
    shouldOpen: () => props.shouldOpen?.() !== false,
    getHandleCloseContext: props.getHandleCloseContext,
  };

  onMounted(() => {
    watch(
      [intent, isActiveTrigger, polygon],
      ([session, active, options]) => {
        if (active) {
          session.handleCloseOptions = options;
        }
      },
      { immediate: true },
    );
  });
  const { isHeld } = useKeepAliveState();

  // `KeepAlive` sends no leave event. A popup that hover opened would then stay open after the
  // activation, with no pointer on its trigger.
  watch(
    isHeld,
    (held) => {
      if (held) {
        const current = toValue(store);
        if (
          current.select('open') &&
          isHoverOpenEvent(current.context.openEvent?.type) &&
          (toValue(props.triggerElement) ?? null) === current.select('anchorElement')
        ) {
          current.setOpen(false, createChangeEventDetails(REASONS.triggerHover));
        }
      }
    },
    { flush: 'sync' },
  );

  // While the popup blocks pointer events, a trigger that opens it on hover keeps them, so the
  // pointer can move to it from the active trigger.
  useDomEffect(
    [intent, enabled, options.triggerElement],
    () => {
      if (!enabled()) {
        return;
      }
      const current = intent.value;
      const element = options.triggerElement() as HTMLElement | SVGSVGElement | null;
      const detach = current.attachTrigger(options);
      if (element) {
        current.addHoverTrigger(element);
      }
      return () => {
        detach();
        if (element) {
          current.removeHoverTrigger(element);
        }
      };
    },
    isHeld,
  );

  watch([enabled, move, mouseOnly, tree, intent], () => {
    moveCountsAsEnter = true;
  });

  function setPointerType(event: PointerEvent) {
    if (enabled()) {
      intent.value.pointerType = event.pointerType;
    }
  }

  return {
    onPointerdown: setPointerType,
    onPointerenter: setPointerType,
    onMouseenter(event: MouseEvent) {
      if (enabled()) {
        intent.value.enterTrigger(event, options);
      }
    },
    onMouseleave(event: MouseEvent) {
      if (enabled()) {
        intent.value.leaveTrigger(event, options);
      }
    },
    // Backup cancellation for Chrome's dropped `mouseleave` — see `guardStaleOpen`.
    onMouseout(event: MouseEvent) {
      if (!enabled() || !(toValue(props.guardStaleOpen) ?? false)) {
        return;
      }
      // The pointer moved within the subtree of the trigger.
      if (contains(event.currentTarget as Element, event.relatedTarget as Element | null)) {
        return;
      }
      intent.value.cancelPendingOpen();
    },
    onMousemove(event: MouseEvent) {
      if (!enabled()) {
        return;
      }
      if (move() && moveCountsAsEnter) {
        moveCountsAsEnter = false;
        intent.value.enterTrigger(event, options);
      }
      intent.value.moveTrigger(event, options);
    },
  };
}

export interface HoverPopupOptions {
  /**
   * Whether the composable is enabled, including all its watchers and listeners.
   * @default true
   */
  enabled?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Waits for the specified time after the pointer leaves the popup before it changes the `open`
   * state.
   * @default 0
   */
  closeDelay?: MaybeRefOrGetter<number | undefined>;
  /**
   * Tree node id override for floating elements that participate in the tree
   * without a `PopupPositioningContext`, such as inline nested navigation menus.
   */
  nodeId?: MaybeRefOrGetter<string | undefined>;
}

/**
 * Adds the hover interactions of a popup to its positioner element. Call it in `setup`. The store
 * can be a ref or a getter, because a part can get its store after `setup`.
 */
function bindHoverPopup(
  store: MaybeRefOrGetter<PopupInteractionStore>,
  intent: ComputedRef<PopupHoverSession>,
  parameters: HoverPopupOptions = {},
): void {
  const enabled = () => toValue(parameters.enabled) ?? true;
  const closeDelay = () => toValue(parameters.closeDelay) ?? 0;

  const open = computed(() => toValue(store).select('open'));
  const positionerElement = computed(() => toValue(store).select('positionerElement'));
  const anchorElement = computed(() => toValue(store).select('anchorElement'));

  const tree = useFloatingTree();
  const parentId = useFloatingParentNodeId();
  const childClosedTimeout = useTimeout();

  onMounted(() => {
    watch(
      [intent, open],
      ([session, isOpen], [previousSession, wasOpen]) => {
        if (isOpen) {
          session.cancelPendingOpen();
        } else {
          // A controlled close can keep the popup mounted without emitting an open change.
          if (session === previousSession && wasOpen) {
            session.cancel();
          }
          session.reset();
        }
      },
      { immediate: true, flush: 'post' },
    );
  });

  // The store owns the intent, and the triggers use it too. This part stops what is in flight when
  // it unmounts, when its store changes and when `KeepAlive` deactivates it.
  const { isHeld } = useKeepAliveState();
  useDomEffect(
    [intent],
    () => {
      const hoverIntent = intent.value;
      return () => {
        childClosedTimeout.clear();
        hoverIntent.cancel();
        hoverIntent.restoreOutsidePointerEvents();
      };
    },
    isHeld,
  );

  useDomEffect(
    [intent, enabled, open, anchorElement, positionerElement, tree, parentId],
    () => {
      const hoverIntent = intent.value;
      if (!enabled()) {
        return undefined;
      }

      const anchor = anchorElement.value;
      const positioner = positionerElement.value;
      if (
        open.value &&
        isElement(anchor) &&
        positioner &&
        hoverIntent.blockOutsidePointerEventsForPopup(
          anchor as HTMLElement | SVGSVGElement,
          positioner,
          tree.value,
          parentId.value,
        )
      ) {
        return hoverIntent.restoreOutsidePointerEvents;
      }
      return undefined;
    },
    isHeld,
  );

  // A caller can supply a positioner element outside the component tree.
  useDomEffect(
    [intent, enabled, positionerElement, tree, parentId],
    () => {
      const hoverIntent = intent.value;
      if (!enabled()) {
        return undefined;
      }

      const currentStore = toValue(store);
      const currentTree = tree.value;
      const currentParentId = parentId.value;
      const floating = positionerElement.value;

      function hasParentChildren() {
        return !!(
          currentTree &&
          currentParentId &&
          getNodeChildren(currentTree.nodesRef.value, currentParentId).length > 0
        );
      }

      function onFloatingMouseEnter() {
        hoverIntent.enterPopup();
        childClosedTimeout.clear();
        currentTree?.events.off('floating.closed', onNodeClosed);
      }

      function onFloatingMouseLeave(event: MouseEvent) {
        if (hasParentChildren() && currentTree) {
          currentTree.events.on('floating.closed', onNodeClosed);
          return;
        }

        hoverIntent.leavePopup(event, {
          closeDelay,
          tree: currentTree,
          nodeId: toValue(parameters.nodeId),
        });
      }

      function onNodeClosed(event: MouseEvent) {
        if (!currentTree || !currentParentId) {
          return;
        }
        // The pointer can move into this popup when the popup below it closes, and its `mouseenter`
        // event then cancels this timer. `open` of a node is the state of the last DOM update, so
        // the check for an open popup below it must wait for that update.
        childClosedTimeout.start(0, () => {
          if (hasParentChildren()) {
            return;
          }
          currentTree.events.off('floating.closed', onNodeClosed);
          currentStore.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
          currentTree.events.emit('floating.closed', event);
        });
      }

      const detach =
        floating &&
        (bindPositionerHandlers(floating, {
          onMouseenter: onFloatingMouseEnter,
          onMouseleave: onFloatingMouseLeave,
          onPointerdownCapture: hoverIntent.onPopupPointerDown,
        }) ??
          mergeCleanups(
            addEventListener(floating, 'mouseenter', onFloatingMouseEnter),
            addEventListener(floating, 'mouseleave', onFloatingMouseLeave),
            addEventListener(floating, 'pointerdown', hoverIntent.onPopupPointerDown, true),
          ));
      return () => {
        detach?.();
        childClosedTimeout.clear();
        currentTree?.events.off('floating.closed', onNodeClosed);
      };
    },
    isHeld,
  );
}

const CURSOR_SPEED_THRESHOLD = 0.1;
const CURSOR_SPEED_THRESHOLD_SQUARED = CURSOR_SPEED_THRESHOLD * CURSOR_SPEED_THRESHOLD;
function isInsideRect(pointX: number, pointY: number, rect: Rect) {
  return (
    pointX >= rect.x &&
    pointX <= rect.x + rect.width &&
    pointY >= rect.y &&
    pointY <= rect.y + rect.height
  );
}

export function trackHoverPolygon(
  { x, y, placement, elements, onClose, nodeId, tree }: HandleCloseContext,
  timeout: Timeout,
) {
  const side = placement?.split('-')[0] as Side | undefined;
  let hasLanded = false;
  let lastX: number | null = null;
  let lastY: number | null = null;
  let lastCursorTime = typeof performance !== 'undefined' ? performance.now() : 0;

  function isCursorMovingSlowly(nextX: number, nextY: number) {
    const currentTime = performance.now();
    const elapsedTime = currentTime - lastCursorTime;

    if (lastX === null || lastY === null || elapsedTime === 0) {
      lastX = nextX;
      lastY = nextY;
      lastCursorTime = currentTime;
      return false;
    }

    const deltaX = nextX - lastX;
    const deltaY = nextY - lastY;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;
    const thresholdSquared = elapsedTime * elapsedTime * CURSOR_SPEED_THRESHOLD_SQUARED;

    lastX = nextX;
    lastY = nextY;
    lastCursorTime = currentTime;

    return distanceSquared < thresholdSquared;
  }

  function close() {
    timeout.clear();
    onClose();
  }

  return function onMouseMove(event: MouseEvent) {
    timeout.clear();

    const domReference = elements.domReference;
    const floating = elements.floating;
    if (!domReference || !floating || side == null || x == null || y == null) {
      return;
    }

    const { clientX, clientY } = event;
    const target = getTarget(event) as Element | null;
    const isLeave = event.type === 'mouseleave';
    const isOverFloatingEl = contains(floating, target);
    const isOverReferenceEl = contains(domReference, target);

    if (isOverFloatingEl) {
      hasLanded = true;

      if (!isLeave) {
        return;
      }
    }

    if (isOverReferenceEl) {
      hasLanded = false;

      if (!isLeave) {
        hasLanded = true;
        return;
      }
    }

    // Prevent overlapping floating element from being stuck in an open-close
    // loop: https://github.com/floating-ui/floating-ui/issues/1910
    if (isLeave && isElement(event.relatedTarget) && contains(floating, event.relatedTarget)) {
      return;
    }

    function hasOpenChildNode() {
      return Boolean(tree && getNodeChildren(tree.nodesRef.value, nodeId).length > 0);
    }

    function closeIfNoOpenChild() {
      if (!hasOpenChildNode()) {
        close();
      }
    }

    // If any nested child is open, abort.
    if (hasOpenChildNode()) {
      return;
    }

    const refRect = domReference.getBoundingClientRect();
    const rect = floating.getBoundingClientRect();
    const region = safePolygon(side, x, y, clientX, clientY, refRect, rect);
    if (region === 'bridge') {
      return;
    }

    if (hasLanded && !isInsideRect(clientX, clientY, refRect)) {
      closeIfNoOpenChild();
      return;
    }

    if (!isLeave && isCursorMovingSlowly(clientX, clientY)) {
      closeIfNoOpenChild();
      return;
    }

    if (region === 'outside') {
      closeIfNoOpenChild();
    } else if (!hasLanded) {
      timeout.start(40, closeIfNoOpenChild);
    }

    return;
  };
}

export function usePopupHover(store: MaybeRefOrGetter<PopupInteractionStore>) {
  // Server renders share inert handles. Create the session only on a client interaction or mount.
  const session = computed(() => getPopupHoverSession(toValue(store)));
  return {
    session,
    trigger: (options: HoverTriggerOptions = {}) => bindHoverTrigger(store, session, options),
    popup: (options: HoverPopupOptions = {}) => bindHoverPopup(store, session, options),
  };
}
