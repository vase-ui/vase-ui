<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { injectProgressRoot, statusAttributes } from './root';
import type { ProgressIndicatorState } from './types';

defineOptions({ inheritAttrs: false });

defineSlots<{
  default?(scope: { state: ProgressIndicatorState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ProgressIndicatorState;
  }): unknown;
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
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="root.state" />
  </div>
</template>
