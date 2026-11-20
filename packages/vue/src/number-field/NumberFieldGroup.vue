<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { injectNumberFieldRoot, stateAttributes } from './root';
import type { NumberFieldGroupProps, NumberFieldGroupState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<NumberFieldGroupProps>();
defineSlots<{
  default?(scope: { state: NumberFieldGroupState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: NumberFieldGroupState;
  }): unknown;
}>();

const root = injectNumberFieldRoot('Group');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

defineExpose({ element });

function elementProps() {
  return mergeProps({ role: 'group', ...stateAttributes(root.state) }, attrs);
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
