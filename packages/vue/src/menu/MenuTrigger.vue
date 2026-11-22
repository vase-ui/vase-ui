<script setup lang="ts" generic="Payload = unknown">
import { computed, inject, mergeProps, useAttrs, useId, watch } from 'vue';
import { useAsTag, useElement, type ElementSlotProps } from '../common/element';
import { givenId } from '../common/id';
import { ownerWindow } from '../common/owner';
import { useListItem } from '../list/list';
import { addBarTrigger, menubarKey } from '../menubar/menu';
import { usePopupHover } from '../popup/hover';
import type { InteractionType } from '../popup/root';
import { isVirtualPress, usePopupTrigger } from '../popup/trigger';
import { useTriggerMenu, type MenuContext, type MenuHandle } from './root';
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
  element?(scope: ElementSlotProps<MenuTriggerState>): unknown;
}>();

const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const context = useTriggerMenu(() => props.handle as MenuHandle | undefined);
const root = () => context.value?.root ?? null;
const elementId = computed(() => givenId(props.id) ?? generatedId);
const bar = inject(menubarKey, null);
const isDisabled = () => props.disabled || !!context.value?.disabled || !!bar?.disabled;

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

// A key click knows itself by the key before it. The click of a press of a screen reader acts as a
// key click: the menu opens with its first item highlighted.
let keyClick = false;
// The focus of a touch opened the menu of the bar, and the click of that touch comes next.
let focusOpened = false;
// The pointer of the press on the trigger, until its click. The focus of the press opens the menu
// of the bar for that input, so that a touch locks the scroll only for a menu as wide as the view.
let pressType: InteractionType = '';

let openedAtPress = false;
function onPointerdown(event: PointerEvent) {
  // A key that a listener prevented gave no click, and the click of this press is no key click.
  keyClick = isVirtualPress(event);
  focusOpened = false;
  pressType = event.pointerType as InteractionType;
  const menu = context.value;
  const wasOpen = trigger.open.value;
  trigger.onPointerdown(event);
  openedAtPress = !wasOpen && trigger.open.value && event.pointerType === 'mouse';
  if (!menu || !openedAtPress || !element.value) return;
  menu.press.start(event, element.value, { item: 200 });
}

// The `mousedown` of a press that opened the menu would give the focus back to a button, after the
// popup took it. WebKit on macOS gives a button no focus at a press
// (test/measurements/menu.test.ts).
function onMousedown(event: MouseEvent) {
  if (openedAtPress) event.preventDefault();
}

function onClick(event: MouseEvent) {
  pressType = '';
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
  // The input of a filterable menu is above its list, so its trigger opens with Down and Up.
  if (context.value?.orientation === 'horizontal' && !context.value.filter) {
    return [across, rtl ? 'ArrowRight' : 'ArrowLeft'];
  }
  return ['ArrowDown', 'ArrowUp'];
}

function onKeydown(event: KeyboardEvent) {
  const menu = context.value;
  if (!menu) return;
  if (trigger.open.value) {
    if (relayToInput(menu, event)) return;
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

/**
 * Up, Down and a typed character on the trigger of an open filterable menu, as after a hover open,
 * go to its input. Left and Right do nothing, so they open no highlighted submenu. `true`: the
 * trigger used the key.
 */
function relayToInput(menu: MenuContext, event: KeyboardEvent) {
  const filter = menu.filter;
  if (bar || !filter?.input.value || event.defaultPrevented) return false;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') return true;
  const typed =
    event.key.length === 1 &&
    event.key !== ' ' &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey;
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && !typed) return false;
  filter.takeKey(event);
  return true;
}

// While a menu of the bar is open, the pointer and the focus move it to another trigger.
function otherMenuOpen() {
  const open = bar?.openMenu;
  return (
    !!open && (open !== context.value || !trigger.active.value) && !trigger.button.disabled.value
  );
}

function onBarPointermove(event: PointerEvent) {
  if (event.pointerType === 'touch' || props.openOnHover === false || !otherMenuOpen()) return;
  root()?.request(true, 'trigger-hover', event, element.value);
}

function onBarFocus(event: FocusEvent) {
  if (!otherMenuOpen()) return;
  focusOpened = true;
  root()?.request(true, 'trigger-focus', event, element.value, pressType || undefined);
}

// In a menu that is not virtual, the highlight follows the focus, and a trigger has the focus. A
// closed menu has no highlight.
function onFocus() {
  const list = context.value?.list;
  if (list?.highlighted && !list.virtual) list.highlight(null, 'none');
}

function elementProps() {
  const menu = context.value;
  const open = trigger.open.value;
  // A filterable menu opens a dialog, so its trigger controls the popup.
  const controlled = open
    ? menu?.filter
      ? menu.ids.popup
      : (menu?.ids.list ?? menu?.ids.popup)
    : undefined;
  let own: Record<string, unknown> = {
    id: elementId.value,
    'aria-haspopup': menu?.filter ? 'dialog' : 'menu',
    'aria-expanded': open ? 'true' : 'false',
    'aria-controls': controlled || undefined,
    'data-pressed': open && menu?.root.reason === 'trigger-press' ? '' : undefined,
    onPointerdown,
    onMousedown,
    onClick,
    onKeydown,
  };
  if (bar && barItem) {
    const { tabindex: _, 'data-highlighted': __, ...listAttributes } = barItem.attributes.value;
    own = mergeProps(own, listAttributes, {
      role: 'menuitem',
      tabindex: bar.tabIndex(element.value),
      onPointermove: onBarPointermove,
      onFocus: onBarFocus,
    });
  }
  return trigger.button.mergeAttributes(
    mergeProps(props.openOnHover ? hover.listeners : {}, own, { onFocus }),
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
