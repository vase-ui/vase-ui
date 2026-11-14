import {
  computed,
  inject,
  onActivated,
  onDeactivated,
  onMounted,
  onScopeDispose,
  provide,
  shallowRef,
  toValue,
  unref,
  watch,
} from 'vue';
import type { ComponentPublicInstance, InjectionKey, MaybeRefOrGetter, Ref, ShallowRef } from 'vue';
import { getNodeName, isHTMLElement } from '@floating-ui/utils/dom';
import { addEventListener } from '../../../common/addEventListener';
import { mergeCleanups } from '../../../common/mergeCleanups';
import { ownerDocument, ownerWindow } from '../../../common/owner';
import { platform } from '../../../common/platform';
import { activeElement, closest, contains, getTarget } from '../../../common/shadowDom';
import { useAnimationFrame } from '../../../common/useAnimationFrame';
import type { InteractionType } from '../../../common/useEnhancedClickHandler';
import { useTimeout } from '../../../common/useTimeout';
import { isElementVisible } from '../../../internals/composite/listIndex';
import { CLICK_TRIGGER_IDENTIFIER } from '../../../internals/constants';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { resolveElement } from '../../../internals/resolveElement';
import type { FloatingUIOpenChangeDetails } from '../../../internals/types';
import { createAttribute } from '../createAttribute';
import { getFloatingFocusElement, isTypeableCombobox, isTypeableElement } from '../element';
import { isVirtualClick, isVirtualPointerEvent, stopEvent } from '../event';
import { usePortalContext } from '../portal/FloatingPortalContext';
import { useFloatingTree } from '../tree/FloatingTree';
import type { FloatingTreeStore } from '../tree/FloatingTreeStore';
import { getNodeAncestors, getNodeChildren } from '../tree/nodes';
import type { PopupInteractionStore } from '../types';
import { createFocusGuardElement } from './createFocusGuardElement';
import { enqueueFocus } from './enqueueFocus';
import { markOthers } from './markOthers';
import {
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
export interface FloatingFocusManagerProps {
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
   * The default behavior is to focus the first of these elements that can take the focus: the
   * reference, the element that had the focus before the floating element opened, the floating
   * element of the focus manager above, and the newest element that had the focus before an open.
   * When `openInteractionType` is `null`, the element that had the focus comes before the reference.
   * An element that is not in the document, or that has the `hidden` attribute or an ancestor with
   * it, cannot take the focus.
   *
   * - `false`: Do not move the focus.
   * - `true`: Move the focus based on the default behavior.
   * - An element, a component, or a ref of one: Move the focus to that element. When it cannot take
   *   the focus, the default behavior applies. `null` and an empty ref use the default behavior.
   * - A function: Called with the type of the interaction that closed the floating element (`mouse`,
   *   `touch`, `pen`, or `keyboard`). The type is an empty string when no event of the user closed
   *   it. Return an element to focus, `true` or `null` to use the default behavior, or `false` or
   *   `undefined` to do nothing.
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

// The floating element of the focus manager above. A popup that has no node in the popup tree, such
// as a dialog, finds its parent popup through this context.
const ParentPopupElementContext: InjectionKey<() => HTMLElement | null> = Symbol();

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

function getPreviouslyFocusedElement(skipHidden?: boolean) {
  clearDisconnectedPreviouslyFocusedElements();
  for (let i = previouslyFocusedElements.length - 1; i >= 0; i -= 1) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The loop runs from the last index to 0.
    const element = previouslyFocusedElements[i]!.deref();
    // The marker skips elements outside an open popup, such as behind a modal.
    if (!skipHidden || !closest(element, `[hidden],[${createAttribute('inert')}]`)) {
      return element;
    }
  }
  return undefined;
}

function getFirstTabbableElement(container: Element | null) {
  if (!container) {
    return null;
  }

  if (isTabbable(container)) {
    return container;
  }

  return tabbable(container)[0] ?? container;
}

// The first candidate that can take the focus. A candidate that is not in the document, or that is
// hidden, can't take it. A hidden element is, for example, an item in a closed Select or in a
// `keepMounted` Menu. `skippedHidden` tells the caller that the search passed such an element.
function findReturnElement(candidates: (Element | null | undefined)[]) {
  let skippedHidden = false;
  for (const candidate of candidates) {
    if (candidate?.isConnected) {
      if (!closest(candidate, '[hidden]')) {
        return { element: candidate, skippedHidden };
      }
      skippedHidden = true;
    }
  }
  return { element: null, skippedHidden };
}

function handleTabIndex(floatingFocusElement: HTMLElement) {
  if (
    floatingFocusElement.hasAttribute('tabindex') &&
    !floatingFocusElement.hasAttribute('data-tabindex')
  ) {
    return;
  }

  if (!floatingFocusElement.getAttribute('role')?.includes('dialog')) {
    return;
  }

  const focusableElements = focusable(floatingFocusElement);
  const tabbableContent = focusableElements.filter((element) => {
    const dataTabIndex = element.getAttribute('data-tabindex') || '';
    return (
      isTabbable(element) ||
      (element.hasAttribute('data-tabindex') && !dataTabIndex.startsWith('-'))
    );
  });
  const tabIndex = floatingFocusElement.getAttribute('tabindex');

  if (tabbableContent.length === 0) {
    if (tabIndex !== '0') {
      floatingFocusElement.setAttribute('tabindex', '0');
      // Mark our own write so the externally-managed early-return above doesn't
      // mistake it for a user-authored `tabindex` and freeze management.
      floatingFocusElement.setAttribute('data-tabindex', '0');
    }
  } else if (
    tabIndex !== '-1' ||
    (floatingFocusElement.hasAttribute('data-tabindex') &&
      floatingFocusElement.getAttribute('data-tabindex') !== '-1')
  ) {
    floatingFocusElement.setAttribute('tabindex', '-1');
    floatingFocusElement.setAttribute('data-tabindex', '-1');
  }
}

// A default applies only to `undefined`, as `withDefaults` does. `null` has its own meaning for
// `openInteractionType` and `returnFocus`.
function withDefault<Value, Default>(value: Value | undefined, defaultValue: Default) {
  return value === undefined ? defaultValue : value;
}

function withDefaultProps(props: FloatingFocusManagerProps) {
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
export function useFloatingFocusManager(
  props: () => FloatingFocusManagerProps,
  element: Readonly<Ref<HTMLElement | null>>,
): void {
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
  const floatingFocusElement = computed(() => getFloatingFocusElement(floating.value));

  // A typeable combobox reference (an input or a textarea) with `initialFocus` set to `false` has
  // different focus semantics: the focus is not trapped inside the floating element, so a modal
  // popup has no guards. The elements outside still get `aria-hidden`.
  const isUntrappedTypeableCombobox = computed(
    () => isTypeableCombobox(domReference.value) && resolved.value.initialFocus === false,
  );

  const portalContext = usePortalContext();
  const portalNode = computed(() => portalContext?.portalNode.value ?? null);
  const tree = useFloatingTree(() => resolved.value.externalTree);

  const getParentPopupElement = inject(ParentPopupElementContext, null);
  provide(ParentPopupElementContext, () => floatingFocusElement.value);

  const parentMarksCount = inject(ParentMarksCountContext, null);
  const marksCount = shallowRef(0);
  // The sum also tells the focus managers below about a take above a focus manager that holds no
  // marks.
  provide(
    ParentMarksCountContext,
    computed(() => (parentMarksCount?.value ?? 0) + marksCount.value),
  );

  const getNodeId = () => resolved.value.store.context.positioning?.nodeId;

  // Whether `KeepAlive` holds the popup. The popup keeps its open state.
  const deactivated = shallowRef(false);
  const isDisabled = () => resolved.value.disabled || deactivated.value;

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
      (portalContext != null || resolved.value.modal),
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

  // Vue can run the effects before `useElementSiblings` puts the guards in the document. An effect
  // thus gets a guard only while the guard is in the document. Each run of the marks then gives the
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
  function getTabbableContent(container: Element | null = floatingFocusElement.value) {
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
    lastSources?: unknown[];
    cleanup?: Cleanup;
  }

  // The effects keep the sequence of the effects of Base UI: the layout effects of the file, then its
  // other effects. Vue runs two `watch` calls of one component in the sequence of the writes to their
  // sources, so one `watch` calls `update`. `update` runs each effect whose sources changed, in the
  // sequence of the list.
  const effects: Effect[] = [];

  function effect(sources: Effect['sources'], setup: Effect['setup']) {
    effects.push({ sources, setup });
  }

  const readSources = () => effects.map((item) => item.sources());

  function update(sourceLists: unknown[][]) {
    effects.forEach((item, index) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- `sourceLists` has one list for each effect.
      const sources = sourceLists[index]!;
      const lastSources = item.lastSources;
      if (
        !lastSources ||
        sources.some((value, position) => !Object.is(value, lastSources[position]))
      ) {
        item.lastSources = sources;
        item.cleanup?.();
        item.cleanup = item.setup();
      }
    });
  }

  effect(
    () => [open.value, isDisabled(), floatingFocusElement.value],
    () => {
      const floatingFocusEl = floatingFocusElement.value;
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

  // Record the targets of the return of the focus, and return the focus when the popup closes.
  effect(
    () => [
      isDisabled(),
      floating.value,
      floatingFocusElement.value,
      tree.value,
      domReference.value,
      resolved.value.store,
    ],
    () => {
      const floatingEl = floating.value;
      const floatingFocusEl = floatingFocusElement.value;
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

      // This function runs in a microtask after the cleanup. Vue can run the cleanup before it
      // removes the reference, so the reference can still be in the document in the cleanup.
      function getReturnElement(type: InteractionType, activeEl: Element | null) {
        const value = resolveFocusOption(resolved.value.returnFocus, type);

        // `null` uses the default behavior, as an empty ref does.
        if (value === undefined || value === false) {
          return null;
        }

        const previousElement =
          elementFocusedBeforeOpen && getNodeName(elementFocusedBeforeOpen) !== 'body'
            ? elementFocusedBeforeOpen
            : null;
        const { element, skippedHidden } = findReturnElement([
          value === true ? null : value,
          ...(preferPreviousFocus
            ? [previousElement, domReferenceEl]
            : [domReferenceEl, previousElement]),
          getParentPopupElement?.(),
        ]);

        // Use the next element instead of a hidden one, unless the closing update already moved the
        // focus (e.g. `autofocus`).
        if (skippedHidden && ![activeEl, doc.body].includes(activeElement(doc))) {
          return null;
        }

        // `element` if it is tabbable, otherwise its first tabbable child, otherwise `element`
        // itself (which may not be tabbable at all).
        return getFirstTabbableElement(element ?? getPreviouslyFocusedElement(true) ?? null);
      }

      return () => {
        events.off('openchange', onOpenChangeLocal);

        // `KeepAlive` takes the popup and usually its reference out of the document. A return of
        // the focus would then go to an older element of the list.
        if (deactivated.value) {
          preventReturnFocus = false;
          return;
        }

        const activeEl = activeElement(doc);
        const isFocusInsideFloatingTree =
          contains(floatingEl, activeEl) ||
          (currentTree &&
            getNodeChildren(currentTree.nodesRef.value, getNodeId(), false).some((node) =>
              contains(node.context?.elements.floating, activeEl),
            ));
        const type = closeType;

        const job = { cancelled: false };
        pendingReturnFocus = job;

        queueMicrotask(() => {
          if (pendingReturnFocus === job) {
            pendingReturnFocus = null;
          }

          const returnElement = job.cancelled ? null : getReturnElement(type, activeEl);
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
    () => [open.value, floating.value],
    () => {
      const floatingEl = floating.value;
      if (!platform.engine.webkit || open.value || !floatingEl) {
        return;
      }

      const activeEl = activeElement(ownerDocument(floatingEl));
      if (!isHTMLElement(activeEl) || !isTypeableElement(activeEl)) {
        return;
      }

      if (contains(floatingEl, activeEl)) {
        activeEl.blur();
      }
    },
  );

  // The portal renders its guards from this state. `KeepAlive` takes the guards of the portal out of
  // the document with the popup, so this effect does not read `deactivated`. The same guards then
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
    () => [isDisabled(), floatingFocusElement.value],
    () => {
      const floatingFocusEl = floatingFocusElement.value;
      if (isDisabled() || !floatingFocusEl) {
        return undefined;
      }

      handleTabIndex(floatingFocusEl);

      return () => {
        queueMicrotask(clearDisconnectedPreviouslyFocusedElements);
      };
    },
  );

  effect(
    () => [isDisabled(), resolved.value.modal, floatingFocusElement.value],
    () => {
      const floatingFocusEl = floatingFocusElement.value;
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
      floatingFocusElement.value,
      portalNode.value,
    ],
    () => {
      const floatingEl = floating.value;
      const domReferenceEl = domReference.value;
      const portalEl = portalNode.value;
      if (isDisabled() || !open.value) {
        return undefined;
      }

      const doc = ownerDocument(floatingFocusElement.value);

      function clearPointerDownOutside() {
        pointerDownOutside = false;
      }

      function onPointerDown(event: PointerEvent) {
        const target = getTarget(event) as Element | null;
        const insideElements = getResolvedInsideElements();
        const pointerTargetInside =
          contains(floatingEl, target) ||
          contains(domReferenceEl, target) ||
          contains(portalEl, target) ||
          insideElements.some((element) => element === target || contains(element, target));
        pointerDownOutside = !pointerTargetInside;
        lastInteractionType = (event.pointerType as InteractionType) || 'keyboard';

        if (closest(target, `[${CLICK_TRIGGER_IDENTIFIER}]`)) {
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
      isDisabled(),
      domReference.value,
      floating.value,
      floatingFocusElement.value,
      resolved.value.modal,
      tree.value,
      resolved.value.store,
      resolved.value.closeOnFocusOut,
      resolved.value.restoreFocus,
      isUntrappedTypeableCombobox.value,
      toValue(resolved.value.nextFocusableElement),
      toValue(resolved.value.previousFocusableElement),
    ],
    () => {
      const domReferenceEl = domReference.value;
      const floatingEl = floating.value;
      const floatingFocusEl = floatingFocusElement.value;
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
        // Let `FloatingPortal` effect knows that focus is still inside the
        // floating tree.
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
        if (modal && relatedTarget == null && target != null && contains(floatingEl, target)) {
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
                  contains(node.context?.elements.domReference, relatedTarget),
              ) ??
                getNodeAncestors(currentTree.nodesRef.value, nodeId).find(
                  (node) =>
                    [
                      node.context?.elements.floating,
                      getFloatingFocusElement(node.context?.elements.floating),
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
      if (!floatingEl && !anchorElement) {
        return undefined;
      }

      // Firefox and WebKit send no `focusout` when they remove the focused element, so a removal
      // in the floating element also restores the focus.
      let removalObserver: MutationObserver | null = null;
      if (restoreFocus && floatingEl) {
        removalObserver = new MutationObserver(() => {
          if (focusedElement && !focusedElement.isConnected && activeElement(doc) === doc.body) {
            focusedElement = null;
            restoreLostFocus();
          }
        });
        removalObserver.observe(floatingEl, { childList: true, subtree: true });
      }

      return mergeCleanups(
        anchorElement && addEventListener(anchorElement, 'focusout', handleFocusOutside),
        anchorElement && addEventListener(anchorElement, 'pointerdown', handlePointerDown),
        floatingEl && addEventListener(floatingEl, 'focusin', handleFocusIn),
        floatingEl && addEventListener(floatingEl, 'focusout', handleFocusOutside),
        floatingEl &&
          portalContext &&
          addEventListener(floatingEl, 'focusout', markInsideComponentTree, true),
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
    ],
    () => {
      const floatingEl = floating.value;
      if (isDisabled() || !floatingEl || !open.value) {
        return undefined;
      }

      // Don't hide portals nested within the parent portal.
      const portalNodes = Array.from(
        portalNode.value?.querySelectorAll(`[${createAttribute('portal')}]`) ?? [],
      );

      const currentTree = tree.value;
      const ancestors = currentTree
        ? getNodeAncestors(currentTree.nodesRef.value, getNodeId())
        : [];
      const rootAncestorComboboxDomReference = ancestors.find((node) =>
        isTypeableCombobox(node.context?.elements.domReference ?? null),
      )?.context?.elements.domReference;

      const controlInsideElements = [
        floatingEl,
        ...portalNodes,
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

      const markerInsideElements = [floatingEl, ...portalNodes].filter(
        (x): x is Element => x != null,
      );
      const markerCleanup = markOthers(markerInsideElements);
      marksCount.value += 1;

      return () => {
        markerCleanup();
        ariaHiddenCleanup();
      };
    },
  );

  onMounted(() => update(readSources()));
  watch(readSources, update, { flush: 'post' });

  // Each hook writes only the flag. The `watch` then runs `update` after the DOM update of the hook.
  // At the activation, the portal has put the popup back by then.
  onDeactivated(() => {
    deactivated.value = true;
  });
  onActivated(() => {
    deactivated.value = false;
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
}
