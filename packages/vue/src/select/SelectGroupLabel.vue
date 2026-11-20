<script setup lang="ts">
import { inject, mergeProps, onUnmounted, useAttrs, useId } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { givenId } from '../common/id';
import { selectGroupKey } from './root';
import type { SelectGroupLabelProps, SelectGroupLabelState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<SelectGroupLabelProps>();
defineSlots<{
  default?(scope: { state: SelectGroupLabelState }): unknown;
  element?(scope: ElementSlotProps<SelectGroupLabelState>): unknown;
}>();

const group = inject(selectGroupKey, null);
if (!group) {
  throw new Error(
    'Vase UI: <Select.GroupLabel> must be inside <Select.Group>. Without a group the label names nothing. Put the label inside <Select.Group>.',
  );
}
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const state: SelectGroupLabelState = {};
const label = {
  get id() {
    return givenId(props.id) ?? generatedId;
  },
};
const removeLabel = group.addLabel(label);
onUnmounted(removeLabel);

function elementProps() {
  // The group has the name, so the label is not read a second time.
  return mergeProps({ id: label.id, 'aria-hidden': 'true' }, attrs);
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
