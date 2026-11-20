<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { useElement } from '../common/element';
import type { SeparatorProps, SeparatorState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SeparatorProps>(), { orientation: 'horizontal' });
defineSlots<{
  default?(scope: { state: SeparatorState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: SeparatorState;
  }): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLDivElement>();
const state = computed<SeparatorState>(() => ({ orientation: props.orientation }));

defineExpose({ element });

function elementProps() {
  return mergeProps({ role: 'separator', 'aria-orientation': props.orientation }, attrs);
}
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
