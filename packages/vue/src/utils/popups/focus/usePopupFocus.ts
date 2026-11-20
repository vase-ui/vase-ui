import {
  computed,
  inject,
  onBeforeMount,
  onMounted,
  onScopeDispose,
  provide,
  shallowRef,
  toValue,
  unref,
  watch,
} from 'vue';
import type { ComponentPublicInstance, InjectionKey, MaybeRefOrGetter, Ref, ShallowRef } from 'vue';
import { getNodeName, isHTMLElement, isShadowRoot } from '@floating-ui/utils/dom';
import { addEventListener } from '../../../common/addEventListener';
import { mergeCleanups } from '../../../common/mergeCleanups';
import { ownerDocument, ownerWindow } from '../../../common/owner';
import { platform } from '../../../common/platform';
import {
  activeElement,
  closest,
  closestInEventPath,
  contains,
  getTarget,
} from '../../../common/shadowDom';
import { useAnimationFrame } from '../../../common/useAnimationFrame';
import type { InteractionType } from '../usePopupTrigger';
import { useTimeout } from '../../../common/useTimeout';
import { isElementVisible } from '../../../internals/composite/listIndex';
import { clickTriggers } from '../registeredParts';
import { createChangeEventDetails } from '../../../internals/createVaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { resolveElement } from '../../../internals/resolveElement';
import type { FloatingUIOpenChangeDetails } from '../../../internals/types';
import { useKeepAliveState } from '../../../internals/useKeepAliveState';
import { createAttribute } from '../createAttribute';
import { getFloatingFocusElement, isTypeableCombobox, isTypeableElement } from '../element';
import { isVirtualClick, isVirtualPointerEvent, stopEvent } from '../event';
import { getNestedPortals, getPortalLocation } from '../portal/portalElements';
import { usePortalContext } from '../portal/PopupPortalContext';
import { useFloatingTree } from '../tree/FloatingTree';
import type { FloatingTreeStore } from '../tree/FloatingTreeStore';
import { getNodeAncestors, getNodeChildren } from '../tree/nodes';
import type { PopupInteractionStore } from '../types';
import { createFocusGuardElement } from './createFocusGuardElement';
import {
  enqueueFocus,
  focusable,
  getNextTabbable,
  getPreviousTabbable,
  isOutsideEvent,
  isTabbable,
  tabbable,
} from './tabbable';
import type { FocusableElement } from './tabbable';
import { useElementSiblings } from './useElementSiblings';
import type { ElementSiblings } from './useElementSiblings';

type FocusTarget = Element | ComponentPublicInstance | null;

/**
 * Where the focus goes.
 *
 * - `false`: Do not move the focus.
 * - `true`: Move the focus based on the default behavior.
 * - An element, a component, or a ref of one: Move the focus to that element. A template gives the
 *   value of a ref, so `:initial-focus="field"` gives `null` first and then the element. `null` and
 *   an empty ref use the default behavior. A ref is empty when it holds `null` or `undefined`.
 * - A function: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
 *   Return an element to focus, `true` or `null` to use the default behavior, or `false` or
 *   `undefined` to do nothing.
 */
export type FocusOption =
  | boolean
  | FocusTarget
  | Readonly<Ref<FocusTarget | undefined>>
  | ((interactionType: InteractionType) => boolean | FocusTarget | void);

/**
 * Provides focus management for the floating element.
 * @see https://floating-ui.com/docs/FloatingFocusManager
 */
export interface PopupFocusOptions {
  /**
   * The popup's interaction store.
   */
  store: PopupInteractionStore;
  /**
   * The interaction type used to open the floating element.
   */
  openInteractionType?: InteractionType | null | undefined;
  /**
   * Whether or not the focus manager should be disabled. Useful to delay focus
   * management until after a transition completes or some other conditional
   * state.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Determines the element to focus when the floating element is opened.
   * The default behavior is the first tabbable element, or else the floating element.
   * @default true
   */
  initialFocus?: FocusOption | undefined;
  /**
   * Determines the element to focus when the floating element is closed.
   * By default, the focus manager checks the reference, the element that had focus before the
   * floating element opened, the floating element of the focus manager above, and the newest
   * eligible element that had focus before an open, in that order.
   * When `openInteractionType` is `null`, the element that had the focus comes before the reference.
   * It skips detached targets and targets with a `hidden` attribute on themselves or an ancestor.
   * It also skips targets in this popup while it is closed and in closed popups below it. This
   * includes controls that a slot in an open shadow root projects into those popups. For a
   * non-tabbable target, it tries the first eligible tabbable descendant, or the target itself if
   * it has none. When the element is in the closed floating element of a disabled focus manager
   * above, the return element of that focus manager replaces it, because that focus manager returns
   * no focus at its unmount. The same rule applies to the new element.
   *
   * - `false`: Do not move the focus.
   * - `true`: Move the focus based on the default behavior.
   * - An element, a component, or a ref of one: Check this target before the default targets.
   *   `null` and an empty ref use the default behavior.
   * - A function: Called with the type of the interaction that closed the floating element (`mouse`,
   *   `touch`, `pen`, or `keyboard`). The type is an empty string when no event of the user closed
   *   it. The return of the focus of a floating element below also calls the function, with the
   *   close type of that element, when it replaces a target in this closed floating element. Return
   *   an element to focus, `true` or `null` to use the default behavior, or `false` or `undefined`
   *   to do nothing.
   * @default true
   */
  returnFocus?: FocusOption | undefined;
  /**
   * Whether `returnFocus` is an explicit target of the consumer. Internal dynamic defaults use
   * `false`, so that a focus that already moved outside the floating tree stays where it is. By
   * default, only a value of `returnFocus` that is not a boolean is explicit.
   * @internal
   */
  explicitReturnFocus?: boolean | undefined;
  /**
   * Determines where focus should be restored if focus inside the floating element is lost
   * (such as due to the removal of the currently focused element from the DOM).
   *
   * - `true`: restore to the nearest tabbable element inside the floating tree (previous
   *   tabbable if possible, otherwise the last tabbable, then the floating element itself)
   * - `'popup'`: restore directly to the floating element (container) itself
   * - `false`: do not restore focus
   *
   * The restore needs `closeOnFocusOut` set to `true`.
   * @default false
   */
  restoreFocus?: boolean | 'popup' | undefined;
  /**
   * Determines if focus is “modal”, meaning focus is fully trapped inside the
   * floating element and outside content cannot be accessed. This includes
   * screen reader virtual cursors.
   * @default true
   */
  modal?: boolean | undefined;
  /**
   * Whether the elements that a modal floating element hides from assistive technology also get
   * `inert`. The Tab key and a press then cannot reach them.
   * @default false
   */
  outsideElementsInert?: boolean | undefined;
  /**
   * Determines whether `focusout` event listeners that control whether the
   * floating element should be closed if the focus moves outside of it are
   * attached to the reference and floating elements. This affects non-modal
   * focus management.
   * @default true
   */
  closeOnFocusOut?: boolean | undefined;
  /**
   * Overrides the element to focus when tabbing forward out of the floating element. A ref or a
   * getter that gives no element is the same as `null`: the outside guard of the portal gets the
   * focus.
   */
  nextFocusableElement?: MaybeRefOrGetter<HTMLElement | null | undefined>;
  /**
   * Overrides the element to focus when tabbing backward out of the floating element. A ref or a
   * getter that gives no element is the same as `null`: the outside guard of the portal gets the
   * focus.
   */
  previousFocusableElement?: MaybeRefOrGetter<HTMLElement | null | undefined>;
  /**
   * Ref to the focus guard preceding the floating element content. The focus manager writes it.
   * Can be useful to focus the popup programmatically.
   */
  beforeContentFocusGuardRef?: ShallowRef<HTMLSpanElement | null> | undefined;
  /**
   * Ref to the focus guard following the floating element content. The focus manager writes it. A
   * focus guard outside the popup can send the focus to the end of the popup with it.
   */
  afterContentFocusGuardRef?: ShallowRef<HTMLSpanElement | null> | undefined;
  /**
   * External FloatingTree to use when the one provided by context can't be used.
   */
  externalTree?: FloatingTreeStore | undefined;
  /**
   * Additional elements that should be treated as part of the floating subtree
   * even if they are rendered outside the floating element itself.
   */
  getInsideElements?: (() => (Element | null | undefined)[]) | undefined;
  /**
   * Nodes of the part that go after its element, before the last inside guard. `Combobox.Popup`
   * gives its dismiss button.
   */
  nodesAfterElement?: readonly ChildNode[] | undefined;
}

