<script setup lang="ts">
import { mergeProps, provide, shallowReactive, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { groupKey, injectComboboxRoot } from './root';
import type { ComboboxGroupProps, ComboboxGroupState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<ComboboxGroupProps>();
defineSlots<{
  default?(scope: { state: ComboboxGroupState }): unknown;
  element?(scope: ElementSlotProps<ComboboxGroupState>): unknown;
}>();

const context = injectComboboxRoot('Group');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const labels = shallowReactive<{ readonly id: string }[]>([]);
provide(groupKey, {
  // A template can mount the new label before it unmounts the old one.
  addLabel(label) {
    labels.push(label);
    return () => {
      const index = labels.indexOf(label);
      if (index !== -1) labels.splice(index, 1);
    };
  },
});
const state: ComboboxGroupState = {};

function elementProps() {
  return mergeProps(
    { role: context.grid ? 'rowgroup' : 'group', 'aria-labelledby': labels.at(-1)?.id },
    attrs,
  );
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
