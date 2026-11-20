<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import type { ComboboxSeparatorProps, ComboboxSeparatorState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxSeparatorProps>(), { orientation: 'horizontal' });
defineSlots<{
  default?(scope: { state: ComboboxSeparatorState }): unknown;
  element?(scope: ElementSlotProps<ComboboxSeparatorState>): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const state = computed<ComboboxSeparatorState>(() => ({ orientation: props.orientation }));

// The role `presentation` takes no `aria-orientation`, so the attribute says the orientation.
function elementProps() {
  return mergeProps({ role: 'presentation', 'data-orientation': props.orientation }, attrs);
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
