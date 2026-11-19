<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface ToastViewportState {
  /**
   * Whether toasts are expanded in the viewport.
   */
  expanded: boolean;
}

export interface ToastViewportProps
  extends
    VaseUIComponentProps<ToastViewportState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed, provide, watch } from 'vue';
import type { Component } from 'vue';
import { addEventListener } from '../../common/addEventListener';
import { mergeCleanups } from '../../common/mergeCleanups';
import { ownerDocument, ownerWindow } from '../../common/owner';
import { activeElement, contains, getTarget } from '../../common/shadowDom';
import { useTimeout } from '../../common/useTimeout';
import { visuallyHidden } from '../../common/visuallyHidden';
import type { HTMLProps } from '../../internals/types';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { useRenderElement } from '../../internals/useRenderElement';
import { createFocusGuardElement } from '../../utils/popups/focus/createFocusGuardElement';
import { useElementSiblings } from '../../utils/popups/focus/useElementSiblings';
import type { ElementSiblings } from '../../utils/popups/focus/useElementSiblings';
import { useToastProviderContext } from '../provider/ToastProviderContext';
import { useToastEscape } from '../utils/useToastEscape';
import { matchesFocusVisible } from '../../utils/popups/element';
import ToastViewportChildren from './ToastViewportChildren.vue';
import { ToastViewportContext } from '../provider/ToastProviderContext';
import * as ToastViewportCssVars from './ToastViewportCssVars';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToastViewportProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ToastViewportState }): unknown;
  render(props: { props: HTMLProps; state: ToastViewportState; children: Component }): unknown;
}>();

const store = useToastProviderContext();
const windowFocusTimeout = useTimeout();

let markedReadyForMouseLeave = false;
let touchActive = false;

const isEmpty = computed(() => store.toasts.value.length === 0);
const { toasts, expanded } = store;
const frontmostHeight = computed(() => toasts.value[0]?.height);

const hasTransitioningToasts = computed(() =>
  toasts.value.some((toast) => toast.transitionStatus === 'ending'),
);
const highPriorityToasts = computed(() =>
  toasts.value.filter((toast) => toast.priority === 'high'),
);
const hasFocusGuards = computed(() => !isEmpty.value && store.state.prevFocusElement !== null);
const hasAlerts = computed(() => !store.state.focused && highPriorityToasts.value.length > 0);

// `KeepAlive` takes the element out of the document, so the listeners wait until it comes back.
const { isHeld } = useKeepAliveState();

function handleFocusGuard(event: FocusEvent) {
  const { viewport, toasts: currentToasts } = store.state;
  // If we're coming off the container, move to the first toast that can hold
  // focus, skipping toasts that are animating out or inert because they're limited.
  const firstFocusableToast =
    event.relatedTarget === viewport
      ? currentToasts.find((toast) => toast.transitionStatus !== 'ending' && !toast.limited)
      : undefined;

  if (firstFocusableToast) {
    firstFocusableToast.ref?.value?.focus();
  } else {
    store.restoreFocusToPrevElement();
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented) {
    return;
  }

  const isF6 = event.key === 'F6';
  if (isF6) {
    // Keep F6 pressed inside the viewport away from the global F6 listeners (including this
    // one's), which would pull focus back to the viewport. Without a return target, leave the
    // default action to the browser.
    event.stopPropagation();
  }

  const isEscape = isToastEscape(event);
  if (
    (isF6 ||
      isEscape ||
      (event.key === 'Tab' && event.shiftKey && getTarget(event) === store.state.viewport)) &&
    store.state.prevFocusElement &&
    store.restoreFocusToPrevElement()
  ) {
    if (isEscape) {
      // The focus was in the viewport, so the viewport owns this Escape. A popup under the toasts,
      // such as a modal dialog, listens for Escape on the document. It must not close for the same
      // press (VUE-130).
      event.stopPropagation();
    } else {
      // Cancel only if focus moved: a hidden or disabled return target leaves the
      // browser free to move focus. `handleFocusout` resumes the timers.
      event.preventDefault();
    }
  }
}

function flushMouseLeave() {
  if (hasTransitioningToasts.value || touchActive || !markedReadyForMouseLeave) {
    return;
  }

  // Apply any mouseleave that was deferred until transitions finished.
  store.setHovering(false);
  markedReadyForMouseLeave = false;
}

watch(hasTransitioningToasts, flushMouseLeave, { flush: 'post' });

function handleDocumentMouseover(event: MouseEvent) {
  if (store.state.hovering && !contains(store.state.viewport, getTarget(event) as Element | null)) {
    handleMouseleave();
  }
}

