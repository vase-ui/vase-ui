<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { useLiveRegionReady } from '../common/liveRegion';
import { injectComboboxRoot } from './root';
import type { ComboboxEmptyProps, ComboboxEmptyState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<ComboboxEmptyProps>();
defineSlots<{
  default?(scope: { state: ComboboxEmptyState }): unknown;
  element?(scope: ElementSlotProps<ComboboxEmptyState>): unknown;
}>();

const context = injectComboboxRoot('Empty');
// Nuxt removes `onUnmounted` from its server build, with its arguments.
const removeEmpty = context.addEmpty();
onUnmounted(removeEmpty);
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const ready = useLiveRegionReady();
const state = computed<ComboboxEmptyState>(() => ({ empty: context.empty }));

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
    <slot v-if="ready && state.empty" :state="state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot v-if="ready && state.empty" :state="state" />
  </div>
</template>
