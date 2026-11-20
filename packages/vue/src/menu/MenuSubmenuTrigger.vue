<script setup lang="ts">
import { computed, onUnmounted, useAttrs, watch } from 'vue';
import { useAsTag, useElement, type ElementSlotProps } from '../common/element';
import { platform } from '../common/platform';
import { usePopupHover } from '../popup/hover';
import { interactionOf } from '../popup/root';
import { useMenuItem } from './item';
import { injectMenu, registerSubmenuTrigger } from './root';
import type { MenuSubmenuTriggerProps, MenuSubmenuTriggerState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuSubmenuTriggerProps>(), {
  disabled: false,
  openOnHover: true,
  delay: 100,
  closeDelay: 0,
});
defineSlots<{
  default?(scope: { state: MenuSubmenuTriggerState }): unknown;
  element?(scope: ElementSlotProps<MenuSubmenuTriggerState>): unknown;
}>();

const submenu = injectMenu('SubmenuTrigger');
const parent = submenu.parent;
if (!parent) {
  throw new Error(
    'Vase UI: <Menu.SubmenuTrigger> must be inside <Menu.SubmenuRoot>. Without a submenu root the trigger has no submenu to open. Put the trigger inside <Menu.SubmenuRoot>.',
  );
}
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const item = useMenuItem({
  part: 'SubmenuTrigger',
  element,
  id: () => props.id,
  label: () => props.label,
  disabled: () => props.disabled || submenu.disabled,
  tag: useAsTag(() => props.as ?? 'div'),
  role: 'menuitem',
  menu: parent,
});
const { root } = submenu;
const removeTrigger = root.addTrigger({
  get id() {
    return item.id.value;
  },
  get element() {
    return element.value;
  },
  payload: undefined,
  get disabled() {
    return item.disabled.value;
  },
});
onUnmounted(removeTrigger);
watch(
  element,
  (el, _, onCleanup) => {
    if (el) onCleanup(registerSubmenuTrigger(el, submenu));
  },
  { immediate: true },
);

const hover = usePopupHover(() => root, {
  trigger: element,
  enabled: () => props.openOnHover && !item.disabled.value,
  delay: () => props.delay,
  closeDelay: () => props.closeDelay,
  inside: (target) => submenu.inside(target),
  // A menu that opens under a pointer that rests opens no submenu.
  // A pointer that moves in the triangle to the open submenu of a sibling opens nothing.
  startOnMove: (event) =>
    parent.list.moved(event) &&
    (parent.openChild === submenu ||
      !parent.openChild?.hover.value?.approaches({ x: event.clientX, y: event.clientY })),
  passOn: (target) => !!parent.root.popup?.contains(target),
  stayAfterEnter: true,
});
submenu.hover.value = {
  get inTriangle() {
    return hover.inTriangle;
  },
  approaches: (point) => hover.approaches(point),
  get closeDelay() {
    return props.closeDelay;
  },
};

// A query that hides the trigger closes its submenu. A listener that cancels the close keeps it.
watch(item.shown, (shown) => {
  if (!shown && root.open) root.request(false, 'none', new Event('vase-ui'));
});

const open = computed(() => root.open);
const state = computed<MenuSubmenuTriggerState>(() => ({
  open: open.value,
  disabled: item.disabled.value,
  highlighted: item.highlighted.value,
}));

// A key click knows itself by the key before it.
let keyClick = false;
function onKeydown(event: KeyboardEvent) {
  // The typeahead takes a Space while the user types.
  keyClick = !event.defaultPrevented && (event.key === 'Enter' || event.key === ' ');
}

// A key that a listener prevented gave no click, and the click of this press is no key click.
function onPointerdown() {
  keyClick = false;
}

function onClick(event: MouseEvent) {
  const fromKey = keyClick;
  keyClick = false;
  if (fromKey) {
    submenu.openWithKey('first', 'trigger-press', event, element.value);
    return;
  }
  // A mouse that moves on the trigger opens the submenu.
  if (props.openOnHover && event.detail !== 0 && interactionOf(event) === 'mouse') return;
  root.request(!root.open, 'trigger-press', event, element.value);
}

function elementProps() {
  const isOpen = open.value;
  const controlled = isOpen ? (submenu.listElement.value ?? root.popup) : null;
  // A change of `aria-expanded` on the focused trigger makes VoiceOver read that change in place of
  // the first item of the submenu. `aria-haspopup` still says that the item opens a submenu.
  const silent = isOpen && platform.os.apple && root.interaction === 'keyboard';
  return item.mergeAttributes(
    {
      'aria-haspopup': submenu.filter ? 'dialog' : 'menu',
      'aria-expanded': silent ? undefined : isOpen ? 'true' : 'false',
      'aria-controls': controlled?.id || undefined,
      'data-popup-open': isOpen ? '' : undefined,
      onKeydown,
      onPointerdown,
      onClick,
      ...hover.listeners,
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
