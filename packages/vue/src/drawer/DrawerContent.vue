<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { injectDrawer } from './root';
import type { DrawerContentProps, DrawerContentState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<DrawerContentProps>();
defineSlots<{
  default?(scope: { state: DrawerContentState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: DrawerContentState;
  }): unknown;
}>();

const drawer = injectDrawer('Content');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const state: DrawerContentState = {};

function elementProps() {
  // A mouse selects text in the content, so a press there starts no swipe.
  return mergeProps({ onPointerdown: drawer.markContentPress }, attrs);
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
