<script setup lang="ts">
import { computed, mergeProps, onUnmounted, shallowRef, useAttrs, watch } from 'vue';
import { useElement } from '../common/element';
import { useIsHydrated } from '../common/hydration';
import { visuallyHidden } from '../common/visuallyHidden';
import { isComposing } from '../popup/layer';
import { injectToastProvider } from './provider';
import type { ToastViewportProps, ToastViewportState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<ToastViewportProps>();
defineSlots<{
  default?(scope: { state: ToastViewportState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ToastViewportState;
  }): unknown;
}>();

const provider = injectToastProvider('<Toast.Viewport>');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const mounted = useIsHydrated();
/** The element that had the focus before F6. */
const origin = shallowRef<Element | null>(null);

// Nuxt removes the call of `onUnmounted` from its server build, with its arguments, so the part
// registers before the call.
const removeViewport = provider.setViewport({
  get element() {
    return element.value;
  },
  get origin() {
    return origin.value;
  },
  returnFocus,
});
onUnmounted(removeViewport);

/** Moves the focus to the origin. Gives `true` when the focus is then outside the viewport. */
function returnFocus() {
  const target = origin.value;
  const viewport = element.value;
  if (!target || !viewport) return false;
  const doc = viewport.ownerDocument;
  if (target === doc.body) (doc.activeElement as HTMLElement | null)?.blur();
  else (target as HTMLElement).focus({ preventScroll: true });
  const outside = !viewport.contains(doc.activeElement);
  if (outside) origin.value = null;
  return outside;
}

function onKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented) return;
  const f6 = event.key === 'F6';
  // No window listener takes the focus back to the viewport.
  if (f6) event.stopPropagation();
  const back =
    f6 ||
    (event.key === 'Tab' && event.shiftKey && event.target === element.value) ||
    // An Escape that no toast took (VUE-130).
    (event.key === 'Escape' && !isComposing(event));
  if (back && origin.value && returnFocus()) {
    event.stopPropagation();
    event.preventDefault();
  }
}

// A `mouseleave` while a toast leaves waits for the end of the leaves, so the stack stays
// expanded while the user closes toasts one after the other.
let heldLeave = false;

function enter() {
  heldLeave = false;
  provider.setInteraction({ hover: true });
}

function leave() {
  if (provider.leaving > 0) heldLeave = true;
  else provider.setInteraction({ hover: false });
}

watch(
  () => provider.leaving,
  (leaving) => {
    if (leaving > 0 || !heldLeave) return;
    heldLeave = false;
    provider.setInteraction({ hover: false });
  },
);

function onFocusin(event: FocusEvent) {
  // A press gives no `:focus-visible` focus, so it does not keep the stack expanded
  // (test/measurements/toast.test.ts).
  if ((event.target as Element).matches(':focus-visible')) provider.setInteraction({ focus: true });
}

function onFocusout(event: FocusEvent) {
  const related = event.relatedTarget as Node | null;
  if (!related || !element.value?.contains(related)) provider.setInteraction({ focus: false });
}

// The window and the page stop the timers from the mount, so a toast that comes while the window
// has no focus waits.
watch(
  element,
  (viewport, _, onCleanup) => {
    if (!viewport) return;
    const doc = viewport.ownerDocument;
    const win = doc.defaultView!;
    let check: ReturnType<typeof setTimeout> | undefined;
    // The window gets `blur` when the focus goes into a frame of the page. The page has the focus
    // then, and the frame is the active element one task later (test/measurements/toast.test.ts).
    const onBlur = () => {
      provider.setInteraction({ windowFocused: false });
      clearTimeout(check);
      check = setTimeout(() => {
        if (doc.activeElement?.localName === 'iframe' && doc.hasFocus()) {
          provider.setInteraction({ windowFocused: true });
        }
      });
    };
    const onFocus = () => {
      clearTimeout(check);
      provider.setInteraction({ windowFocused: true });
    };
    const onVisibilitychange = () =>
      provider.setInteraction({ hidden: doc.visibilityState === 'hidden' });
    onVisibilitychange();
    win.addEventListener('blur', onBlur);
    win.addEventListener('focus', onFocus);
    doc.addEventListener('visibilitychange', onVisibilitychange);
    onCleanup(() => {
      clearTimeout(check);
      win.removeEventListener('blur', onBlur);
      win.removeEventListener('focus', onFocus);
      doc.removeEventListener('visibilitychange', onVisibilitychange);
    });
  },
  { immediate: true, flush: 'post' },
);

