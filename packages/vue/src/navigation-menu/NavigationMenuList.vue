<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { useKeyGroup } from './keys';
import { injectNavigationMenuRoot } from './root';
import type { NavigationMenuListProps, NavigationMenuListState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<NavigationMenuListProps>();
defineSlots<{
  default?(scope: { state: NavigationMenuListState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: NavigationMenuListState;
  }): unknown;
}>();

const root = injectNavigationMenuRoot('List');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
// The triggers and the links of a nested list are items of the content above it.
const onKeydown = root.nested ? undefined : useKeyGroup({ orientation: () => root.orientation });

const state = computed<NavigationMenuListState>(() => ({ open: root.popup.open }));

function elementProps() {
  return mergeProps({ onKeydown }, attrs);
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
  <ul v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </ul>
</template>
