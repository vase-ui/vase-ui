<script setup lang="ts">
import { inject, mergeProps, provide, useAttrs, useId } from 'vue';
import { useElement } from '../common/element';
import { fieldsetKey } from './part';
import { legendKey } from './root';
import type { FieldsetLegendProps } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<FieldsetLegendProps>();
defineSlots<{
  default?(): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
  }): unknown;
}>();

const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLLegendElement>();

const forLegend = inject(legendKey, null);
if (forLegend) provide(fieldsetKey, forLegend);

defineExpose({ element });

function elementProps() {
  return mergeProps({ id: props.id || generatedId }, attrs);
}
</script>

<template>
  <slot v-if="$slots.element" name="element" :props="elementProps()" :elementRef="setElement" />
  <legend v-else v-bind="elementProps()" :ref="setElement">
    <slot />
  </legend>
</template>
