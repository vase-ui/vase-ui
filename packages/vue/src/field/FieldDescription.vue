<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, useId } from 'vue';
import { useElement } from '../common/element';
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
const id = computed(() => props.id || generatedId);

onUnmounted(
  field.addDescriber({
    get id() {
      return id.value;
    },
    shown: true,
  }),
);

defineExpose({ element });

function elementProps() {
  return mergeProps(
    { id: id.value, ...fieldStateAttributes(field.state, field.state.disabled) },
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
