<script setup lang="ts">
import { mergeProps, useAttrs, type HTMLAttributes } from 'vue';
import { useElement, type AsProps } from '../common/element';
import { injectMeterRoot } from './root';

defineOptions({ inheritAttrs: false });

defineProps<AsProps & /* @vue-ignore */ Omit<HTMLAttributes, 'as'>>();
defineSlots<{
  default?(scope: { formattedValue: string; value: number }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    formattedValue: string;
    value: number;
  }): unknown;
}>();

const meter = injectMeterRoot('Value');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLSpanElement>();

defineExpose({ element });

function elementProps() {
  // `aria-valuetext` of the root has the same text.
  return mergeProps({ 'aria-hidden': 'true' }, attrs);
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :formattedValue="meter.formattedValue"
    :value="meter.value"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :formattedValue="meter.formattedValue" :value="meter.value">{{
      meter.formattedValue
    }}</slot>
  </component>
  <span v-else v-bind="elementProps()" :ref="setElement">
    <slot :formattedValue="meter.formattedValue" :value="meter.value">{{
      meter.formattedValue
    }}</slot>
  </span>
</template>