function handleMouseenter() {
  store.pauseTimers();
  store.setHovering(true);
  markedReadyForMouseLeave = false;
}

function handleMouseleave() {
  // Defer to `flushMouseLeave`: while toasts are transitioning out or a touch gesture is active it
  // records the intent and collapses later; otherwise it collapses immediately.
  markedReadyForMouseLeave = true;
  flushMouseLeave();
}

function handlePointerdown(event: PointerEvent) {
  if (event.pointerType === 'touch') {
    touchActive = true;
  }
}

function handlePointerEnd(event: PointerEvent) {
  if (event.pointerType !== 'touch') {
    return;
  }

  touchActive = false;
  flushMouseLeave();
}

function handleFocusin() {
  if (store.state.focused) {
    return;
  }

  // Only set focused when the active element is focus-visible.
  // This prevents the viewport from staying expanded when clicking inside without
  // keyboard navigation.
  const activeEl = activeElement(ownerDocument(store.state.viewport));
  if (contains(store.state.viewport, activeEl) && matchesFocusVisible(activeEl)) {
    store.setFocused(true);
  }
}

function handleFocusout(event: FocusEvent) {
  if (
    !store.state.focused ||
    contains(store.state.viewport, event.relatedTarget as HTMLElement | null)
  ) {
    return;
  }

  store.setFocused(false);
}

const state = computed<ToastViewportState>(() => ({ expanded: expanded.value }));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  ref: store.setViewport,
  children: true,
  props: (attrs) => [
    {
      tabindex: -1,
      role: 'region',
      'aria-live': 'polite',
      'aria-atomic': false,
      'aria-relevant': 'additions text',
      'aria-label': 'Notifications',
      onMouseenter: handleMouseenter,
      onMousemove: handleMouseenter,
      onMouseleave: handleMouseleave,
      onFocusin: handleFocusin,
      onFocusout: handleFocusout,
      onKeydown: handleKeydown,
      onClick: handleFocusin,
      onPointerdown: handlePointerdown,
      onPointerup: handlePointerEnd,
      onPointercancel: handlePointerEnd,
      style: {
        [ToastViewportCssVars.frontmostHeight]: frontmostHeight.value
          ? `${frontmostHeight.value}px`
          : undefined,
      },
    },
    attrs,
  ],
});

const isToastEscape = useToastEscape(() => element.value, isHeld);

// Sibling nodes keep the viewport eligible for v-show and Transition.
const viewportDocument = computed(() => element.value?.ownerDocument);
const outerGuard = computed(() => {
  if (!viewportDocument.value) return null;
  const guard = createFocusGuardElement(viewportDocument.value);
  guard.addEventListener('focusin', handleFocusGuard);
  return guard;
});
const alertTarget = computed(() => {
  if (!viewportDocument.value) return null;
  const region = viewportDocument.value.createElement('div');
  Object.assign(region.style, visuallyHidden);
  return region;
});
const alertRegion = computed(() => (hasAlerts.value ? alertTarget.value : null));
const siblings = computed<ElementSiblings | null>(() => {
  const guard = hasFocusGuards.value ? outerGuard.value : null;
  const region = alertRegion.value;
  return guard || region ? { before: guard ? [guard] : [], after: region ? [region] : [] } : null;
});
useElementSiblings(element, siblings);
provide(ToastViewportContext, {
  hasFocusGuards,
  handleFocusGuard,
  alertRegion,
  highPriorityToasts,
});

function isFrame(node: Element | null): node is HTMLIFrameElement {
  // An element of a frame belongs to the realm of the frame, so `instanceof` is false for it.
  return node?.localName === 'iframe';
}

// The window of the deepest frame of the same origin in the chain of focused frames. A frame of
// another origin has no `contentDocument`.
function getFocusedFrameWindow(doc: Document): Window | null {
  let frameWindow: Window | null = null;
  let focusedElement = activeElement(doc);
  while (isFrame(focusedElement) && focusedElement.contentDocument) {
    const frameDocument = focusedElement.contentDocument;
    frameWindow = frameDocument.defaultView;
    focusedElement = activeElement(frameDocument);
  }
  return frameWindow;
}

