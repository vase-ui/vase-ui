<script setup lang="ts" generic="Value = unknown">
import { mergeProps, shallowReactive, useAttrs, useId } from 'vue';
import { useElement } from '../common/element';
import { provideItem, type NavigationMenuItem } from './root';
import type { NavigationMenuItemProps, NavigationMenuItemState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<NavigationMenuItemProps<Value>>();
defineSlots<{
  default?(scope: { state: NavigationMenuItemState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: NavigationMenuItemState;
  }): unknown;
}>();

const attrs = useAttrs();
const generatedValue = useId();
const { element, setElement } = useElement<HTMLElement>();
const state: NavigationMenuItemState = {};
const item: NavigationMenuItem = shallowReactive({
  get value() {
    return props.value === undefined ? generatedValue : props.value;
  },
  contentId: null,
});
provideItem(item);

function elementProps() {
  return mergeProps({}, attrs);
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
  <li v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </li>
</template>
