<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { useAsTag, useElement } from '../common/element';
import { useMenuItem } from './item';
import type { MenuLinkItemProps, MenuLinkItemState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuLinkItemProps>(), { closeOnClick: false });
defineSlots<{
  default?(scope: { state: MenuLinkItemState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: MenuLinkItemState;
  }): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const item = useMenuItem({
  part: 'LinkItem',
  element,
  id: () => props.id,
  label: () => props.label,
  disabled: () => false,
  tag: useAsTag(() => props.as),
  role: 'menuitem',
  link: true,
});
const state = computed<MenuLinkItemState>(() => ({ highlighted: item.highlighted.value }));

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
  <a v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </a>
</template>