// The focus manager above. A dialog has no node in the popup tree, and a nested popup is in a portal
// of its own, so a focus manager finds the popups above and below it through this context.
interface ParentFocusManager {
  // The last default target of a return of the focus below.
  getPopupElement: () => HTMLElement | null;
  // Adds the test of a focus manager below. The result removes the test.
  addPopupBelow: (isInClosedPopup: (element: Element | null) => boolean) => () => void;
  // Replaces a target that is in the closed popup of a disabled focus manager, here or above, with
  // the return element of that focus manager. That focus manager returns no focus at its unmount, so
  // a target in its closed popup cannot keep the focus.
  getReturnTarget: (
    target: Element,
    closeType: InteractionType,
    activeElementAtClose: Element | null,
  ) => Element | null;
}

interface ReturnTargets {
  elementFocusedBeforeOpen: WeakRef<Element> | null;
  domReference: WeakRef<Element> | null;
  preferPreviousFocus: boolean;
  doc: WeakRef<Document>;
}

const ParentFocusManagerContext: InjectionKey<ParentFocusManager> = Symbol();

// The number of times that the focus managers above took their marks. A later take of the marks
// lifts the marks of an earlier take, so the popup in the content of another popup must take its
// marks last.
const ParentMarksCountContext: InjectionKey<Readonly<Ref<number>>> = Symbol();

function getEventType(event: Event, lastInteractionType?: InteractionType): InteractionType {
  const win = ownerWindow(getTarget(event));
  if (event instanceof win.KeyboardEvent) {
    return 'keyboard';
  }
  if (event instanceof win.FocusEvent) {
    // Focus events can be caused by a preceding pointer interaction (e.g., focusout on outside press).
    // Prefer the last known pointer type if provided, else treat as keyboard.
    return lastInteractionType || 'keyboard';
  }
  if ('pointerType' in event) {
    // A trusted click without a pointerType is keyboard/AT; only synthesized
    // clicks (e.g. a test harness) pair an empty pointerType with a click count.
    return (
      (event.pointerType as InteractionType) ||
      (isVirtualClick(event as PointerEvent) ? 'keyboard' : lastInteractionType || 'mouse')
    );
  }
  if ('touches' in event) {
    return 'touch';
  }
  if (event instanceof win.MouseEvent) {
    // A click may have no pointer event. It then falls through to here.
    return lastInteractionType || (event.detail === 0 ? 'keyboard' : 'mouse');
  }
  return '';
}

const LIST_LIMIT = 20;
let previouslyFocusedElements: WeakRef<Element>[] = [];

function clearDisconnectedPreviouslyFocusedElements() {
  previouslyFocusedElements = previouslyFocusedElements.filter((entry) => {
    return entry.deref()?.isConnected;
  });
}

function addPreviouslyFocusedElement(element: Element | null | undefined) {
  clearDisconnectedPreviouslyFocusedElements();
  if (element && getNodeName(element) !== 'body') {
    previouslyFocusedElements.push(new WeakRef(element));
    if (previouslyFocusedElements.length > LIST_LIMIT) {
      previouslyFocusedElements = previouslyFocusedElements.slice(-LIST_LIMIT);
    }
  }
}

function getPreviouslyFocusedElement(skip?: (element: Element) => boolean) {
  clearDisconnectedPreviouslyFocusedElements();
  for (let i = previouslyFocusedElements.length - 1; i >= 0; i -= 1) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The loop runs from the last index to 0.
    const element = previouslyFocusedElements[i]!.deref();
    if (element && !skip?.(element)) {
      return element;
    }
  }
  return undefined;
}

function getFirstTabbableElement(
  container: Element | null | undefined,
  isInClosedPopup: (element: Element) => boolean,
) {
  if (!container) {
    return null;
  }

  if (isTabbable(container)) {
    return container;
  }

  return tabbable(container, isInClosedPopup)[0] ?? container;
}

// The return skips detached elements, hidden elements and elements in closed popups.
// A substitute for a connected target must preserve focus that the closing update moved.
function findReturnElement(
  candidates: (Element | null | undefined)[],
  isInClosedPopup: (element: Element) => boolean,
) {
  let skippedConnected = false;
  for (const candidate of candidates) {
    if (candidate?.isConnected) {
      if (!closest(candidate, '[hidden]') && !isInClosedPopup(candidate)) {
        return { element: candidate, skippedConnected };
      }
      skippedConnected = true;
    }
  }
  return { element: null, skippedConnected };
}

function dialogTabIndex(target: HTMLElement) {
  if (
    !target.getAttribute('role')?.includes('dialog') ||
    (target.hasAttribute('tabindex') && !target.hasAttribute('data-tabindex'))
  ) {
    return undefined;
  }
  const hasTabStop = focusable(target).some((child) => {
    const saved = child.getAttribute('data-tabindex');
    return isTabbable(child) || (saved !== null && !saved.startsWith('-'));
  });
  return hasTabStop ? -1 : 0;
}

// A default applies only to `undefined`, as `withDefaults` does. `null` has its own meaning for
// `openInteractionType` and `returnFocus`.
function withDefault<Value, Default>(value: Value | undefined, defaultValue: Default) {
  return value === undefined ? defaultValue : value;
}

function withDefaultProps(props: PopupFocusOptions) {
  return {
    ...props,
    openInteractionType: withDefault(props.openInteractionType, ''),
    disabled: withDefault(props.disabled, false),
    initialFocus: withDefault(props.initialFocus, true),
    returnFocus: withDefault(props.returnFocus, true),
    restoreFocus: withDefault(props.restoreFocus, false),
    modal: withDefault(props.modal, true),
    outsideElementsInert: withDefault(props.outsideElementsInert, false),
    closeOnFocusOut: withDefault(props.closeOnFocusOut, true),
  };
}

function haveSameNodes(first: ElementSiblings, second: ElementSiblings) {
  return (['before', 'after'] as const).every((side) => {
    const firstNodes = first[side] ?? [];
    const secondNodes = second[side] ?? [];
    return (
      firstNodes.length === secondNodes.length &&
      firstNodes.every((node, index) => node === secondNodes[index])
    );
  });
}

/**
 * Moves the focus into a popup when it opens, and returns the focus when the popup closes. It keeps
 * the Tab key in a modal popup. Call it in `setup` of a popup part, after `useRenderElement`.
 *
 * It keeps its two inside focus guards beside `element` with `useElementSiblings`, so the part
 * keeps one root node.
 */
