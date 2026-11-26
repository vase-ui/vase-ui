<script setup lang="ts">
import { computed, mergeProps, provide, useAttrs, useId, watch } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { givenId } from '../common/id';
import { usePopupPart } from '../popup/portal';
import { sizeVariables, usePopupEdge } from '../popup/viewport';
import { groupItemsKey } from './filter';
import { injectMenu, injectPositioner } from './root';
import type { MenuPopupProps, MenuPopupState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuPopupProps>(), { finalFocus: undefined });
defineSlots<{
  default?(scope: { state: MenuPopupState }): unknown;
  element?(scope: ElementSlotProps<MenuPopupState>): unknown;
}>();

const menu = injectMenu('Popup');
const placement = injectPositioner('Popup');
// The items of a submenu in a group of the parent count for the query of the submenu only.
provide(groupItemsKey, null);
const { root } = menu;
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();

const { entered, shown: popupShown } = usePopupPart(root, element);
const shown = computed(() => popupShown.value || menu.childLeaving);
const state = computed<MenuPopupState>(() => ({
  open: root.open,
  side: placement.side.value,
  align: placement.align.value,
  nested: menu.kind === 'submenu',
  instant: root.instant,
}));

const elementId = computed(() => givenId(props.id) ?? generatedId);

// The cleanup runs also at the unmount, where Vue stops the watcher before it clears the ref.
watch(
  element,
  (popup, _, onCleanup) => {
    root.setPopup(popup);
    onCleanup(() => {
      if (root.popup === popup) root.setPopup(null);
    });
  },
  { flush: 'sync' },
);
watch(
  [element, elementId],
  ([popup, popupId], _, onCleanup) => {
    if (!popup) return;
    menu.ids.popup = popupId;
    onCleanup(() => {
      if (menu.ids.popup === popupId) menu.ids.popup = undefined;
    });
  },
  { flush: 'sync' },
);
watch(
  () => props.finalFocus,
  (finalFocus) => (menu.finalFocus.value = finalFocus),
  { immediate: true },
);

function onKeydown(event: KeyboardEvent) {
  // A submenu with no portal is in this popup, and it takes its own keys.
  if (menu.openChild?.root.popup?.contains(event.target as Node)) return;
  const filter = menu.filter;
  if (filter?.input.value) filter.takeKey(event);
  else menu.onKeydown(event);
}

usePopupEdge(
  () => element.value,
  () => placement.physicalSide.value,
  () => menu.viewport.value?.positioner,
);

function elementProps() {
  const closed = !root.open;
  const hasList = !!menu.listElement.value;
  const named = 'aria-label' in attrs || 'aria-labelledby' in attrs;
  const role = menu.filter ? 'dialog' : hasList ? 'presentation' : 'menu';
  return mergeProps(
    {
      id: elementId.value,
      role,
      tabindex: -1,
      'aria-labelledby':
        role === 'presentation' || named ? undefined : root.activeTriggerId || undefined,
      'aria-orientation':
        role === 'menu' && menu.orientation === 'horizontal' ? 'horizontal' : undefined,
      'data-side': state.value.side,
      'data-align': state.value.align,
      'data-instant': root.instant,
      // Vue writes `false` as the attribute `hidden="false"` on an element that is not HTML.
      hidden: closed && root.keepMounted && !menu.childLeaving ? true : undefined,
      inert: closed ? true : undefined,
      style: sizeVariables('popup', menu.viewport.value?.popup),
      onKeydown,
      onPointermove: menu.filter
        ? (event: PointerEvent) => menu.filter?.takePointer(event)
        : undefined,
    },
    attrs,
  );
}

defineExpose({ element });
</script>

<!-- A fragment takes no `v-show`, so the `element` slot renders only while the popup is open or a
submenu in it leaves. -->
<template>
  <template v-if="$slots.element">
    <slot
      v-if="root.open || root.keepMounted || menu.childLeaving"
      name="element"
      :props="elementProps()"
      :elementRef="setElement"
      :state="state"
    />
  </template>
  <component :is="as" v-else-if="as" v-show="shown" v-bind="elementProps()" :ref="setElement">
    <slot v-if="entered" :state="state" />
  </component>
  <div v-else v-show="shown" v-bind="elementProps()" :ref="setElement">
    <slot v-if="entered" :state="state" />
  </div>
</template>
