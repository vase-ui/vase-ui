<script setup lang="ts">
import { computed, mergeProps, provide, shallowReactive, shallowRef, useAttrs } from 'vue';
import { arrowKeyTarget } from '../common/arrowKeyTarget';
import { byDocumentOrder, useElement } from '../common/element';
import { ownerWindow } from '../common/owner';
import { toolbarKey, type ToolbarItem } from './item';
import type { ToolbarRootProps, ToolbarRootState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToolbarRootProps>(), {
  orientation: 'horizontal',
  disabled: false,
  loopFocus: true,
});
defineSlots<{
  default?(scope: { state: ToolbarRootState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ToolbarRootState;
  }): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const items = shallowReactive<ToolbarItem[]>([]);
const focused = shallowRef<HTMLElement>();
const state = computed<ToolbarRootState>(() => ({
  disabled: props.disabled,
  orientation: props.orientation,
}));

// The item that had the focus last, while it can take the focus. Else the first item.
const tabStop = computed(() => {
  const elements = sequence();
  const last = focused.value;
  return last && elements.includes(last) ? last : elements[0];
});

provide(toolbarKey, {
  get orientation() {
    return props.orientation;
  },
  get disabled() {
    return props.disabled;
  },
  get tabStop() {
    return tabStop.value;
  },
  addItem(item) {
    items.push(item);
    return () => items.splice(items.indexOf(item), 1);
  },
});

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      role: 'toolbar',
      'aria-orientation': props.orientation,
      'data-disabled': props.disabled ? '' : undefined,
      onFocusin,
      onKeydownCapture,
      onKeyupCapture: stopAtDisabledItem,
      onClickCapture: stopAtDisabledItem,
      onMousedownCapture: stopAtDisabledItem,
      onPointerdownCapture: stopAtDisabledItem,
    },
    attrs,
  );
}

// A part in the `element` slot of a toolbar part and a toggle of a group can give one element two
// registrations.
function isItem(target: EventTarget | null) {
  return items.some((item) => item.element === target);
}

function canTakeFocus(element: HTMLElement) {
  return items.every((item) => item.element !== element || item.focusable);
}

function isDisabled(element: HTMLElement) {
  return items.some((item) => item.element === element && item.disabled);
}

/**
 * The items that can take the focus, each one time, in the order of the document. `KeepAlive` takes
 * a held item out of the document, where the browser gives no order.
 */
function sequence() {
  const root = element.value;
  return [...new Set(items.map((item) => item.element))]
    .filter((item) => !!root?.contains(item) && canTakeFocus(item))
    .sort(byDocumentOrder);
}

function onFocusin(event: FocusEvent) {
  if (isItem(event.target)) focused.value = event.target as HTMLElement;
}

function onKeydownCapture(event: KeyboardEvent) {
  if (!moveFocus(event)) stopAtDisabledItem(event);
}

function moveFocus(event: KeyboardEvent) {
  const root = element.value;
  const target = event.target as HTMLElement;
  if (!root || !isItem(target) || hasModifier(event) || isComposing(event)) return false;
  if (!isDisabled(target) && keepsKey(target, event.key)) return false;
  const candidates = sequence();
  const options = {
    orientation: props.orientation,
    rtl: ownerWindow(root).getComputedStyle(root).direction === 'rtl',
    loop: props.loopFocus,
  };
  const first = arrowKeyTarget(event.key, target, candidates, options);
  if (!first) return false;
  // The key never reaches the control, also at an end of the toolbar.
  event.preventDefault();
  event.stopPropagation();
  // The browser refuses the focus to an element that CSS hides or that is disabled, such as a
  // button in a disabled fieldset. The next item then gets it.
  for (let next = first; next !== target;) {
    next.focus();
    if ((next.getRootNode() as Document | ShadowRoot).activeElement === next) {
      // Tab selects the text of an input, and `focus()` does not in Chromium and Firefox.
      if (next instanceof ownerWindow(next).HTMLInputElement) next.select();
      break;
    }
    const following: HTMLElement = arrowKeyTarget(event.key, next, candidates, options) ?? next;
    if (following === next) break;
    next = following;
  }
  return true;
}

// The keys that a disabled item gives to the browser and to a popup around the toolbar.
const PASSING_KEYS = /^(Tab|Escape|F[1-9]|F1[0-2])$/;

// A disabled item gets no press and no key, as a native disabled control. The stop is at the
// target, so the capture listeners of the path still get each event: the dismiss layer of a popup
// decides a press outside in a listener that it adds to the target.
function stopAtDisabledItem(event: Event) {
  const { key } = event as Partial<KeyboardEvent>;
  if (key !== undefined && (hasModifier(event as KeyboardEvent, false) || PASSING_KEYS.test(key))) {
    return;
  }
  const target = event.target as Node;
  if (!items.some((item) => item.disabled && item.element.contains(target))) return;
  event.preventDefault();
  target.addEventListener(
    event.type,
    (dispatched) => {
      if (dispatched === event) dispatched.stopPropagation();
    },
    { capture: true, once: true },
  );
}

function hasModifier(event: KeyboardEvent, withShift = true) {
  return (withShift && event.shiftKey) || event.ctrlKey || event.altKey || event.metaKey;
}

// WebKit sends the keys of a composition with the key code 229 and `isComposing` false
// (https://bugs.webkit.org/show_bug.cgi?id=165004).
function isComposing(event: KeyboardEvent) {
  return event.isComposing || event.keyCode === 229;
}

/** A text control keeps an arrow key that moves its caret or changes its selection. */
function keepsKey(target: HTMLElement, key: string) {
  const window = ownerWindow(target);
  const isInput = target instanceof window.HTMLInputElement;
  if (!isInput && !(target instanceof window.HTMLTextAreaElement)) return false;
  const { selectionStart: start, selectionEnd: end, value } = target;
  // An input of the type `email` or `number` has no selection.
  if (start === null || end === null) return false;
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    if (start !== end) return true;
    const towardEnd =
      (key === 'ArrowRight') !== (window.getComputedStyle(target).direction === 'rtl');
    return towardEnd ? end < value.length : start > 0;
  }
  // The caret of an input has one line, so an input keeps no vertical key.
  if (isInput) return false;
  return key === 'ArrowUp' ? end > 0 : key === 'ArrowDown' && start < value.length;
}
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
