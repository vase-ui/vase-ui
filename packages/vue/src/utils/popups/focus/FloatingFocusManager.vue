<script lang="ts">
import type { ComponentPublicInstance, MaybeRefOrGetter, Ref, ShallowRef } from 'vue';
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
  onActivated,
  onDeactivated,
  onMounted,
  onScopeDispose,
  shallowRef,
  toValue,
  unref,
  useTemplateRef,
  watch,
} from 'vue';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { addEventListener } from '../../../common/addEventListener';
import { ownerDocument } from '../../../common/owner';
import { platform } from '../../../common/platform';
import { activeElement, contains } from '../../../common/shadowDom';
import { resolveElement } from '../../../internals/resolveElement';
import { getFloatingFocusElement, isTypeableCombobox, isTypeableElement } from '../element';
import { isVirtualClick, stopEvent } from '../event';
import { usePortalContext } from '../portal/FloatingPortalContext';
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

// Whether `KeepAlive` holds the popup. The popup keeps its open state.
const deactivated = shallowRef(false);
const isDisabled = () => props.disabled || deactivated.value;

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

      let focusableElements: FocusableElement[] | null = null;
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
      elToFocus ||= getDefaultFocusElement();

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
