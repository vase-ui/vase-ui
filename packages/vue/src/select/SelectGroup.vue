<script setup lang="ts">
import { mergeProps, provide, shallowReactive, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { selectGroupKey } from './root';
import type { SelectGroupProps, SelectGroupState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<SelectGroupProps>();
defineSlots<{
  default?(scope: { state: SelectGroupState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: SelectGroupState;
  }): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const state: SelectGroupState = {};
const labels = shallowReactive<{ readonly id: string }[]>([]);
provide(selectGroupKey, {
  addLabel(label) {
    labels.push(label);
    return () => labels.splice(labels.indexOf(label), 1);
  },
});

function elementProps() {
  return mergeProps({ role: 'group', 'aria-labelledby': labels.at(-1)?.id }, attrs);
}

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
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