// A toast added while the page lacks focus must start with its timer paused.
watch(
  [element, isHeld],
  ([viewport, held], _previous, onCleanup) => {
    if (!viewport || held) {
      return;
    }

    const win = ownerWindow(viewport);
    const doc = ownerDocument(viewport);
    // eslint-disable-next-line no-restricted-syntax -- This watcher moves its listeners to the frame that has focus.
    let removeFrameListeners: (() => void) | undefined;

    function markWindowBlurred() {
      windowFocusTimeout.clear();
      store.setWindowFocused(false);
    }

    // While a frame has the focus, the window gets no `blur` and no `focus` when the page loses or
    // gets the focus. Only the window of the frame gets them.
    function listenToFocusedFrame() {
      removeFrameListeners?.();
      const frameWindow = getFocusedFrameWindow(doc);
      removeFrameListeners = frameWindow
        ? mergeCleanups(
            addEventListener(frameWindow, 'blur', handleFrameBlur, true),
            addEventListener(frameWindow, 'focus', handleFrameFocus, true),
          )
        : undefined;
    }

    // Focus that goes into a frame of the page blurs the window, but the page keeps the focus.
    // Firefox reports no focus for the page while it sends the event, so the check comes after.
    function checkFocusInFrame() {
      if (doc.hasFocus() && isFrame(activeElement(doc))) {
        store.setWindowFocused(true);
      }
      listenToFocusedFrame();
    }

    function handleWindowBlur(event: FocusEvent) {
      if (getTarget(event) !== win) {
        return;
      }

      markWindowBlurred();
      windowFocusTimeout.start(0, checkFocusInFrame);
    }

    function handleWindowFocus(event: FocusEvent) {
      if (event.relatedTarget) {
        return;
      }

      // This capture listener also sees element focus, e.g. a click on a toast while nothing
      // had focus. Wait for `handleFocusin` so keyboard focus inside the viewport keeps the pause,
      // and resume after the flag flips so toasts added in between start running too.
      // The timer replaces the check that the `blur` of a frame starts, so it also follows the
      // focused frame.
      windowFocusTimeout.start(0, () => {
        store.setWindowFocused(true);
        listenToFocusedFrame();
      });
    }

    function handleFrameBlur(event: FocusEvent) {
      if (event.target !== event.currentTarget) {
        return;
      }

      markWindowBlurred();
      windowFocusTimeout.start(0, checkFocusInFrame);
    }

    function handleFrameFocus(event: FocusEvent) {
      if (event.target !== event.currentTarget) {
        return;
      }

      windowFocusTimeout.start(0, checkFocusInFrame);
    }

    function handleVisibilitychange() {
      if (doc.visibilityState === 'hidden') {
        markWindowBlurred();
        return;
      }

      // The window gets no `focus` when a frame has the focus, and a frame of another origin sends
      // no event to the page. A frame that has the focus thus lets the timers continue.
      windowFocusTimeout.start(0, () => {
        if (doc.hasFocus() || isFrame(activeElement(doc))) {
          store.setWindowFocused(true);
        }
        listenToFocusedFrame();
      });
    }

    if (doc.visibilityState === 'hidden') {
      markWindowBlurred();
    }
    listenToFocusedFrame();

    onCleanup(
      mergeCleanups(
        addEventListener(win, 'blur', handleWindowBlur, true),
        addEventListener(win, 'focus', handleWindowFocus, true),
        addEventListener(doc, 'visibilitychange', handleVisibilitychange),
        () => {
          removeFrameListeners?.();
          windowFocusTimeout.clear();
        },
      ),
    );
  },
  { flush: 'post' },
);

watch(
  [element, isEmpty, isHeld],
  ([viewport, empty, held], _, onCleanup) => {
    if (!viewport || empty || held) return;
    const doc = viewport.ownerDocument;
    onCleanup(
      addEventListener(ownerWindow(viewport), 'keydown', (event) => {
        if (event.key !== 'F6' || event.defaultPrevented) return;
        event.preventDefault();
        // A focus handler can close the toast before focus() returns.
        store.rememberFocus(activeElement(doc) as HTMLElement | null);
        viewport.focus({ preventScroll: true, focusVisible: true });
      }),
    );
    onCleanup(addEventListener(doc, 'pointerdown', store.handleDocumentPointerDown, true));
  },
  { flush: 'post' },
);

// When the toast under the pointer is removed, the browser sends no `mouseout` from the viewport,
// so `mouseleave` never comes. The next `mouseover` outside the viewport is the only sign that the
// pointer has left.
watch(
  [element, expanded, isHeld],
  ([viewport, isExpanded, held], _previous, onCleanup) => {
    if (!viewport || !isExpanded || held) {
      return;
    }

    onCleanup(
      addEventListener(ownerDocument(viewport), 'mouseover', handleDocumentMouseover, true),
    );
  },
  { flush: 'post' },
);

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" :children="ToastViewportChildren" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <ToastViewportChildren><slot :state="state" /></ToastViewportChildren>
  </component>
</template>
