<script setup lang="ts">
import { computed, mergeProps, provide, shallowReactive, shallowRef, useAttrs } from 'vue';
import { arrowKeyTarget } from '../common/arrowKeyTarget';
import { byDocumentOrder, useElement } from '../common/element';
import { ownerWindow } from '../common/owner';
import { useList } from '../list/list';
import type { MenuContext } from '../menu/root';
import { menubarKey, type MenubarForMenu } from './menu';
import type { MenubarProps, MenubarState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenubarProps>(), {
  orientation: 'horizontal',
  loopFocus: true,
  modal: true,
  disabled: false,
});
defineSlots<{
  default?(scope: { state: MenubarState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: MenubarState;
  }): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const triggers = shallowReactive(
  new Map<Element, { menu: () => MenuContext | null; disabled: () => boolean }>(),
);
const openMenu = shallowRef<MenuContext | null>(null);
const list = useList({
  orientation: () => props.orientation,
  loop: () => props.loopFocus,
  container: () => element.value,
  hover: () => false,
});
// The trigger that had the focus last, else the first enabled one.
const tabStop = computed(() => {
  const last = list.highlighted?.element;
  const enabled = [...triggers]
    .filter(([, trigger]) => !trigger.disabled())
    .map(([trigger]) => trigger)
    .sort(byDocumentOrder);
  return last && enabled.includes(last) ? last : (enabled[0] ?? null);
});
const state = computed<MenubarState>(() => ({
  orientation: props.orientation,
  modal: props.modal,
  hasSubmenuOpen: !!openMenu.value,
}));

const bar: MenubarForMenu = {
  get element() {
    return element.value;
  },
  get orientation() {
    return props.orientation;
  },
  get modal() {
    return props.modal;
  },
  get disabled() {
    return props.disabled;
  },
  list,
  get openMenu() {
    return openMenu.value;
  },
  get triggers() {
    return [...triggers.keys()];
  },
  isTabStop: (trigger) => !!trigger && trigger === tabStop.value,
  addTrigger(trigger, menu, disabled) {
    triggers.set(trigger, { menu, disabled });
    return () => triggers.delete(trigger);
  },
  setOpen(menu, open) {
    if (open) openMenu.value = menu;
    else if (openMenu.value === menu) openMenu.value = null;
  },
  onMenuKey(event, menu) {
    const current = menu.root.activeTrigger as HTMLElement | null;
    const bar = element.value;
    if (!current || !bar) return false;
    const items = list.items();
    const next = arrowKeyTarget(
      event.key,
      current,
      items.map((item) => item.element),
      {
        orientation: props.orientation,
        rtl: ownerWindow(bar).getComputedStyle(bar).direction === 'rtl',
        loop: props.loopFocus,
      },
    );
    if (!next || next === current) return false;
    event.preventDefault();
    menu.root.request(false, 'list-navigation', event);
    list.highlight(items.find((item) => item.element === next) ?? null, 'keyboard', event);
    triggers.get(next)?.menu()?.root.request(true, 'list-navigation', event, next);
    return true;
  },
};
provide(menubarKey, bar);

function onKeydown(event: KeyboardEvent) {
  if (triggers.has(event.target as Element)) list.onKeydown(event);
}

function elementProps() {
  return mergeProps(
    { id: props.id, role: 'menubar', 'aria-orientation': props.orientation, onKeydown },
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
