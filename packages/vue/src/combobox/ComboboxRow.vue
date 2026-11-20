<script setup lang="ts">
import { mergeProps, provide, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { injectComboboxRoot, rowKey } from './root';
import type { ComboboxRowProps, ComboboxRowState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<ComboboxRowProps>();
defineSlots<{
  default?(scope: { state: ComboboxRowState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ComboboxRowState;
  }): unknown;
}>();

injectComboboxRoot('Row');
provide(rowKey, true);
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const state: ComboboxRowState = {};

function elementProps() {
  return mergeProps({ role: 'row' }, attrs);
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
