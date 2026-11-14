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
import { computed, onActivated, onDeactivated, provide, shallowRef, watch } from 'vue';
import type { Component } from 'vue';
import { addEventListener } from '../../common/addEventListener';
import { mergeCleanups } from '../../common/mergeCleanups';
import { ownerDocument, ownerWindow } from '../../common/owner';
import { activeElement, contains, getTarget } from '../../common/shadowDom';
import { useTimeout } from '../../common/useTimeout';
import { visuallyHidden } from '../../common/visuallyHidden';
import type { HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import FocusGuard from '../../utils/popups/focus/FocusGuard.vue';
import { useToastProviderContext } from '../provider/ToastProviderContext';
import { isFocusVisible } from '../utils/focusVisible';
import ToastLabelContent from '../utils/ToastLabelContent.vue';
import ToastViewportChildren from './ToastViewportChildren.vue';
import { ToastViewportContext } from './ToastViewportContext';
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

const isEmpty = computed(() => store.select('isEmpty'));
const toasts = computed(() => store.select('toasts'));
const focused = computed(() => store.select('focused'));
const expanded = computed(() => store.select('expanded'));
const prevFocusElement = computed(() => store.select('prevFocusElement'));
const frontmostHeight = computed(() => toasts.value[0]?.height);

const hasTransitioningToasts = computed(() =>
  toasts.value.some((toast) => toast.transitionStatus === 'ending'),
);
const highPriorityToasts = computed(() =>
  toasts.value.filter((toast) => toast.priority === 'high'),
);
const hasFocusGuards = computed(() => !isEmpty.value && prevFocusElement.value !== null);

// `KeepAlive` takes the element out of the document, so the listeners wait until it comes back.
const deactivated = shallowRef(false);

onDeactivated(() => {
  deactivated.value = true;
});

onActivated(() => {
  deactivated.value = false;
});

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

provide(ToastViewportContext, { hasFocusGuards, handleFocusGuard });

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

  if (
    (isF6 ||
      (event.key === 'Tab' && event.shiftKey && getTarget(event) === store.state.viewport)) &&
    store.state.prevFocusElement &&
    store.restoreFocusToPrevElement()
  ) {
    // Cancel only if focus moved: a hidden or disabled return target leaves the
    // browser free to move focus. `handleFocusout` resumes the timers.
    event.preventDefault();
  }
}

function flushMouseLeave() {
  const hasEndingToasts = store.state.toasts.some((toast) => toast.transitionStatus === 'ending');

  if (hasEndingToasts || touchActive || !markedReadyForMouseLeave) {
    return;
  }

  // Apply any mouseleave that was deferred until transitions finished.
  store.set('hovering', false);
  if (!store.select('expandedOrOutOfFocus')) {
    store.resumeTimers();
  }
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
  store.set('hovering', true);
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
  if (contains(store.state.viewport, activeEl) && isFocusVisible(activeEl)) {
    store.set('focused', true);
    store.pauseTimers();
  }
}

function handleFocusout(event: FocusEvent) {
  if (
    !store.state.focused ||
    contains(store.state.viewport, event.relatedTarget as HTMLElement | null)
  ) {
    return;
  }

  store.set('focused', false);
  if (!store.select('expandedOrOutOfFocus')) {
    store.resumeTimers();
  }
}

const state = computed<ToastViewportState>(() => ({ expanded: expanded.value }));

const { element, elementProps } = useRenderElement('div', props, {
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

// Window focus is tracked even while empty, so toasts added in the background start paused.
// `isEmpty` only toggles the F6 and touch listeners.
watch(
  [element, isEmpty, deactivated],
  ([viewport, empty, isDeactivated], _previous, onCleanup) => {
    if (!viewport || isDeactivated) {
      return;
    }

    const win = ownerWindow(viewport);
    const doc = ownerDocument(viewport);

    function markWindowFocused() {
      store.set('isWindowFocused', true);
      if (!store.select('expanded')) {
        store.resumeTimers();
      }
    }

    // Listen globally for F6 so we can force-focus the viewport.
    function handleGlobalKeydown(event: KeyboardEvent) {
      // Skip presses another viewport already handled.
      if (event.key !== 'F6' || event.defaultPrevented) {
        return;
      }

      event.preventDefault();
      // Set the restore target before focusing: consumer focus handlers may close the toasts.
      store.set('prevFocusElement', activeElement(doc) as HTMLElement | null);
      // `handleFocusin` pauses only on visible focus, which script focus doesn't get everywhere.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The watcher returns above when `viewport` is `null`, and a function declaration keeps no narrowing.
      viewport!.focus({ preventScroll: true, focusVisible: true });
    }

    function handleWindowBlur(event: FocusEvent) {
      if (getTarget(event) !== win) {
        return;
      }

      windowFocusTimeout.clear();
      store.set('isWindowFocused', false);
      store.pauseTimers();

      // Focus that goes into a frame of the page blurs the window, but the page keeps the focus.
      // Firefox reports no focus for the page while it sends the event, so the check comes after.
      windowFocusTimeout.start(0, () => {
        if (doc.hasFocus() && activeElement(doc)?.localName === 'iframe') {
          markWindowFocused();
        }
      });
    }

    function handleWindowFocus(event: FocusEvent) {
      if (event.relatedTarget) {
        return;
      }

      // This capture listener also sees element focus, e.g. a click on a toast while nothing
      // had focus. Wait for `handleFocusin` so keyboard focus inside the viewport keeps the pause,
      // and resume after the flag flips so toasts added in between start running too.
      windowFocusTimeout.start(0, markWindowFocused);
    }

    onCleanup(
      mergeCleanups(
        addEventListener(win, 'blur', handleWindowBlur, true),
        addEventListener(win, 'focus', handleWindowFocus, true),
        !empty && addEventListener(win, 'keydown', handleGlobalKeydown),
        !empty && addEventListener(doc, 'pointerdown', store.handleDocumentPointerDown, true),
      ),
    );
  },
  { flush: 'post' },
);

// When the toast under the pointer is removed, the browser sends no `mouseout` from the viewport,
// so `mouseleave` never comes. The next `mouseover` outside the viewport is the only sign that the
// pointer has left.
watch(
  [element, expanded, deactivated],
  ([viewport, isExpanded, isDeactivated], _previous, onCleanup) => {
    if (!viewport || !isExpanded || isDeactivated) {
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
  <FocusGuard v-if="hasFocusGuards" @focusin="handleFocusGuard" />
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :children="ToastViewportChildren" />
  <component :is="as" v-else v-bind="elementProps()"><ToastViewportChildren><slot :state="state" /></ToastViewportChildren></component>
  <div v-if="!focused && highPriorityToasts.length > 0" :style="visuallyHidden">
    <div v-for="toast in highPriorityToasts" :key="toast.id" role="alert" aria-atomic="true">
      <div><ToastLabelContent :label="toast.title" /></div>
      <div><ToastLabelContent :label="toast.description" /></div>
    </div>
  </div>
</template>
