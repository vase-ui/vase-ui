<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { injectProgressRoot, statusAttributes } from './root';
import type { ProgressLabelProps, ProgressLabelState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<ProgressLabelProps>();
defineSlots<{
  default?(scope: { state: ProgressLabelState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ProgressLabelState;
  }): unknown;
}>();

const root = injectProgressRoot('Label');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLSpanElement>();
const elementId = computed(() => givenId(props.id) ?? root.labelId);

// Nuxt removes the call of `onUnmounted` from its server build, with its arguments, so the
// part registers before the call.
const unregister = root.addLabel({
  get id() {
    return elementId.value;
  },
});
onUnmounted(unregister);

defineExpose({ element });

function elementProps() {
  return mergeProps({ id: elementId.value, ...statusAttributes(root.state) }, attrs);
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
  <span v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="root.state" />
  </span>
</template>