export function usePopupFocus(
  props: () => PopupFocusOptions,
  element: Readonly<Ref<HTMLElement | null>>,
) {
  const managedTabIndex = shallowRef<0 | -1>();
  let localListeners:
    | {
        focusin: (event: FocusEvent) => void;
        focusout: (event: FocusEvent) => void;
      }
    | undefined;
  const listeners = {
    onFocusin: (event: FocusEvent) => localListeners?.focusin(event),
    onFocusout: (event: FocusEvent) => localListeners?.focusout(event),
  };

  function handleTabIndex(target: HTMLElement) {
    const value = dialogTabIndex(target);
    if (target === element.value) {
      managedTabIndex.value = value;
    } else if (value !== undefined) {
      target.setAttribute('tabindex', String(value));
      target.setAttribute('data-tabindex', String(value));
    }
  }

  // The props change before each render of the part, as the props of a component do. A cleanup
  // after the unmount thus reads the props of the last render, and not a state that changed at the
  // unmount, such as the active trigger of a submenu.
  const resolved = shallowRef(withDefaultProps(props()));
  watch(
    () => withDefaultProps(props()),
    (value) => {
      resolved.value = value;
    },
  );

  const open = computed(() => resolved.value.store.select('open'));
  const domReference = computed(() => resolved.value.store.select('anchorElement'));
  const floating = computed(() => resolved.value.store.select('positionerElement'));
  const floatingFocusElement = () =>
    getFloatingFocusElement(floating.value, resolved.value.store.context.popupRef?.value);

  const location = computed(() => getPortalLocation(floatingFocusElement()));

  // A typeable combobox reference (an input or a textarea) with `initialFocus` set to `false` has
  // different focus semantics: the focus is not trapped inside the floating element, so a modal
  // popup has no guards. The elements outside still get `aria-hidden`.
  const isUntrappedTypeableCombobox = computed(
    () => isTypeableCombobox(domReference.value) && resolved.value.initialFocus === false,
  );

  const portalContext = usePortalContext();
  const portalNode = computed(() => portalContext?.portalNode.value ?? null);
  // A portal that renders in place leaves the popup at its place in the tab order. The focus
  // manager then acts as with no portal: a popup that is not modal has no guards.
  const isInsidePortal = computed(() => portalContext != null && !portalContext.inPlace.value);
  const tree = useFloatingTree(() => resolved.value.externalTree);

  const parentFocusManager = inject(ParentFocusManagerContext, null);

  const parentMarksCount = inject(ParentMarksCountContext, null);
  const marksCount = shallowRef(0);
  // The sum also tells the focus managers below about a take above a focus manager that holds no
  // marks.
  provide(
    ParentMarksCountContext,
    computed(() => (parentMarksCount?.value ?? 0) + marksCount.value),
  );

  const getNodeId = () => resolved.value.store.context.positioning?.nodeId;

  // A popup that `KeepAlive` holds keeps its open state.
  const { isHeld } = useKeepAliveState();
  const isDisabled = () => resolved.value.disabled || isHeld.value;

  // A nested dialog or a menu is in a portal of its own, and a dialog has no node in the popup tree.
  // A focus in such a popup thus is not in `floating`.
  const popupsBelow = new Set<(element: Element | null) => boolean>();

  function isInClosedPopupBelow(element: Element | null) {
    return [...popupsBelow].some((test) => test(element));
  }

  // A popup below that is still open keeps the focus. A popup that a menu item opens can be below the
  // menu.
  function isInClosedPopup(element: Element | null) {
    return (
      (!open.value &&
        (contains(floating.value, element) || contains(floatingFocusElement(), element))) ||
      isInClosedPopupBelow(element)
    );
  }

  provide(ParentFocusManagerContext, {
    getPopupElement: floatingFocusElement,
    addPopupBelow(test) {
      popupsBelow.add(test);
      return () => {
        popupsBelow.delete(test);
      };
    },
    getReturnTarget(target, type, activeElementAtClose) {
      if (
        !open.value &&
        isDisabled() &&
        (contains(floating.value, target) || contains(floatingFocusElement(), target))
      ) {
        const ownTarget = getReturnElement(type, activeElementAtClose);
        return ownTarget && parentFocusManager
          ? parentFocusManager.getReturnTarget(ownTarget, type, activeElementAtClose)
          : ownTarget;
      }
      return parentFocusManager
        ? parentFocusManager.getReturnTarget(target, type, activeElementAtClose)
        : target;
    },
  });

  // A server render calls no `onBeforeMount`, so it adds nothing.
  onBeforeMount(() => {
    if (parentFocusManager) {
      onScopeDispose(parentFocusManager.addPopupBelow(isInClosedPopup));
    }
  });

  let preventReturnFocus = false;
  let isPointerDown = false;
  let pointerDownOutside = false;
  let lastFocusedTabbable: FocusableElement | null = null;
  // The element in the popup that took the focus last, until the focus leaves it for an element that
  // stays in the document.
  let focusedElement: Element | null = null;
  let closeType: InteractionType = '';
  let lastInteractionType: InteractionType = '';

  const blurTimeout = useTimeout();
  const pointerDownTimeout = useTimeout();
  const restoreFocusFrame = useAnimationFrame();

  // A `returnFocus` that is not a boolean is a target of the consumer, unless `explicitReturnFocus`
  // says otherwise.
  function isReturnFocusExplicit() {
    return resolved.value.explicitReturnFocus ?? typeof resolved.value.returnFocus !== 'boolean';
  }

  const shouldRenderGuards = computed(
    () =>
      !resolved.value.disabled &&
      (resolved.value.modal ? !isUntrappedTypeableCombobox.value : true) &&
      (isInsidePortal.value || resolved.value.modal),
  );

  let guards: { before: HTMLSpanElement; after: HTMLSpanElement } | null = null;

  function getGuards(doc: Document) {
    if (guards?.before.ownerDocument !== doc) {
      const before = createFocusGuardElement(doc);
      const after = createFocusGuardElement(doc);
      before.setAttribute('data-type', 'inside');
      after.setAttribute('data-type', 'inside');
      before.addEventListener('focusin', handleBeforeGuardFocusin);
      after.addEventListener('focusin', handleAfterGuardFocusin);
      guards = { before, after };
    }
    return guards;
  }

  // `element` is `null` on a server and before the mount, so the guards exist only in a browser.
  const guardElements = computed(() =>
    element.value && shouldRenderGuards.value ? getGuards(element.value.ownerDocument) : null,
  );

  const siblings = computed<ElementSiblings | null>((previous) => {
    const nodesAfterElement = resolved.value.nodesAfterElement ?? [];
    const guardPair = guardElements.value;
    if (!element.value || (!guardPair && nodesAfterElement.length === 0)) {
      return null;
    }
    const next = guardPair
      ? { before: [guardPair.before], after: [...nodesAfterElement, guardPair.after] }
      : { after: [...nodesAfterElement] };
    return previous && haveSameNodes(previous, next) ? previous : next;
  });

  const placedSiblings = useElementSiblings(element, siblings);

  // Vue can run the effects before `useElementSiblings` puts the guards beside the element. An
  // effect thus gets a guard only while the guard is there. Each run of the marks then gives the
  // same result.
  const beforeGuardElement = computed(() => {
    const guard = guardElements.value?.before;
    return guard && placedSiblings.value?.before?.includes(guard) ? guard : null;
  });
  const afterGuardElement = computed(() => {
    const guard = guardElements.value?.after;
    return guard && placedSiblings.value?.after?.includes(guard) ? guard : null;
  });

  // An empty ref holds `null`, or `undefined` when it has no initial value. Both use the default
  // behavior, so this function gives `null` for both. Only a function can give `undefined`, which
  // moves no focus.
  function resolveFocusOption(option: FocusOption, interactionType: InteractionType) {
    const value = typeof option === 'function' ? option(interactionType) : (unref(option) ?? null);
    if (typeof value === 'boolean' || value == null) {
      return value;
    }
    return resolveElement(value) as FocusableElement | null;
  }

  // A popup part that renders no element leaves the positioner as the popup element, and the two
  // guards of this part are in the positioner. A guard that counts as content gets the focus from the
  // other guard, and the two then pass the focus to each other with no end.
  function getTabbableContent(container: Element | null = floatingFocusElement()) {
    if (!container) {
      return [];
    }
    const before = beforeGuardElement.value;
    const after = afterGuardElement.value;
    return tabbable(container).filter((element) => element !== before && element !== after);
  }

  function getResolvedInsideElements() {
    return (
      resolved.value
        .getInsideElements?.()
        .filter((element): element is Element => element != null) ?? []
    );
  }

  type Cleanup = (() => void) | void | undefined;

  interface Effect {
    sources: () => unknown[];
    setup: () => Cleanup;
    cleanup?: Cleanup;
  }

  // Several sources can change in the same patch. Entry, return and outside marks need a fixed order.
  const effects: Effect[] = [];

  function effect(sources: Effect['sources'], setup: Effect['setup']) {
    effects.push({ sources, setup });
  }

  function update(sourceLists: unknown[][], previous?: unknown[][]) {
    effects.forEach((item, index) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Each effect contributes one source list.
      const sources = sourceLists[index]!;
      const lastSources = previous?.[index];
      if (
        sources.length !== lastSources?.length ||
        sources.some((value, position) => !Object.is(value, lastSources[position]))
      ) {
        item.cleanup?.();
        item.cleanup = item.setup();
      }
    });
  }

  effect(
    () => [open.value, isDisabled(), floatingFocusElement()],
    () => {
      const floatingFocusEl = floatingFocusElement();
      if (!open.value || isDisabled() || !isHTMLElement(floatingFocusEl)) {
        return;
      }

      closeType = '';
      lastInteractionType = '';
      // A popup that stays mounted removes its listeners before the return of the focus, so the
      // record can hold an element of the last open.
      focusedElement = null;

      const doc = ownerDocument(floatingFocusEl);
      const previouslyFocusedElement = activeElement(doc);

      // Wait for the other effects of this update to set `tabindex`.
      // A template ref of `initialFocus` also gives its element by then.
      queueMicrotask(() => {
        const resolvedInitialFocus = resolveFocusOption(
          resolved.value.initialFocus,
          resolved.value.openInteractionType || '',
        );

        // This check does not include `null`, because `null` uses the default behavior.
        if (resolvedInitialFocus === undefined || resolvedInitialFocus === false) {
          return;
        }

        const focusAlreadyInsideFloatingEl = contains(floatingFocusEl, previouslyFocusedElement);

        if (focusAlreadyInsideFloatingEl) {
          return;
        }

        let focusableElements: FocusableElement[] | null = null;
        const getDefaultFocusElement = () => {
          focusableElements ??= getTabbableContent(floatingFocusEl);
          return focusableElements[0] ?? floatingFocusEl;
        };

        let elToFocus: FocusableElement | null | undefined;
        if (resolvedInitialFocus === true || resolvedInitialFocus === null) {
          elToFocus = getDefaultFocusElement();
        } else {
          elToFocus = resolvedInitialFocus;
        }
        elToFocus ??= getDefaultFocusElement();

        const hadFocusInside = contains(floatingFocusEl, activeElement(doc));

        // Screen readers re-sync focus to their cursor right after a synthesized press. A focus
        // that lands a frame later reads as a stray move and gets pulled back to the reference.
        const openEvent = resolved.value.store.context.openEvent;
        const openedByVirtualPress =
          openEvent?.type === 'mousedown' && isVirtualClick(openEvent as MouseEvent);

        // `enqueueFocus` returns a function that cancels the focus. This code does not call it on
        // purpose.
        void enqueueFocus(elToFocus, {
          sync: openedByVirtualPress,
          preventScroll: elToFocus === floatingFocusEl,
          shouldFocus() {
            // If the floating element has closed before this runs — e.g. tabbing out of a
            // kept-mounted popup — don't pull focus back onto the initial element after it has
            // legitimately moved elsewhere.
            if (!open.value) {
              return false;
            }

            if (hadFocusInside) {
              return true;
            }

            const currentActiveElement = activeElement(doc);
            const focusMovedInside =
              currentActiveElement !== elToFocus && contains(floatingFocusEl, currentActiveElement);

            return !focusMovedInside;
          },
        });
      });
    },
  );

  // The return of the focus that the cleanup of the effect below queued. When that effect runs again
  // while the popup is open, a source changed and the cleanup was not a close.
  let pendingReturnFocus: { cancelled: boolean } | null = null;
  // The record stays after the close so a popup below can get the return element of this popup.
  let returnTargets: ReturnTargets | null = null;

  // This function runs in a microtask after the cleanup, or when a popup below closes. Vue can run
  // the cleanup before it removes the reference, so the reference can still be in the document in
  // the cleanup.
  function getReturnElement(
    type: InteractionType,
    activeEl: Element | null,
    targets = returnTargets,
  ) {
    const value = resolveFocusOption(resolved.value.returnFocus, type);

    // `null` uses the default behavior, as an empty ref does.
    if (value === undefined || value === false) {
      return null;
    }

    const doc =
      targets?.doc.deref() ??
      ownerDocument(floatingFocusElement() ?? domReference.value ?? activeEl);
    const recordedBeforeOpen = targets?.elementFocusedBeforeOpen?.deref();
    const previousElement =
      recordedBeforeOpen && getNodeName(recordedBeforeOpen) !== 'body' ? recordedBeforeOpen : null;
    const referenceElement = targets ? targets.domReference?.deref() : domReference.value;
    const preferPreviousFocus = targets?.preferPreviousFocus ?? false;
    const { element, skippedConnected } = findReturnElement(
      [
        value === true ? null : value,
        ...(preferPreviousFocus
          ? [previousElement, referenceElement]
          : [referenceElement, previousElement]),
        parentFocusManager?.getPopupElement(),
      ],
      isInClosedPopup,
    );

    if (skippedConnected && ![activeEl, doc.body].includes(activeElement(doc))) {
      return null;
    }

    // The marker skips elements outside an open popup, such as behind a modal.
    const target =
      element ??
      getPreviouslyFocusedElement(
        (previous) =>
          isInClosedPopup(previous) ||
          closest(previous, `[hidden],[${createAttribute('inert')}]`) !== null,
      );
    return getFirstTabbableElement(target, isInClosedPopup);
  }

  // An open with a disabled focus manager records no targets, so it clears the record of an earlier
  // open.
  effect(
    () => [open.value, isDisabled()],
    () => {
      if (open.value && isDisabled()) {
        returnTargets = null;
      }
    },
  );

  // Record the targets of the return of the focus, and return the focus when the popup closes.
  effect(
    () => [
      isDisabled(),
      floating.value,
      floatingFocusElement(),
      tree.value,
      domReference.value,
      resolved.value.store,
    ],
    () => {
      const floatingEl = floating.value;
      const floatingFocusEl = floatingFocusElement();
      const domReferenceEl = domReference.value;
      const currentTree = tree.value;
      const { events } = resolved.value.store.context;

      if (isDisabled() || !floatingFocusEl) {
        pendingReturnFocus = null;
        return undefined;
      }

      if (pendingReturnFocus) {
        pendingReturnFocus.cancelled = true;
        pendingReturnFocus = null;
      }

      const doc = ownerDocument(floatingFocusEl);
      // A browser moves the focus off an inert element only at its next rendering update, so the record
      // counts a focused inert element as the body. At the open, this effect runs before the effect
      // that sets `inert`. The element that had the focus before the open thus stays a target.
      const currentActiveElement = activeElement(doc);
      const elementFocusedBeforeOpen = closest(currentActiveElement, '[inert]')
        ? doc.body
        : currentActiveElement;
      // Only an explicit `null` interaction type represents a programmatic open.
      // `undefined` is normalized to `''` by the prop default, so it never reaches
      // here as nullish and is intentionally not treated as programmatic.
      const preferPreviousFocus = resolved.value.openInteractionType == null;

      const targets: ReturnTargets = {
        elementFocusedBeforeOpen: elementFocusedBeforeOpen
          ? new WeakRef(elementFocusedBeforeOpen)
          : null,
        domReference: domReferenceEl ? new WeakRef(domReferenceEl) : null,
        preferPreviousFocus,
        doc: new WeakRef(doc),
      };
      returnTargets = targets;

      // Safari and Firefox on macOS don't focus a pressed button, so record the reference instead.
      addPreviouslyFocusedElement(
        elementFocusedBeforeOpen === doc.body && !preferPreviousFocus
          ? domReferenceEl
          : elementFocusedBeforeOpen,
      );

      function onOpenChangeLocal(details: FloatingUIOpenChangeDetails) {
        if (!details.open) {
          closeType = getEventType(details.nativeEvent, lastInteractionType);
        }

        // Focus guards transfer focus themselves; other close handlers may still need return focus.
        if (
          (details.reason === REASONS.focusOut &&
            details.triggerElement?.hasAttribute(createAttribute('focus-guard'))) ||
          (details.reason === REASONS.triggerHover && details.nativeEvent.type === 'mouseleave')
        ) {
          preventReturnFocus = true;
        }

        if (details.reason !== REASONS.outsidePress) {
          return;
        }

        if (details.nested) {
          preventReturnFocus = false;
        } else if (
          isVirtualClick(details.nativeEvent as MouseEvent) ||
          isVirtualPointerEvent(details.nativeEvent as PointerEvent)
        ) {
          preventReturnFocus = false;
        } else {
          // On outside press, only return focus to the reference when the browser supports the
          // `focus({ preventScroll })` option; without it, restoring focus scrolls the page.
          // Chrome on Android and Samsung Internet still don't support `preventScroll`
          // (https://issues.chromium.org/issues/41453122), so the runtime check keeps return
          // focus disabled there to avoid the scroll jump. A target of the consumer is not subject to
          // this check.
          let isPreventScrollSupported = false;
          doc.createElement('div').focus({
            get preventScroll() {
              isPreventScrollSupported = true;
              return false;
            },
          });

          preventReturnFocus = !isPreventScrollSupported && !isReturnFocusExplicit();
        }
      }

      events.on('openchange', onOpenChangeLocal);

      return () => {
        events.off('openchange', onOpenChangeLocal);

        // `KeepAlive` takes the popup and usually its reference out of the document. A return of
        // the focus would then go to an older element of the list.
        if (isHeld.value) {
          preventReturnFocus = false;
          return;
        }

        const activeEl = activeElement(doc);
        const insideElements = getResolvedInsideElements();
        const isFocusInsideFloatingTree =
          contains(floatingEl, activeEl) ||
          contains(floatingFocusEl, activeEl) ||
          insideElements.some((element) => element === activeEl || contains(element, activeEl)) ||
          (currentTree &&
            getNodeChildren(currentTree.nodesRef.value, getNodeId(), false).some((node) =>
              contains(node.context?.elements.floating, activeEl),
            )) ||
          isInClosedPopupBelow(activeEl);
        const type = closeType;

        const job = { cancelled: false };
        pendingReturnFocus = job;

        queueMicrotask(() => {
          if (pendingReturnFocus === job) {
            pendingReturnFocus = null;
          }

          const candidate = job.cancelled ? null : getReturnElement(type, activeEl, targets);
          const returnElement =
            candidate && parentFocusManager
              ? parentFocusManager.getReturnTarget(candidate, type, activeEl)
              : candidate;
          // Read at the close on purpose: the latest `explicitReturnFocus` decides.
          const hasExplicitReturnFocus = isReturnFocusExplicit();

          if (
            !job.cancelled &&
            !preventReturnFocus &&
            isHTMLElement(returnElement) &&
            // If the focus moved somewhere else after mount, avoid returning focus
            // since it likely entered a different element which should be
            // respected: https://github.com/floating-ui/floating-ui/issues/2607
            (!hasExplicitReturnFocus && returnElement !== activeEl && activeEl !== doc.body
              ? isFocusInsideFloatingTree
              : true)
          ) {
            const focusOptions: FocusOptions & { focusVisible?: boolean } = { preventScroll: true };
            if (type === 'keyboard') {
              focusOptions.focusVisible = true;
            }
            returnElement.focus(focusOptions);
          }

          // A cancelled return must also clear suppression before the next close.
          preventReturnFocus = false;
        });
      };
    },
  );

  // Safari may randomly scroll to the bottom of the page if an input inside a popup has focus
  // when the popup unmounts from the DOM.
  // By blurring it before the popup unmounts, we can prevent this behavior.
  effect(
    () => [open.value, floating.value, floatingFocusElement()],
    () => {
      const floatingEl = floating.value;
      if (!platform.engine.webkit || open.value || !floatingEl) {
        return;
      }

      const activeEl = activeElement(ownerDocument(floatingFocusElement() ?? floatingEl));
      if (!isHTMLElement(activeEl) || !isTypeableElement(activeEl)) {
        return;
      }

      if (contains(floatingEl, activeEl) || contains(floatingFocusElement(), activeEl)) {
        activeEl.blur();
      }
    },
  );

  // The portal renders its guards from this state. `KeepAlive` takes the guards of the portal out of
  // the document with the popup, so this effect does not read `isHeld`. The same guards then
  // return at the activation. A trigger writes its guard after the popup opens. That guard is the
  // next focusable element, so whether it exists is a source of this effect too.
  effect(
    () => [
      resolved.value.disabled,
      resolved.value.modal,
      open.value,
      resolved.value.store,
      resolved.value.closeOnFocusOut,
      domReference.value,
      toValue(resolved.value.nextFocusableElement) != null,
    ],
    () => {
      if (resolved.value.disabled || !portalContext) {
        return undefined;
      }

      const store = resolved.value.store;
      portalContext.setFocusManagerState({
        modal: resolved.value.modal,
        closeOnFocusOut: resolved.value.closeOnFocusOut,
        open: open.value,
        onOpenChange: (nextOpen, eventDetails) => store.setOpen(nextOpen, eventDetails),
        domReference: domReference.value,
        hasNextFocusableElement: toValue(resolved.value.nextFocusableElement) != null,
      });

      return () => {
        portalContext.setFocusManagerState(null);
      };
    },
  );

  effect(
    () => [
      beforeGuardElement.value,
      afterGuardElement.value,
      resolved.value.beforeContentFocusGuardRef,
      resolved.value.afterContentFocusGuardRef,
    ],
    () => {
      const before = beforeGuardElement.value;
      const after = afterGuardElement.value;
      const beforeContentRef = resolved.value.beforeContentFocusGuardRef;
      const afterContentRef = resolved.value.afterContentFocusGuardRef;
      if (beforeContentRef) {
        beforeContentRef.value = before;
      }
      if (afterContentRef) {
        afterContentRef.value = after;
      }
      if (portalContext) {
        portalContext.beforeInsideRef.value = before;
        portalContext.afterInsideRef.value = after;
      }

      return () => {
        // A new focus manager can mount before this one unmounts. Each ref thus clears only its own
        // element.
        if (beforeContentRef?.value === before) {
          beforeContentRef.value = null;
        }
        if (afterContentRef?.value === after) {
          afterContentRef.value = null;
        }
        if (portalContext?.beforeInsideRef.value === before) {
          portalContext.beforeInsideRef.value = null;
        }
        if (portalContext?.afterInsideRef.value === after) {
          portalContext.afterInsideRef.value = null;
        }
      };
    },
  );

  effect(
    () => [isDisabled(), floatingFocusElement(), element.value],
    () => {
      const target = floatingFocusElement();
      if (isDisabled() || !target) return;

      // A child component can change the tab stops without updating the popup component.
      const syncTabIndex = () => {
        handleTabIndex(target);
        const managed = managedTabIndex.value !== undefined;
        observer?.observe(target, {
          attributes: true,
          childList: managed,
          subtree: managed,
          attributeFilter: managed
            ? [
                'role',
                'tabindex',
                'hidden',
                'disabled',
                'inert',
                'href',
                'type',
                'contenteditable',
                'controls',
                'open',
                'class',
                'style',
              ]
            : ['role', 'tabindex'],
        });
      };
      const observer =
        target === element.value ? new (ownerWindow(target).MutationObserver)(syncTabIndex) : null;
      syncTabIndex();

      return () => {
        observer?.disconnect();
        managedTabIndex.value = undefined;
        queueMicrotask(clearDisconnectedPreviouslyFocusedElements);
      };
    },
  );

  effect(
    () => [isDisabled(), resolved.value.modal, floatingFocusElement(), location.value.document],
    () => {
      const floatingFocusEl = floatingFocusElement();
      if (isDisabled() || !resolved.value.modal) {
        return undefined;
      }

      function onKeyDown(event: KeyboardEvent) {
        if (event.key === 'Tab') {
          // The focus guards have nothing to focus, so the code must stop the event.
          if (
            contains(floatingFocusEl, activeElement(ownerDocument(floatingFocusEl))) &&
            getTabbableContent(floatingFocusEl).length === 0 &&
            !isUntrappedTypeableCombobox.value
          ) {
            stopEvent(event);
          }
        }
      }

      return addEventListener(ownerDocument(floatingFocusEl), 'keydown', onKeyDown);
    },
  );

  // Track pointer/keyboard interactions to disambiguate focus and outside presses. The last press or
  // key press also gives the type of a close whose event has no pointer type, such as a focus event
  // or a click.
  effect(
    () => [
      isDisabled(),
      open.value,
      floating.value,
      domReference.value,
      floatingFocusElement(),
      location.value.document,
      portalNode.value,
    ],
    () => {
      const floatingEl = floating.value;
      const domReferenceEl = domReference.value;
      const portalEl = portalNode.value;
      if (isDisabled() || !open.value) {
        return undefined;
      }

      const doc = ownerDocument(floatingFocusElement());

      function clearPointerDownOutside() {
        pointerDownOutside = false;
      }

      function onPointerDown(event: PointerEvent) {
        const target = getTarget(event) as Element | null;
        const insideElements = getResolvedInsideElements();
        const pointerTargetInside =
          contains(floatingEl, target) ||
          contains(floatingFocusElement(), target) ||
          contains(domReferenceEl, target) ||
          contains(portalEl, target) ||
          insideElements.some((element) => element === target || contains(element, target));
        pointerDownOutside = !pointerTargetInside;
        lastInteractionType = (event.pointerType as InteractionType) || 'keyboard';

        if (closestInEventPath(event, (node) => clickTriggers.has(node))) {
          isPointerDown = true;
          // Reset on the next tick so a single click on a click-trigger doesn't
          // permanently suppress focus-out closing for the lifetime of the instance.
          pointerDownTimeout.start(0, () => {
            isPointerDown = false;
          });
        }
      }

      function onKeyDown() {
        lastInteractionType = 'keyboard';
      }

      return mergeCleanups(
        addEventListener(doc, 'pointerdown', onPointerDown, true),
        addEventListener(doc, 'pointerup', clearPointerDownOutside, true),
        addEventListener(doc, 'pointercancel', clearPointerDownOutside, true),
        addEventListener(doc, 'keydown', onKeyDown, true),
        // Avoid a stale `true` leaking into the next open (e.g. keep-mounted popups)
        // if the popup dismissed between pointerdown and pointerup.
        clearPointerDownOutside,
      );
    },
  );

  // Close on focus out and restore focus within the floating tree when needed.
  effect(
    () => [
      location.value.document,
      isDisabled(),
      domReference.value,
      floating.value,
      floatingFocusElement(),
      resolved.value.modal,
      tree.value,
      resolved.value.store,
      resolved.value.closeOnFocusOut,
      resolved.value.restoreFocus,
      isUntrappedTypeableCombobox.value,
      toValue(resolved.value.nextFocusableElement),
      toValue(resolved.value.previousFocusableElement),
      isInsidePortal.value,
    ],
    () => {
      const domReferenceEl = domReference.value;
      const floatingEl = floating.value;
      const floatingFocusEl = floatingFocusElement();
      const currentTree = tree.value;
      const { modal, restoreFocus, store } = resolved.value;
      const storeContext = store.context;
      const untrappedTypeableCombobox = isUntrappedTypeableCombobox.value;

      if (isDisabled() || !resolved.value.closeOnFocusOut) {
        return undefined;
      }

      const doc = ownerDocument(floatingFocusEl);

      // In Safari, buttons lose focus when pressing them.
      function handlePointerDown() {
        isPointerDown = true;
        pointerDownTimeout.start(0, () => {
          isPointerDown = false;
        });
      }

      function handleFocusIn(event: FocusEvent) {
        const target = getTarget(event) as FocusableElement | null;
        focusedElement = target;
        if (isTabbable(target)) {
          lastFocusedTabbable = target;
        }
      }

      // Returns `true` for `restoreFocus: 'popup'`, after it focuses the floating element. The
      // caller then stops.
      function restoreLostFocus() {
        // The portal must treat this focus repair as a move inside the popup.
        if (isHTMLElement(floatingFocusEl)) {
          floatingFocusEl.focus();
          // If explicitly requested to restore focus to the popup container, do not search
          // for the next/previous tabbable element.
          if (restoreFocus === 'popup') {
            // If the focused element is removed on pointerdown, the browser
            // tries to move focus to it right after the `.focus()` call above,
            // but because it's removed in the same tick, focus is lost instead.
            // Re-focusing asynchronously (next frame) wins that race, but only
            // while focus is still lost: focus moved elsewhere meanwhile is kept.
            restoreFocusFrame.request(() => {
              const currentActiveElement = activeElement(doc);
              if (currentActiveElement == null || currentActiveElement === doc.body) {
                floatingFocusEl.focus();
              }
            });
            return true;
          }
        }

        const tabbableContent = getTabbableContent(floatingFocusEl) as (Element | null)[];
        const prevTabbable = lastFocusedTabbable;
        const nodeToFocus =
          (prevTabbable && tabbableContent.includes(prevTabbable) ? prevTabbable : null) ??
          tabbableContent.at(-1) ??
          floatingFocusEl;

        if (isHTMLElement(nodeToFocus)) {
          nodeToFocus.focus();
        }
        return false;
      }

      function handleFocusOutside(event: FocusEvent) {
        const relatedTarget = event.relatedTarget as HTMLElement | null;
        const currentTarget = event.currentTarget;
        const target = getTarget(event) as HTMLElement | null;

        // When focus is lost to the body (e.g. on a backdrop press), record the element that
        // had focus so a confirmation dialog opened while the body is focused can return focus
        // to it. Scoped to `modal` to avoid non-modal popups polluting the shared stack.
        if (
          modal &&
          relatedTarget == null &&
          target != null &&
          (contains(floatingEl, target) || contains(floatingFocusEl, target))
        ) {
          addPreviouslyFocusedElement(target);
        }

        queueMicrotask(() => {
          // The focus left an element that stays in the document, so a later removal of that
          // element loses no focus.
          if (target === focusedElement && target?.isConnected) {
            focusedElement = null;
          }

          const nodeId = getNodeId();
          const triggers = storeContext.triggerElements;
          const insideElements = getResolvedInsideElements();
          const isRelatedFocusGuard =
            relatedTarget?.hasAttribute(createAttribute('focus-guard')) &&
            [
              beforeGuardElement.value,
              afterGuardElement.value,
              portalContext?.beforeInsideRef.value,
              portalContext?.afterInsideRef.value,
              portalContext?.beforeOutsideRef.value,
              portalContext?.afterOutsideRef.value,
              toValue(resolved.value.previousFocusableElement),
              toValue(resolved.value.nextFocusableElement),
            ].includes(relatedTarget);

          const movedToUnrelatedNode = !(
            contains(domReferenceEl, relatedTarget) ||
            contains(floatingEl, relatedTarget) ||
            contains(floatingFocusEl, relatedTarget) ||
            contains(relatedTarget, floatingEl) ||
            contains(portalContext?.portalNode.value, relatedTarget) ||
            insideElements.some(
              (element) => element === relatedTarget || contains(element, relatedTarget),
            ) ||
            triggers.hasMatchingElement((trigger) => contains(trigger, relatedTarget)) ||
            isRelatedFocusGuard ||
            (currentTree &&
              (getNodeChildren(currentTree.nodesRef.value, nodeId).find(
                (node) =>
                  contains(node.context?.elements.floating, relatedTarget) ||
                  contains(node.context?.rootStore?.context.popupRef?.value, relatedTarget) ||
                  contains(node.context?.elements.domReference, relatedTarget),
              ) ??
                getNodeAncestors(currentTree.nodesRef.value, nodeId).find(
                  (node) =>
                    [
                      node.context?.elements.floating,
                      getFloatingFocusElement(
                        node.context?.elements.floating,
                        node.context?.rootStore?.context.popupRef?.value,
                      ),
                    ].includes(relatedTarget) ||
                    node.context?.elements.domReference === relatedTarget,
                )))
          );

          if (currentTarget === domReferenceEl && floatingFocusEl) {
            handleTabIndex(floatingFocusEl);
          }

          // Restore focus to the previously focused tabbable element to prevent
          // focus from being lost outside the floating tree.
          if (
            restoreFocus &&
            currentTarget !== domReferenceEl &&
            !isElementVisible(target) &&
            activeElement(doc) === doc.body
          ) {
            const focusedPopup = restoreLostFocus();
            if (focusedPopup) {
              return;
            }
          }

          // https://github.com/floating-ui/floating-ui/issues/3060
          if (storeContext.insideComponentTree) {
            storeContext.insideComponentTree = false;
            return;
          }

          // Focus did not move inside the floating tree, and there are no tabbable
          // portal guards to handle closing.
          if (
            (untrappedTypeableCombobox ? true : !modal) &&
            relatedTarget &&
            movedToUnrelatedNode &&
            !isPointerDown &&
            // For an "untrapped" typeable combobox (input role=combobox with
            // initialFocus=false), re-opening the popup and tabbing out should still close it even
            // when the previously focused element (e.g. the next tabbable outside the popup) is
            // focused again. Otherwise, the popup remains open on the second Tab sequence:
            // click input -> Tab (closes) -> click input -> Tab.
            // Allow closing when `isUntrappedTypeableCombobox` regardless of the previously focused element.
            (untrappedTypeableCombobox || relatedTarget !== getPreviouslyFocusedElement())
          ) {
            preventReturnFocus = true;
            // A popup that stays mounted after it closed (during its exit animation or after
            // `preventUnmountOnClose()`) already reported that close.
            if (store.select('open')) {
              store.setOpen(false, createChangeEventDetails(REASONS.focusOut, event));
            }
          }
        });
      }

      function markInsideComponentTree() {
        if (pointerDownOutside) {
          return;
        }
        storeContext.insideComponentTree = true;
        blurTimeout.start(0, () => {
          storeContext.insideComponentTree = false;
        });
      }

      const anchorElement = isHTMLElement(domReferenceEl) ? domReferenceEl : null;
      const focusContainers = new Set(
        [floatingEl, floatingFocusEl].filter((node): node is HTMLElement => node != null),
      );
      if (!focusContainers.size && !anchorElement) {
        return undefined;
      }

      // Firefox and WebKit send no `focusout` when they remove the focused element, so a removal
      // in the floating element also restores the focus.
      let removalObserver: MutationObserver | null = null;
      if (restoreFocus && focusContainers.size) {
        removalObserver = new MutationObserver(() => {
          if (focusedElement && !focusedElement.isConnected && activeElement(doc) === doc.body) {
            focusedElement = null;
            restoreLostFocus();
          }
        });
        for (const node of focusContainers) {
          removalObserver.observe(node, { childList: true, subtree: true });
        }
      }

      const local = element.value;
      if (local && focusContainers.has(local)) {
        localListeners = {
          focusin: handleFocusIn,
          focusout: handleFocusOutside,
        };
        focusContainers.delete(local);
      }

      return mergeCleanups(
        // A Vue capture listener would stamp the event before a newly mounted target sees it.
        local &&
          localListeners &&
          isInsidePortal.value &&
          addEventListener(local, 'focusout', markInsideComponentTree, true),
        anchorElement && addEventListener(anchorElement, 'focusout', handleFocusOutside),
        anchorElement && addEventListener(anchorElement, 'pointerdown', handlePointerDown),
        ...Array.from(focusContainers, (node) => {
          // The popup and its positioner can move apart. Handle an event at the first one it reaches.
          const fromFirst = (handle: (event: FocusEvent) => void) => (event: FocusEvent) => {
            if (
              node === floatingFocusEl ||
              !floatingFocusEl ||
              !event.composedPath().includes(floatingFocusEl)
            ) {
              handle(event);
            }
          };
          return mergeCleanups(
            addEventListener(node, 'focusin', fromFirst(handleFocusIn)),
            addEventListener(node, 'focusout', fromFirst(handleFocusOutside)),
            isInsidePortal.value &&
              addEventListener(node, 'focusout', fromFirst(markInsideComponentTree), true),
          );
        }),
        () => {
          localListeners = undefined;
        },
        removalObserver && (() => removalObserver.disconnect()),
      );
    },
  );

  // Hide everything outside the floating tree from assistive tech while open. The portal renders
  // its outside guards one update after it gets the state, so they are sources too. A focus manager
  // above can take its marks after this one, for example at a `KeepAlive` activation or when it
  // becomes enabled. Its count is thus a source, and this effect then takes its marks again.
  effect(
    () => [
      open.value,
      isDisabled(),
      domReference.value,
      floating.value,
      resolved.value.modal,
      resolved.value.outsideElementsInert,
      portalNode.value,
      isUntrappedTypeableCombobox.value,
      tree.value,
      toValue(resolved.value.nextFocusableElement),
      toValue(resolved.value.previousFocusableElement),
      beforeGuardElement.value,
      afterGuardElement.value,
      portalContext?.beforeOutsideRef.value,
      portalContext?.afterOutsideRef.value,
      parentMarksCount?.value,
      floatingFocusElement(),
      ...location.value.targets,
      ...getNestedPortals(portalNode.value),
    ],
    () => {
      const floatingEl = floating.value;
      if (isDisabled() || !floatingEl || !open.value) {
        return undefined;
      }

      const portalNodes = getNestedPortals(portalNode.value);

      const currentTree = tree.value;
      const ancestors = currentTree
        ? getNodeAncestors(currentTree.nodesRef.value, getNodeId())
        : [];
      const rootAncestorComboboxDomReference = ancestors.find((node) =>
        isTypeableCombobox(node.context?.elements.domReference ?? null),
      )?.context?.elements.domReference;

      const popupElements = [floatingEl, floatingFocusElement(), ...portalNodes].filter(
        (node): node is Element => node != null,
      );
      const controlInsideElements = [
        ...popupElements,
        beforeGuardElement.value,
        afterGuardElement.value,
        portalContext?.beforeOutsideRef.value,
        portalContext?.afterOutsideRef.value,
        ...getResolvedInsideElements(),
      ];
      const insideElements = [
        ...controlInsideElements,
        rootAncestorComboboxDomReference,
        toValue(resolved.value.previousFocusableElement),
        toValue(resolved.value.nextFocusableElement),
        isUntrappedTypeableCombobox.value ? domReference.value : null,
      ].filter((x): x is Element => x != null);

      const ariaHiddenCleanup = markOthers(insideElements, {
        ariaHidden: resolved.value.modal || isUntrappedTypeableCombobox.value,
        inert: resolved.value.modal && resolved.value.outsideElementsInert,
        mark: false,
      });

      const markerCleanup = markOthers(popupElements);
      marksCount.value += 1;

      return () => {
        markerCleanup();
        ariaHiddenCleanup();
      };
    },
  );

  onMounted(() => {
    watch(() => effects.map((item) => item.sources()), update, { immediate: true, flush: 'post' });
  });
  onScopeDispose(() => {
    for (const item of effects) {
      item.cleanup?.();
      item.cleanup = undefined;
    }
  });

  // The two handlers fall back to the outside guard of the portal when the ref or the getter gives no
  // element. Base UI falls back only when the prop itself is empty, so an empty ref object moves no
  // focus there.
  function handleBeforeGuardFocusin(event: FocusEvent) {
    const portalNode = portalContext?.portalNode.value;
    if (resolved.value.modal) {
      const els = getTabbableContent();
      els.at(-1)?.focus();
    } else if (portalNode) {
      preventReturnFocus = false;
      if (isOutsideEvent(event, portalNode)) {
        getNextTabbable(domReference.value)?.focus();
      } else {
        (
          toValue(resolved.value.previousFocusableElement) ?? portalContext?.beforeOutsideRef.value
        )?.focus();
      }
    }
  }

  function handleAfterGuardFocusin(event: FocusEvent) {
    const portalNode = portalContext?.portalNode.value;
    if (resolved.value.modal) {
      getTabbableContent()[0]?.focus();
    } else if (portalNode) {
      // Only a focus that leaves the popup through this guard stops the return of the focus. After a
      // focus that comes in through it, a close from inside the popup returns the focus.
      if (isOutsideEvent(event, portalNode)) {
        preventReturnFocus = false;
        getPreviousTabbable(domReference.value)?.focus();
      } else {
        if (resolved.value.closeOnFocusOut) {
          preventReturnFocus = true;
        }
        (
          toValue(resolved.value.nextFocusableElement) ?? portalContext?.afterOutsideRef.value
        )?.focus();
      }
    }
  }
  return (attrs: { tabindex?: unknown }) => {
    const index = managedTabIndex.value;
    return index === undefined || attrs.tabindex != null
      ? listeners
      : { ...listeners, tabindex: index, 'data-tabindex': index };
  };
}

