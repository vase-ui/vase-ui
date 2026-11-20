<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { injectProgressRoot, statusAttributes } from './root';
import type { ProgressTrackProps, ProgressTrackState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<ProgressTrackProps>();
defineSlots<{
  default?(scope: { state: ProgressTrackState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ProgressTrackState;
  }): unknown;
}>();

const root = injectProgressRoot('Track');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLDivElement>();

defineExpose({ element });

function elementProps() {
  return mergeProps(statusAttributes(root.state), attrs);
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
