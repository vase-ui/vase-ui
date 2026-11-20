<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { injectItem, injectNavigationMenuRoot } from './root';
import type { NavigationMenuIconProps, NavigationMenuIconState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<NavigationMenuIconProps>();
defineSlots<{
  default?(scope: { state: NavigationMenuIconState }): unknown;
  element?(scope: ElementSlotProps<NavigationMenuIconState>): unknown;
}>();

const root = injectNavigationMenuRoot('Icon');
const item = injectItem('Icon');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

const state = computed<NavigationMenuIconState>(() => ({
  open: root.value != null && root.value === item.value,
}));

function elementProps() {
  return mergeProps(
    { 'aria-hidden': 'true', 'data-popup-open': state.value.open ? '' : undefined },
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
    <slot :state="state">▼</slot>
  </component>
  <span v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state">▼</slot>
  </span>
</template>