type Undo = () => void;

interface MarkOthersOptions {
  ariaHidden?: boolean | undefined;
  /**
   * Whether the outside elements get `inert`, so that the Tab key and a press cannot reach them.
   * They are the elements that `ariaHidden` hides: live regions, their ancestors and scripts do
   * not get it.
   */
  inert?: boolean | undefined;
  mark?: boolean | undefined;
}

const markerName = createAttribute('inert');

interface Mark {
  name: string;
  value: string;
  isSet: (element: Element) => boolean;
}

const MARKS: Mark[] = [
  {
    name: 'aria-hidden',
    value: 'true',
    isSet(element) {
      const attr = element.getAttribute('aria-hidden');
      return attr !== null && attr !== 'false';
    },
  },
  { name: 'inert', value: '', isSet: (element) => element.hasAttribute('inert') },
  { name: markerName, value: '', isSet: (element) => element.hasAttribute(markerName) },
];

interface Lock {
  /** The elements that the lock keeps free of its attributes. */
  avoid: Set<Node>;
  /** The elements of `avoid` and their ancestors. */
  keep: Set<Node>;
  /** The elements that get each attribute, by the name of the attribute. */
  targets: Record<string, Element[]>;
}

interface ModalMarks {
  version: 1;
  /** The locks that are held, the oldest first. */
  locks: Lock[];
  /**
   * The elements that have each attribute because of a lock, by the name of the attribute. An
   * element that had the attribute before is not in the set, and keeps the attribute.
   */
  written: Record<string, Set<Element>>;
}

