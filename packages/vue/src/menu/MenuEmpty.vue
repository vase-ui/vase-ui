<script setup lang="ts">
import { computed, mergeProps, nextTick, onMounted, shallowRef, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { injectFilter } from './filter';
import { injectMenu } from './root';
import type { MenuEmptyProps, MenuEmptyState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<MenuEmptyProps>();
defineSlots<{
  default?(scope: { state: MenuEmptyState }): unknown;
  element?(scope: ElementSlotProps<MenuEmptyState>): unknown;
}>();

const filter = injectFilter(injectMenu('Empty'), 'Empty');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const state = computed<MenuEmptyState>(() => ({}));
// The items after this part mount in the same update.
const ready = shallowRef(false);
onMounted(() => nextTick(() => (ready.value = true)));
// The region is in the DOM before its text, so that a screen reader reads the text.
const empty = computed(() => ready.value && filter.shown === 0);

function elementProps() {
  return mergeProps({ role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' }, attrs);
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
    <slot v-if="empty" :state="state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot v-if="empty" :state="state" />
  </div>
</template>
