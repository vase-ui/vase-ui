<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, useId } from 'vue';
import { useElement } from '../common/element';
import { fieldStateAttributes } from './control';
import { injectFieldRoot } from './root';
import type { FieldErrorProps, FieldErrorState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<FieldErrorProps>();
defineSlots<{
  default?(scope: { state: FieldErrorState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: FieldErrorState;
    messages: string[];
  }): unknown;
}>();

const field = injectFieldRoot('Error');
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLDivElement>();
const id = computed(() => props.id || generatedId);
const shows = computed(() =>
  props.match ? field.validity[props.match] : field.state.valid === false,
);
const messages = computed(() =>
  !props.match && field.formErrors.length > 0 ? field.formErrors : field.errors,
);

onUnmounted(
  field.addDescriber({
    get id() {
      return id.value;
    },
    get shown() {
      return shows.value;
    },
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
    v-if="shows && $slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="field.state"
    :messages="messages"
  />
  <div v-else-if="shows" v-bind="elementProps()" :ref="setElement">
    <slot :state="field.state">
      <template v-if="messages.length === 1">{{ messages[0] }}</template>
      <ul v-else-if="messages.length > 1">
        <li v-for="(message, index) in messages" :key="index">{{ message }}</li>
      </ul>
    </slot>
  </div>
</template>