const MODAL_MARKS_KEY = Symbol.for('vase-ui.modal-marks');

// Two copies of the library on one page mark the same elements, so the key is a `Symbol.for` key.
// With a registry for each copy, the first copy that releases an element removes the attribute
// while the popup of the other copy is still open.
function getModalMarks(): ModalMarks {
  const holder = globalThis as { [MODAL_MARKS_KEY]?: ModalMarks };
  holder[MODAL_MARKS_KEY] ??= {
    version: 1,
    locks: [],
    written: Object.fromEntries(MARKS.map(({ name }) => [name, new Set<Element>()])),
  };
  return holder[MODAL_MARKS_KEY];
}

function unwrapHost(node: Node | null): Element | null {
  if (!node) {
    return null;
  }

  return isShadowRoot(node) ? node.host : unwrapHost(node.parentNode);
}

const correctElements = (parent: HTMLElement, targets: Element[]): Element[] =>
  targets
    .map((target) => {
      if (parent.contains(target)) {
        return target;
      }

      const correctedTarget = unwrapHost(target);

      if (parent.contains(correctedTarget)) {
        return correctedTarget;
      }

      return null;
    })
    .filter((x): x is Element => x != null);

const buildKeepSet = (targets: Element[]): Set<Node> => {
  const keep = new Set<Node>();

  targets.forEach((target) => {
    let node: Node | null = target;
    while (node && !keep.has(node)) {
      keep.add(node);
      node = node.parentNode;
    }
  });

  return keep;
};

