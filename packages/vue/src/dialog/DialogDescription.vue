<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, useId } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { injectDialog } from './root';
import type { DialogDescriptionProps, DialogDescriptionState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<DialogDescriptionProps>();
defineSlots<{
  default?(scope: { state: DialogDescriptionState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: DialogDescriptionState;
  }): unknown;
}>();

const { root } = injectDialog('Description');
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const elementId = computed(() => givenId(props.id) ?? generatedId);
const state: DialogDescriptionState = {};

// Nuxt removes the call of `onUnmounted` from its server build, with its arguments, so the part
// registers before the call.
const unregister = root.addLabel('description', {
  get id() {
    return elementId.value;
  },
});
onUnmounted(unregister);

function elementProps() {
  return mergeProps({ id: elementId.value }, attrs);
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
  <p v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </p>
</template>
