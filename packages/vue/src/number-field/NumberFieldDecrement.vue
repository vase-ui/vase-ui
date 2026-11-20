<script setup lang="ts">
import type { ElementSlotProps } from '../common/element';
import { useStepButton } from './button';
import type { NumberFieldDecrementProps, NumberFieldDecrementState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NumberFieldDecrementProps>(), { disabled: false });
defineSlots<{
  default?(scope: { state: NumberFieldDecrementState }): unknown;
  element?(scope: ElementSlotProps<NumberFieldDecrementState>): unknown;
}>();

const { element, setElement, state, elementProps } = useStepButton(-1, props, 'Decrement');

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
  <button v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </button>
</template>