const collectOutsideElements = (
  root: Element,
  keepElements: Set<Node>,
  stopElements: Set<Node>,
): Element[] => {
  const outside: Element[] = [];

  const walk = (parent: Element | null) => {
    if (!parent || stopElements.has(parent)) {
      return;
    }

    Array.from(parent.children).forEach((node: Element) => {
      if (getNodeName(node) === 'script') {
        return;
      }

      if (keepElements.has(node)) {
        walk(node);
      } else {
        outside.push(node);
      }
    });
  };

  walk(root);

  return outside;
};

// A lock that is taken later lifts the attributes of the older locks from its own elements and
// their ancestors. Each lifted ancestor passes the attribute to its children that hold no element
// of the lock, so the rest of the page keeps it. Base UI keeps the attributes on these elements,
// and a popup that opens later in a marked container is hidden:
// https://github.com/mui/base-ui/issues/5577
function applyLocks(marks: ModalMarks) {
  MARKS.forEach(({ name, value, isSet }) => {
    const wanted = new Set<Element>();
    marks.locks.forEach((lock) => {
      Array.from(wanted).forEach((element) => {
        if (lock.keep.has(element)) {
          wanted.delete(element);
          collectOutsideElements(element, lock.keep, lock.avoid).forEach((child) => {
            wanted.add(child);
          });
        }
      });
      lock.targets[name]?.forEach((element) => {
        wanted.add(element);
      });
    });

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- `written` has a set for each name in `MARKS`.
    const written = marks.written[name]!;
    written.forEach((element) => {
      if (!wanted.has(element)) {
        element.removeAttribute(name);
        written.delete(element);
      }
    });
    wanted.forEach((element) => {
      if (!written.has(element) && !isSet(element)) {
        element.setAttribute(name, value);
        written.add(element);
      }
    });
  });
}

