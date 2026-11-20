<script setup lang="ts">
import { computed, inject, mergeProps, shallowRef, useAttrs, watch } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { useElement } from '../common/element';
import { mergeCleanups } from '../common/mergeCleanups';
import { ownerDocument } from '../common/owner';
import { useTimeout } from '../common/useTimeout';
import { menuKey } from '../menu/root';
import type { VirtualElement } from '../popup/placement';
import type { ContextMenuTriggerProps, ContextMenuTriggerState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<ContextMenuTriggerProps>();
defineSlots<{
  default?(scope: { state: ContextMenuTriggerState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ContextMenuTriggerState;
  }): unknown;
}>();

// A touch or a pen that rests this time opens the menu. Safari on iOS sends no `contextmenu` for it.
const LONG_PRESS = 500;
// A long press stops when the pointer moves more than this distance.
const LONG_PRESS_MOVE = 10;

const injected = inject(menuKey, null);
if (!injected || injected.kind !== 'context') {
  throw new Error(
    'Vase UI: <ContextMenu.Trigger> must be inside <ContextMenu.Root>. Without a root the trigger has no menu to open. Put the trigger inside <ContextMenu.Root>.',
  );
}
const menu = injected;
const { root } = menu;
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const state = computed<ContextMenuTriggerState>(() => ({ open: root.open }));

function at(x: number, y: number, size: number): VirtualElement {
  return { getBoundingClientRect: () => new DOMRect(x - size / 2, y - size / 2, size, size) };
}

function onContextmenu(event: MouseEvent) {
  if (menu.disabled) return;
  event.preventDefault();
  // A trigger around this one opens no menu.
  event.stopPropagation();
  stopLongPress();
  if (!root.open) menu.setAnchor(at(event.clientX, event.clientY, 0));
  root.request(true, 'trigger-press', event);
  // On macOS and Linux the press is down: its release acts by its place
  // (test/measurements/menu.test.ts).
  if (root.open && event.buttons & 2 && element.value) {
    menu.press.start(event, element.value, { item: 0, outside: 500 });
  }
}

let press: { id: number; x: number; y: number; type: string; event: PointerEvent } | null = null;
const timer = useTimeout();

function stopLongPress() {
  press = null;
  timer.clear();
}

function onPointerdown(event: PointerEvent) {
  if (press) {
    stopLongPress();
    return;
  }
  if (menu.disabled || (event.pointerType !== 'touch' && event.pointerType !== 'pen')) return;
  // A trigger around this one starts no long press. The layer listens in the capture phase.
  event.stopPropagation();
  const started = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    type: event.pointerType,
    event,
  };
  press = started;
  timer.start(LONG_PRESS, () => {
    menu.setAnchor(at(started.x, started.y, started.type === 'touch' ? 10 : 0));
    root.request(true, 'trigger-press', started.event);
    if (root.open) skipsLift.value = true;
  });
}

// The lift of a long press can give a `click` to the item that opened under the finger
// (test/measurements/menu.test.ts). That click does nothing.
const skipsLift = shallowRef(false);
watch(
  skipsLift,
  (skips, _, onCleanup) => {
    if (!skips) return;
    const doc = ownerDocument(element.value);
    onCleanup(
      mergeCleanups(
        addEventListener(
          doc,
          'click',
          (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            skipsLift.value = false;
          },
          true,
        ),
        addEventListener(doc, 'pointerdown', () => (skipsLift.value = false), true),
      ),
    );
  },
  { flush: 'sync' },
);

function onPointermove(event: PointerEvent) {
  if (!press || event.pointerId !== press.id) return;
  if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > LONG_PRESS_MOVE) {
    stopLongPress();
  }
}

function onPointerEnd(event: PointerEvent) {
  if (press && event.pointerId === press.id) stopLongPress();
}

// A pen that works as a mouse has no implicit capture, so the trigger gets no `pointerup` after
// the pen left it.
function onPointerleave(event: PointerEvent) {
  if (press?.type === 'pen' && event.pointerId === press.id) stopLongPress();
}

// The `contextmenu` of a right press that closed the menu comes after the block left
// (test/measurements/menu.test.ts), and no native menu opens for it.
watch(
  element,
  (trigger, _, onCleanup) => {
    if (!trigger) return;
    const doc = ownerDocument(trigger);
    let openAtPress = false;
    let closedByPress = false;
    onCleanup(
      mergeCleanups(
        addEventListener(doc, 'pointerdown', () => (openAtPress = root.open), true),
        addEventListener(doc, 'pointerdown', (event) => {
          closedByPress = event.button === 2 && openAtPress && !root.open;
        }),
        // In the capture phase, because a trigger stops the `contextmenu` that it gets.
        addEventListener(
          doc,
          'contextmenu',
          (event) => {
            if (closedByPress) event.preventDefault();
            closedByPress = false;
          },
          true,
        ),
      ),
    );
  },
  { immediate: true },
);

function elementProps() {
  const open = root.open;
  return mergeProps(
    {
      'data-popup-open': open ? '' : undefined,
      'data-pressed': open ? '' : undefined,
      style: { '-webkit-touch-callout': 'none' },
      onContextmenu,
      onPointerdown,
      onPointermove,
      onPointerup: onPointerEnd,
      onPointercancel: onPointerEnd,
      onPointerleave,
    },
    attrs,
  );
}

defineExpose({ element });
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