watch(
  [element, () => provider.toasts.length > 0],
  ([viewport, any], _, onCleanup) => {
    if (!viewport || !any) return;
    const doc = viewport.ownerDocument;
    const win = doc.defaultView!;
    const onWindowKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'F6' || event.defaultPrevented) return;
      // A focus listener of the developer can close the toasts.
      origin.value = doc.activeElement;
      // The viewport then matches `:focus-visible` (test/measurements/toast.test.ts).
      viewport.focus({ preventScroll: true });
      event.preventDefault();
    };
    // A touch device sends `mouseleave` only at the next tap on another element
    // (test/measurements/toast.test.ts).
    const onPointerdown = (event: PointerEvent) => {
      if (event.pointerType === 'touch' && !viewport.contains(event.target as Node)) {
        provider.setInteraction({ hover: false, focus: false });
      }
    };
    win.addEventListener('keydown', onWindowKeydown);
    doc.addEventListener('pointerdown', onPointerdown, true);
    onCleanup(() => {
      win.removeEventListener('keydown', onWindowKeydown);
      doc.removeEventListener('pointerdown', onPointerdown, true);
    });
  },
  { immediate: true, flush: 'post' },
);

// WebKit sends no `mouseleave` when the toast under the pointer leaves the document
// (test/measurements/toast.test.ts).
watch(
  [element, () => provider.expanded],
  ([viewport, expanded], _, onCleanup) => {
    if (!viewport || !expanded) return;
    const onMouseover = (event: MouseEvent) => {
      if (!viewport.contains(event.target as Node)) leave();
    };
    viewport.ownerDocument.addEventListener('mouseover', onMouseover, true);
    onCleanup(() => viewport.ownerDocument.removeEventListener('mouseover', onMouseover, true));
  },
  { flush: 'post' },
);

const sentinels = computed(() => mounted.value && !!origin.value && provider.toasts.length > 0);

/**
 * A sentinel that gets the focus from a toast returns it to the origin. From another place, it
 * sends the focus to the first or the last toast that is not inert.
 */
function onSentinelFocus(edge: 'first' | 'last', event: FocusEvent) {
  const viewport = element.value;
  const related = event.relatedTarget as Element | null;
  if (!related || related === viewport || !viewport?.contains(related)) {
    const roots = provider.toasts
      .map((toast) => provider.rootElement(toast.id))
      .filter((root) => root && !root.inert);
    const root = edge === 'first' ? roots[0] : roots.at(-1);
    if (root) {
      root.focus();
      return;
    }
  }
  returnFocus();
}

const state = computed<ToastViewportState>(() => ({ expanded: provider.expanded }));

function elementProps() {
  const height = provider.toasts[0]?.height;
  return mergeProps(
    {
      role: 'region',
      tabindex: -1,
      'aria-live': 'polite',
      'aria-atomic': 'false',
      'aria-relevant': 'additions text',
      'data-expanded': state.value.expanded ? '' : undefined,
      style: { '--toast-frontmost-height': height ? `${height}px` : undefined },
      onMouseenter: enter,
      onMousemove: enter,
      onPointerdown: enter,
      onMouseleave: leave,
      onFocusin,
      onFocusout,
      onKeydown,
    },
    attrs,
  );
}

defineExpose({ element });
</script>

<template>
  <template v-if="$slots.element">
    <span
      v-if="sentinels"
      tabindex="0"
      aria-hidden="true"
      :style="visuallyHidden"
      @focus="onSentinelFocus('first', $event)"
    />
    <slot name="element" :props="elementProps()" :elementRef="setElement" :state="state" />
    <span
      v-if="sentinels"
      tabindex="0"
      aria-hidden="true"
      :style="visuallyHidden"
      @focus="onSentinelFocus('last', $event)"
    />
  </template>
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <span
      v-if="sentinels"
      tabindex="0"
      aria-hidden="true"
      :style="visuallyHidden"
      @focus="onSentinelFocus('first', $event)"
    />
    <slot :state="state" />
    <span
      v-if="sentinels"
      tabindex="0"
      aria-hidden="true"
      :style="visuallyHidden"
      @focus="onSentinelFocus('last', $event)"
    />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <span
      v-if="sentinels"
      tabindex="0"
      aria-hidden="true"
      :style="visuallyHidden"
      @focus="onSentinelFocus('first', $event)"
    />
    <slot :state="state" />
    <span
      v-if="sentinels"
      tabindex="0"
      aria-hidden="true"
      :style="visuallyHidden"
      @focus="onSentinelFocus('last', $event)"
    />
  </div>
</template>
