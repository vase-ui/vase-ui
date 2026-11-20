<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, useId, watch } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { sizeVariables } from '../popup/viewport';
import { injectMenu, injectPositioner } from './root';
import type { MenuPopupProps, MenuPopupState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuPopupProps>(), { finalFocus: undefined });
defineSlots<{
  default?(scope: { state: MenuPopupState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: MenuPopupState;
  }): unknown;
}>();

const menu = injectMenu('Popup');
const placement = injectPositioner('Popup');
const { root } = menu;
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();

// While the old popup leaves, a new open waits: a second element would keep its enter classes.
const shown = computed(
  () => (root.open && !root.leaving) || root.keepMounted || menu.childLeaving,
);
const state = computed<MenuPopupState>(() => ({
  open: root.open,
  side: placement.side.value,
  align: placement.align.value,
  nested: menu.kind === 'submenu',
  instant: root.instant,
}));

watch(element, (popup) => root.setPopup(popup), { flush: 'sync' });
watch(
  () => props.finalFocus,
  (finalFocus) => (menu.finalFocus.value = finalFocus),
  { immediate: true },
);
// Vue does not patch an element that leaves in a `<Transition>`, so the close writes its instant.
watch(
  () => root.instant,
  (instant) => {
    if (instant) element.value?.setAttribute('data-instant', instant);
    else element.value?.removeAttribute('data-instant');
  },
  { flush: 'sync' },
);
const removeLeaving = root.addLeaving(() => element.value);
onUnmounted(() => {
  removeLeaving();
  if (root.popup === element.value) root.setPopup(null);
});

function onKeydown(event: KeyboardEvent) {
  const filter = menu.filter;
  if (!filter) {
    menu.onKeydown(event);
    return;
  }
  if (event.target === filter.input.value) return;
  if (menu.openChild?.root.popup?.contains(event.target as Node)) return;
  filter.takeKey(event);
}

function elementProps() {
  const closed = !root.open;
  const hasList = !!menu.listElement.value;
  const named = 'aria-label' in attrs || 'aria-labelledby' in attrs;
  const role = menu.filter ? 'dialog' : hasList ? 'presentation' : 'menu';
  return mergeProps(
    {
      id: givenId(props.id) ?? generatedId,
      role,
      tabindex: -1,
      'aria-labelledby':
        role === 'presentation' || named ? undefined : root.activeTrigger?.id || undefined,
      'aria-orientation': role === 'menu' && menu.orientation === 'horizontal' ? 'horizontal' : undefined,
      'data-side': state.value.side,
      'data-align': state.value.align,
      'data-instant': root.instant,
      // Vue writes `false` as the attribute `hidden="false"` on an element that is not HTML.
      hidden: closed && !menu.childLeaving ? true : undefined,
      inert: closed ? true : undefined,
      style: sizeVariables('popup', menu.viewport.value?.popup),
      onKeydown,
      onPointermove: menu.filter ? () => menu.filter?.takePointer() : undefined,
    },
    attrs,
  );
}

defineExpose({ element });
</script>

<template>
  <slot
    v-if="shown && $slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="shown && as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <div v-else-if="shown" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
