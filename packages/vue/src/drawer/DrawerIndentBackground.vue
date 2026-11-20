<script setup lang="ts">
import { computed, inject, mergeProps, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { providerKey } from './root';
import type { DrawerIndentBackgroundProps, DrawerIndentBackgroundState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<DrawerIndentBackgroundProps>();
defineSlots<{
  default?(scope: { state: DrawerIndentBackgroundState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: DrawerIndentBackgroundState;
  }): unknown;
}>();

const provider = inject(providerKey, null);
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const state = computed<DrawerIndentBackgroundState>(() => ({ active: !!provider?.active }));

function elementProps() {
  return mergeProps({ 'data-active': state.value.active ? '' : undefined }, attrs);
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
