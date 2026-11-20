<script setup lang="ts" generic="Payload = unknown">
import { computed, inject, mergeProps, useAttrs, useId, watch } from 'vue';
import { useAsTag, useElement } from '../common/element';
import { givenId } from '../common/id';
import { ownerWindow } from '../common/owner';
import { useListItem } from '../list/list';
import { addBarTrigger, menubarKey } from '../menubar/menu';
import { usePopupHover } from '../popup/hover';
import { usePopupTrigger } from '../popup/trigger';
import { useTriggerMenu, type MenuHandle } from './root';
import type { MenuTriggerProps, MenuTriggerState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuTriggerProps<Payload>>(), {
  disabled: false,
  openOnHover: undefined,
  delay: 100,
  closeDelay: 0,
});
defineSlots<{
  default?(scope: { state: MenuTriggerState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: MenuTriggerState;
  }): unknown;
}>();

const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const context = useTriggerMenu(() => props.handle as MenuHandle | undefined);
const root = () => context.value?.root ?? null;
const elementId = computed(() => givenId(props.id) ?? generatedId);
const bar = inject(menubarKey, null);
const isDisabled = () => props.disabled || !!context.value?.disabled;

const hover = usePopupHover(root, {
  trigger: element,
  enabled: () => !!props.openOnHover && !isDisabled(),
  delay: () => props.delay,
  closeDelay: () => props.closeDelay,
  inside: (target) => !!context.value?.inside(target),
});
const trigger = usePopupTrigger(root, {
  element,
  id: () => elementId.value,
  payload: () => props.payload,
  disabled: isDisabled,
  tag: useAsTag(() => props.as),
  closesAtPress: (event) => !props.openOnHover || hover.closesAtPress(event),
  pressStart: () => true,
});
const barItem = bar
  ? useListItem(bar.list, element, { label: () => undefined, disabled: isDisabled })
  : null;
if (bar) {
  watch(
    element,
    (el, _, onCleanup) => {
      if (!el) return;
      addBarTrigger(el, bar);
      onCleanup(bar.addTrigger(el, () => context.value, isDisabled));
    },
    { immediate: true },
  );
}

const state = computed<MenuTriggerState>(() => ({
  open: trigger.open.value,
  disabled: trigger.button.disabled.value,
}));

// A key click knows itself by the key before it.
let keyClick = false;
// The focus of a touch opened the menu of the bar, and the click of that touch comes next.
let focusOpened = false;

let openedAtPress = false;
function onPointerdown(event: PointerEvent) {
  focusOpened = false;
  const menu = context.value;
  const wasOpen = trigger.open.value;
  trigger.onPointerdown(event);
  openedAtPress = !wasOpen && trigger.open.value && event.pointerType === 'mouse';
  if (!menu || !openedAtPress) return;
  menu.startDrag({
    x: event.clientX,
    y: event.clientY,
    time: event.timeStamp,
    trigger: element.value,
    itemDelay: 200,
    outsideDelay: 0,
  });
}

// The `mousedown` of a press that opened the menu would give the focus back to a button in
// Chromium and Firefox, after the popup took it (test/measurements/menu.test.ts).
function onMousedown(event: MouseEvent) {
  if (openedAtPress) event.preventDefault();
}

function onClick(event: MouseEvent) {
  if (focusOpened && event.detail !== 0) {
    focusOpened = false;
    return;
  }
  const fromKey = keyClick;
  keyClick = false;
  const menu = context.value;
  if (fromKey && menu && !trigger.open.value && !trigger.button.disabled.value) {
    menu.openWithKey('first', 'trigger-press', event, element.value);
    return;
  }
  trigger.onClick(event);
}

/** The keys that open the menu with its first item and with its last item. */
function openKeys(): [string, string | undefined] {
  const el = element.value;
  const rtl = !!el && ownerWindow(el).getComputedStyle(el).direction === 'rtl';
  const across = rtl ? 'ArrowLeft' : 'ArrowRight';
  if (bar) return bar.orientation === 'horizontal' ? ['ArrowDown', undefined] : [across, undefined];
  if (context.value?.orientation === 'horizontal') {
    return [across, rtl ? 'ArrowRight' : 'ArrowLeft'];
  }
  return ['ArrowDown', 'ArrowUp'];
}

function onKeydown(event: KeyboardEvent) {
  const menu = context.value;
  if (!menu) return;
  if (trigger.open.value) {
    if (!menu.onKeydown(event)) menu.focus.onTriggerKeydown(event);
    return;
  }
  keyClick = event.key === 'Enter' || event.key === ' ';
  if (trigger.button.disabled.value || event.defaultPrevented) return;
  const [first, last] = openKeys();
  if (event.key !== first && event.key !== last) return;
  event.preventDefault();
  menu.openWithKey(event.key === first ? 'first' : 'last', 'list-navigation', event, element.value);
}

// While a menu of the bar is open, the pointer and the focus move it to another trigger.
function otherMenuOpen() {
  const open = bar?.openMenu;
  return !!open && open !== context.value && !trigger.button.disabled.value;
}

function onBarPointermove(event: PointerEvent) {
  if (event.pointerType === 'touch' || props.openOnHover === false || !otherMenuOpen()) return;
  root()?.request(true, 'trigger-hover', event, element.value);
}

function onBarFocus(event: FocusEvent) {
  if (!otherMenuOpen()) return;
  focusOpened = true;
  root()?.request(true, 'trigger-focus', event, element.value);
}

function elementProps() {
  const menu = context.value;
  const open = trigger.open.value;
  const controlled = open ? (menu?.listElement.value ?? menu?.root.popup) : null;
  const own: Record<string, unknown> = {
    id: elementId.value,
    'aria-haspopup': menu?.filter ? 'dialog' : 'menu',
    'aria-expanded': open ? 'true' : 'false',
    'aria-controls': controlled?.id || undefined,
    'data-pressed': open && menu?.root.reason === 'trigger-press' ? '' : undefined,
    onPointerdown,
    onMousedown,
    onClick,
    onKeydown,
  };
  if (bar && barItem) {
    const { tabindex: _, 'data-highlighted': __, ...listAttributes } = barItem.attributes.value;
    Object.assign(
      own,
      mergeProps(listAttributes, { onPointermove: onBarPointermove, onFocus: onBarFocus }),
      {
        role: 'menuitem',
        tabindex: bar.tabIndex(element.value),
      },
    );
  }
  return trigger.button.mergeAttributes(
    mergeProps(props.openOnHover ? hover.listeners : {}, own),
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
  <button v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </button>
</template>
