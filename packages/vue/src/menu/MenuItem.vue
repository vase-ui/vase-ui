<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { useAsTag, useElement, type ElementSlotProps } from '../common/element';
import { useMenuItem } from './item';
import type { MenuItemProps, MenuItemState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuItemProps>(), { disabled: false, closeOnClick: true });
defineSlots<{
  default?(scope: { state: MenuItemState }): unknown;
  element?(scope: ElementSlotProps<MenuItemState>): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const item = useMenuItem({
  part: 'Item',
  element,
  id: () => props.id,
  label: () => props.label,
  disabled: () => props.disabled,
  tag: useAsTag(() => props.as ?? 'div'),
  role: 'menuitem',
});
const state = computed<MenuItemState>(() => ({
  disabled: item.disabled.value,
  highlighted: item.highlighted.value,
}));

function onClick(event: MouseEvent) {
  if (props.closeOnClick) item.menu.close('item-press', event);
}

function elementProps() {
  return item.mergeAttributes({ onClick }, attrs);
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
