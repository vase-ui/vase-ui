<script lang="ts">
import type { ComponentPublicInstance, InjectionKey, MaybeRefOrGetter, Ref, ShallowRef } from 'vue';
import type { InteractionType } from '../../../common/useEnhancedClickHandler';
import type { PopupInteractionStore } from '../types';

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
   * Determines if focus is “modal”, meaning focus is fully trapped inside the
   * floating element and outside content cannot be accessed. This includes
   * screen reader virtual cursors.
   * @default true
   */
  modal?: boolean | undefined;
  /**
   * Whether the last guard of the portal closes the floating element when the Tab key moves the
   * focus out of it. This affects non-modal focus management.
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
}

// The floating element of the focus manager above. A popup that has no node in the popup tree, such
// as a dialog, finds its parent popup through this context.
const ParentPopupElementContext: InjectionKey<() => HTMLElement | null> = Symbol();

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
    const element = previouslyFocusedElements[i].deref();
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

  return tabbable(container)[0] || container;
}

// The first candidate that can take the focus. A candidate that is not in the document, or that is
// hidden, can't take it. A hidden element is, for example, an item in a closed Select or in a
// `keepMounted` Menu. `skippedHidden` tells the caller that the search passed such an element.
function findReturnElement(candidates: Array<Element | null | undefined>) {
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
</script>

<script setup lang="ts">
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
  useTemplateRef,
  watch,
} from 'vue';
import { getNodeName, isHTMLElement } from '@floating-ui/utils/dom';
import { addEventListener } from '../../../common/addEventListener';
import { mergeCleanups } from '../../../common/mergeCleanups';
import { ownerDocument, ownerWindow } from '../../../common/owner';
import { platform } from '../../../common/platform';
import { activeElement, closest, contains, getTarget } from '../../../common/shadowDom';
import { REASONS } from '../../../internals/reasons';
import { resolveElement } from '../../../internals/resolveElement';
import type { FloatingUIOpenChangeDetails } from '../../../internals/types';
import { createAttribute } from '../createAttribute';
import { getFloatingFocusElement, isTypeableCombobox, isTypeableElement } from '../element';
import { isVirtualClick, isVirtualPointerEvent, stopEvent } from '../event';
import { usePortalContext } from '../portal/FloatingPortalContext';
import { useFloatingTree } from '../tree/FloatingTree';
import { getNodeChildren } from '../tree/nodes';
import { enqueueFocus } from './enqueueFocus';
import FocusGuard from './FocusGuard.vue';
import {
  focusable,
  getNextTabbable,
  getPreviousTabbable,
  isOutsideEvent,
  isTabbable,
  tabbable,
} from './tabbable';
import type { FocusableElement } from './tabbable';

const props = withDefaults(defineProps<FloatingFocusManagerProps>(), {
  openInteractionType: '',
  disabled: false,
  initialFocus: true,
  returnFocus: true,
  explicitReturnFocus: undefined,
  modal: true,
  closeOnFocusOut: true,
});

defineSlots<{ default(): unknown }>();

const open = computed(() => props.store.select('open'));
const domReference = computed(() => props.store.select('anchorElement'));
const floating = computed(() => props.store.select('positionerElement'));
const floatingFocusElement = computed(() => getFloatingFocusElement(floating.value));

// A typeable combobox reference (an input or a textarea) with `initialFocus` set to `false` has
// different focus semantics: the focus is not trapped inside the floating element, so a modal
// popup renders no guards.
const isUntrappedTypeableCombobox = computed(
  () => isTypeableCombobox(domReference.value) && props.initialFocus === false,
);

const portalContext = usePortalContext();
const tree = useFloatingTree();

const getParentPopupElement = inject(ParentPopupElementContext, null);
provide(ParentPopupElementContext, () => floatingFocusElement.value);

const getNodeId = () => props.store.context.positioning?.nodeId;

// Whether `KeepAlive` holds the popup. The popup keeps its open state.
const deactivated = shallowRef(false);
const isDisabled = () => props.disabled || deactivated.value;

let preventReturnFocus = false;
let closeType: InteractionType = '';
let lastInteractionType: InteractionType = '';

// A `returnFocus` that is not a boolean is a target of the consumer, unless `explicitReturnFocus`
// says otherwise.
function isReturnFocusExplicit() {
  return props.explicitReturnFocus ?? typeof props.returnFocus !== 'boolean';
}

const beforeGuard = useTemplateRef('beforeGuard');
const afterGuard = useTemplateRef('afterGuard');
const beforeGuardElement = computed(() => beforeGuard.value?.element ?? null);
const afterGuardElement = computed(() => afterGuard.value?.element ?? null);

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

function getTabbableContent(container: Element | null = floatingFocusElement.value) {
  return container ? tabbable(container) : [];
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
    const sources = sourceLists[index];
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

    const doc = ownerDocument(floatingFocusEl);
    const previouslyFocusedElement = activeElement(doc);

    // Wait for the other effects of this update to set `tabindex`.
    queueMicrotask(() => {
      const resolvedInitialFocus = resolveFocusOption(
        props.initialFocus,
        props.openInteractionType || '',
      );

      // This check does not include `null`, because `null` uses the default behavior.
      if (resolvedInitialFocus === undefined || resolvedInitialFocus === false) {
        return;
      }

      const focusAlreadyInsideFloatingEl = contains(floatingFocusEl, previouslyFocusedElement);

      if (focusAlreadyInsideFloatingEl) {
        return;
      }

      let focusableElements: Array<FocusableElement> | null = null;
      const getDefaultFocusElement = () => {
        if (focusableElements == null) {
          focusableElements = getTabbableContent(floatingFocusEl);
        }

        return focusableElements[0] || floatingFocusEl;
      };

      let elToFocus: FocusableElement | null | undefined;
      if (resolvedInitialFocus === true || resolvedInitialFocus === null) {
        elToFocus = getDefaultFocusElement();
      } else {
        elToFocus = resolvedInitialFocus;
      }
      elToFocus = elToFocus || getDefaultFocusElement();

      const hadFocusInside = contains(floatingFocusEl, activeElement(doc));

      // Screen readers re-sync focus to their cursor right after a synthesized press. A focus
      // that lands a frame later reads as a stray move and gets pulled back to the reference.
      const openEvent = props.store.context.openEvent;
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
    props.store,
  ],
  () => {
    const floatingEl = floating.value;
    const floatingFocusEl = floatingFocusElement.value;
    const domReferenceEl = domReference.value;
    const currentTree = tree.value;
    const { events } = props.store.context;

    if (isDisabled() || !floatingFocusEl) {
      pendingReturnFocus = null;
      return undefined;
    }

    if (pendingReturnFocus) {
      pendingReturnFocus.cancelled = true;
      pendingReturnFocus = null;
    }

    const doc = ownerDocument(floatingFocusEl);
    const elementFocusedBeforeOpen = activeElement(doc);
    // Only an explicit `null` interaction type represents a programmatic open.
    // `undefined` is normalized to `''` by the prop default, so it never reaches
    // here as nullish and is intentionally not treated as programmatic.
    const preferPreviousFocus = props.openInteractionType == null;

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
      const value = resolveFocusOption(props.returnFocus, type);

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
// return at the activation.
effect(
  () => [
    props.disabled,
    props.modal,
    open.value,
    props.store,
    props.closeOnFocusOut,
    domReference.value,
  ],
  () => {
    if (props.disabled || !portalContext) {
      return undefined;
    }

    const store = props.store;
    portalContext.setFocusManagerState({
      modal: props.modal,
      closeOnFocusOut: props.closeOnFocusOut,
      open: open.value,
      onOpenChange: (nextOpen, eventDetails) => store.setOpen(nextOpen, eventDetails),
      domReference: domReference.value,
    });

    return () => {
      portalContext.setFocusManagerState(null);
    };
  },
);

effect(
  () => [beforeGuardElement.value, afterGuardElement.value, props.beforeContentFocusGuardRef],
  () => {
    const before = beforeGuardElement.value;
    const after = afterGuardElement.value;
    const beforeContentRef = props.beforeContentFocusGuardRef;
    if (beforeContentRef) {
      beforeContentRef.value = before;
    }
    if (portalContext) {
      portalContext.beforeInsideRef.value = before;
      portalContext.afterInsideRef.value = after;
    }

    return () => {
      // A new focus manager can mount before this one unmounts. Each ref thus clears only its own
      // element.
      if (beforeContentRef && beforeContentRef.value === before) {
        beforeContentRef.value = null;
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
    if (!isDisabled() && floatingFocusEl) {
      handleTabIndex(floatingFocusEl);
    }
  },
);

effect(
  () => [isDisabled(), props.modal, floatingFocusElement.value],
  () => {
    const floatingFocusEl = floatingFocusElement.value;
    if (isDisabled() || !props.modal) {
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

// The last press or key press gives the type of a close whose event has no pointer type, such as a
// focus event or a click.
effect(
  () => [isDisabled(), open.value, floatingFocusElement.value],
  () => {
    if (isDisabled() || !open.value) {
      return undefined;
    }

    const doc = ownerDocument(floatingFocusElement.value);

    function onPointerDown(event: PointerEvent) {
      lastInteractionType = (event.pointerType as InteractionType) || 'keyboard';
    }

    function onKeyDown() {
      lastInteractionType = 'keyboard';
    }

    return mergeCleanups(
      addEventListener(doc, 'pointerdown', onPointerDown, true),
      addEventListener(doc, 'keydown', onKeyDown, true),
    );
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

const shouldRenderGuards = computed(
  () =>
    !props.disabled &&
    (props.modal ? !isUntrappedTypeableCombobox.value : true) &&
    (portalContext != null || props.modal),
);

// The two handlers fall back to the outside guard of the portal when the ref or the getter gives no
// element. Base UI falls back only when the prop itself is empty, so an empty ref object moves no
// focus there.
function handleBeforeGuardFocusin(event: FocusEvent) {
  const portalNode = portalContext?.portalNode.value;
  if (props.modal) {
    const els = getTabbableContent();
    els[els.length - 1]?.focus();
  } else if (portalNode) {
    preventReturnFocus = false;
    if (isOutsideEvent(event, portalNode)) {
      getNextTabbable(domReference.value)?.focus();
    } else {
      (toValue(props.previousFocusableElement) ?? portalContext?.beforeOutsideRef.value)?.focus();
    }
  }
}

function handleAfterGuardFocusin(event: FocusEvent) {
  const portalNode = portalContext?.portalNode.value;
  if (props.modal) {
    getTabbableContent()[0]?.focus();
  } else if (portalNode) {
    if (props.closeOnFocusOut) {
      preventReturnFocus = true;
    }

    if (isOutsideEvent(event, portalNode)) {
      getPreviousTabbable(domReference.value)?.focus();
    } else {
      (toValue(props.nextFocusableElement) ?? portalContext?.afterOutsideRef.value)?.focus();
    }
  }
}
</script>

<template>
  <FocusGuard
    v-if="shouldRenderGuards"
    ref="beforeGuard"
    data-type="inside"
    @focusin="handleBeforeGuardFocusin"
  />
  <slot />
  <FocusGuard
    v-if="shouldRenderGuards"
    ref="afterGuard"
    data-type="inside"
    @focusin="handleAfterGuardFocusin"
  />
</template>
