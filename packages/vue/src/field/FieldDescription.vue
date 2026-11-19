<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, useId } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { fieldStateAttributes } from './control';
import { injectFieldRoot } from './root';
import type { FieldDescriptionProps, FieldDescriptionState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<FieldDescriptionProps>();
defineSlots<{
  default?(scope: { state: FieldDescriptionState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: FieldDescriptionState;
  }): unknown;
}>();

const field = injectFieldRoot('Description');
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLParagraphElement>();
const elementId = computed(() => givenId(props.id) ?? generatedId);

onUnmounted(
  field.addDescriber({
    get id() {
      return elementId.value;
    },
    shown: true,
  }),
);

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
  <p v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="field.state" />
  </p>
</template>
