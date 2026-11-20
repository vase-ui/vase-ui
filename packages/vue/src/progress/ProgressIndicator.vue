<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { injectProgressRoot, statusAttributes } from './root';
import type { ProgressIndicatorProps, ProgressIndicatorState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<ProgressIndicatorProps>();
defineSlots<{
  default?(scope: { state: ProgressIndicatorState }): unknown;
  element?(scope: ElementSlotProps<ProgressIndicatorState>): unknown;
}>();

const root = injectProgressRoot('Indicator');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLDivElement>();

defineExpose({ element });

function elementProps() {
  // While the progress is indeterminate, the element has no `style` of the part.
  const style =
    root.percent === null
      ? {}
      : { style: { insetInlineStart: 0, height: 'inherit', width: `${root.percent}%` } };
  return mergeProps({ ...style, ...statusAttributes(root.state) }, attrs);
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="root.state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="root.state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="root.state" />
  </div>
</template>
