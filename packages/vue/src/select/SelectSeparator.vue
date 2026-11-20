<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import type { SelectSeparatorProps, SelectSeparatorState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectSeparatorProps>(), { orientation: 'horizontal' });
defineSlots<{
  default?(scope: { state: SelectSeparatorState }): unknown;
  element?(scope: ElementSlotProps<SelectSeparatorState>): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const state = computed<SelectSeparatorState>(() => ({ orientation: props.orientation }));

function elementProps() {
  // The role `presentation` takes no `aria-orientation`.
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