export function markOthers(avoidElements: Element[], options: MarkOthersOptions = {}): Undo {
  const { ariaHidden = false, inert = false, mark = true } = options;
  const body = ownerDocument(avoidElements[0]).body;
  const avoid = correctElements(body, avoidElements);
  const lock: Lock = { avoid: new Set<Node>(avoid), keep: buildKeepSet(avoid), targets: {} };

  if (mark) {
    lock.targets[markerName] = collectOutsideElements(body, lock.keep, lock.avoid);
  }

  if (ariaHidden || inert) {
    const ariaLiveElements = correctElements(
      body,
      Array.from(body.querySelectorAll('[aria-live]')),
    );
    const controlElements = avoid.concat(ariaLiveElements);
    const controlTargets = collectOutsideElements(
      body,
      buildKeepSet(controlElements),
      new Set<Node>(controlElements),
    );
    if (ariaHidden) {
      lock.targets['aria-hidden'] = controlTargets;
    }
    if (inert) {
      lock.targets.inert = controlTargets;
    }
  }

  const marks = getModalMarks();
  marks.locks.push(lock);
  applyLocks(marks);

  return () => {
    const index = marks.locks.indexOf(lock);
    if (index !== -1) {
      marks.locks.splice(index, 1);
      applyLocks(marks);
    }
  };
}
