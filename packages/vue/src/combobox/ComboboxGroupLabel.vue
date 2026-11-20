<script setup lang="ts">
import { computed, inject, mergeProps, onUnmounted, useAttrs, useId } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { groupKey, injectComboboxRoot } from './root';
import type { ComboboxGroupLabelProps, ComboboxGroupLabelState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<ComboboxGroupLabelProps>();
defineSlots<{
  default?(scope: { state: ComboboxGroupLabelState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ComboboxGroupLabelState;
  }): unknown;
}>();

injectComboboxRoot('GroupLabel');
const group = inject(groupKey, null);
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const id = computed(() => givenId(props.id) ?? generatedId);
// Nuxt removes `onUnmounted` from its server build, with its arguments.
const removeLabel = group?.addLabel({
  get id() {
    return id.value;
  },
});
onUnmounted(() => removeLabel?.());
const state: ComboboxGroupLabelState = {};

function elementProps() {
  return mergeProps({ id: id.value, 'aria-hidden': 'true' }, attrs);
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
