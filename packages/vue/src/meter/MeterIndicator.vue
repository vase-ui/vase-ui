<script setup lang="ts">
import { mergeProps, useAttrs, type HTMLAttributes } from 'vue';
import { useElement } from '../common/element';
import { injectMeterRoot } from './root';

defineOptions({ inheritAttrs: false });

defineProps</* @vue-ignore */ HTMLAttributes>();
defineSlots<{
  default?(): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
  }): unknown;
}>();

const meter = injectMeterRoot('Indicator');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLDivElement>();

defineExpose({ element });

function elementProps() {
  return mergeProps(
    { style: { insetInlineStart: 0, height: 'inherit', width: `${meter.percent}%` } },
    attrs,
  );
}
</script>

<template>
  <slot v-if="$slots.element" name="element" :props="elementProps()" :elementRef="setElement" />
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot />
  </div>
</template>
