<script setup lang="ts">
import { mergeProps, useAttrs, type HTMLAttributes } from 'vue';
import { useElement, type AsProps } from '../common/element';
import { injectProgressRoot, statusAttributes } from './root';
import type { ProgressTrackState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<AsProps & /* @vue-ignore */ Omit<HTMLAttributes, 'as'>>();
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
