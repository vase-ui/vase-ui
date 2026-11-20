<script setup lang="ts">
import { mergeProps, useAttrs, type HTMLAttributes } from 'vue';
import { useElement, type AsProps } from '../common/element';
import { injectMeterRoot } from './root';

defineOptions({ inheritAttrs: false });

defineProps<AsProps & /* @vue-ignore */ Omit<HTMLAttributes, 'as'>>();
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
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot />
  </div>
</template>
