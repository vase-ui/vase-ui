<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, useId } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { givenId } from '../common/id';
import { fieldStateAttributes } from './control';
import { injectFieldRoot } from './root';
import type { FieldDescriptionProps, FieldDescriptionState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<FieldDescriptionProps>();
const slots = defineSlots<{
  default?(scope: { state: FieldDescriptionState }): unknown;
  element?(scope: ElementSlotProps<FieldDescriptionState>): unknown;
}>();

const field = injectFieldRoot('Description');
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLParagraphElement>();
const elementId = computed(() => givenId(props.id) ?? generatedId);

// Nuxt removes the call of `onUnmounted` from its server build, with its arguments, so the
// part registers before the call.
const unregister = field.addDescriber({
  // The `element` slot can give the element another `id`.
  get id() {
    return (slots.element && element.value?.id) || elementId.value;
  },
  shown: true,
});
onUnmounted(unregister);

defineExpose({ element });

function elementProps() {
  return mergeProps(
    { id: elementId.value, ...fieldStateAttributes(field.state, field.state.disabled) },
    attrs,
  );
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="field.state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="field.state" />
  </component>
  <p v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="field.state" />
  </p>
</template>
